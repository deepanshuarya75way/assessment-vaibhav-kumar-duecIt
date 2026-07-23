package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/duecit/duecit/internal/auth"
	"github.com/duecit/duecit/internal/config"
	"github.com/duecit/duecit/internal/database"
	"github.com/duecit/duecit/internal/duel"
	"github.com/duecit/duecit/internal/elo"
	"github.com/duecit/duecit/internal/handlers"
	"github.com/duecit/duecit/internal/judge"
	"github.com/duecit/duecit/internal/matchmaking"
	"github.com/duecit/duecit/internal/problems"
	"github.com/duecit/duecit/internal/seed"
	"github.com/duecit/duecit/internal/ws"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	db, err := database.ConnectMongo(ctx, cfg.MongoURI, cfg.MongoDB)
	if err != nil {
		log.Fatalf("MongoDB: %v", err)
	}
	log.Println("Connected to MongoDB")

	rdb, err := database.ConnectRedis(ctx, cfg.RedisURL)
	if err != nil {
		log.Fatalf("Redis: %v", err)
	}
	log.Println("Connected to Redis")

	seedCtx, seedCancel := context.WithTimeout(context.Background(), 30*time.Second)
	if err := seed.Run(seedCtx, db); err != nil {
		log.Printf("Seed warning: %v", err)
	}
	seedCancel()

	authSvc := auth.NewService(cfg, db)
	probSvc := problems.NewService(db)
	judgeSvc := judge.NewService(cfg)
	eloSvc := elo.NewService(db)
	hub := ws.NewHub(authSvc)

	duelMgr := duel.NewManager(db, probSvc, judgeSvc, eloSvc, hub, rdb)
	hub.SetOnConnect(func(userID string) {
		uid, err := primitive.ObjectIDFromHex(userID)
		if err == nil {
			duelMgr.OnUserConnected(uid)
		}
	})
	mmSvc := matchmaking.NewService(cfg, rdb, probSvc, duelMgr, hub)
	mmSvc.StartPoller(context.Background())
	duelMgr.StartRecoveryPoller(context.Background())

	h := &handlers.Handlers{
		Auth: authSvc, Problems: probSvc,
		Matchmaking: mmSvc, Duel: duelMgr,
	}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", h.Health)
	r.Get("/ws", hub.HandleWS)

	r.Route("/api", func(api chi.Router) {
		api.Route("/auth", func(ar chi.Router) {
			ar.Post("/register", h.Register)
			ar.Post("/login", h.Login)
			ar.Post("/password/forgot", h.ForgotPassword)
			ar.Post("/password/reset", h.ResetPassword)
			ar.Post("/refresh", h.Refresh)
			ar.Get("/oauth/providers", h.OAuthProviders)
			ar.Get("/oauth/{provider}", h.OAuthStart)
			ar.Get("/oauth/{provider}/callback", h.OAuthCallback)
		})

		api.Group(func(pr chi.Router) {
			pr.Use(auth.AuthMiddleware(authSvc))
			pr.Post("/auth/logout", h.Logout)
			pr.Get("/user/me", h.Me)
			pr.Get("/user/me/matches", h.MyMatchHistory)
			pr.Get("/user/profile/{username}", h.GetProfile)

			pr.Route("/match", func(mr chi.Router) {
				mr.Post("/queue/join", h.JoinQueue)
				mr.Post("/queue/leave", h.LeaveQueue)
				mr.Get("/queue/status", h.QueueStatus)
				mr.Get("/pending", h.GetPendingMatch)
				mr.Get("/active", h.GetActiveMatch)
				mr.Get("/{id}/details", h.GetMatchDetails)
				mr.Get("/{id}/result", h.GetMatchResult)
				mr.Get("/{id}", h.GetMatch)
			})

			pr.Route("/submission", func(sr chi.Router) {
				sr.Post("/{matchId}/run", h.RunCode)
				sr.Post("/{matchId}/submit", h.SubmitCode)
			})
		})

		api.Route("/admin", func(admin chi.Router) {
			admin.Use(auth.AuthMiddleware(authSvc))
			admin.Use(auth.AdminMiddleware)
			admin.Get("/problems", h.AdminListProblems)
			admin.Post("/problems", h.AdminCreateProblem)
			admin.Post("/problems/import", h.AdminImportProblems)
			admin.Put("/problems/{id}", h.AdminUpdateProblem)
			admin.Delete("/problems/{id}", h.AdminDeleteProblem)
			admin.Get("/problems/{id}/testcases", h.AdminGetTestCases)
			admin.Post("/problems/{id}/testcases", h.AdminAddTestCase)
			admin.Delete("/problems/{id}/testcases/{tcId}", h.AdminDeleteTestCase)
			admin.Get("/stats", h.AdminStats)
			admin.Get("/matches/active", h.AdminActiveMatches)
		})
	})

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
	}

	go func() {
		log.Printf("DuecIt API running on http://localhost:%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = srv.Shutdown(shutdownCtx)
}
