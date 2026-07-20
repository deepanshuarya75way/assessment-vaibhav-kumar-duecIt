package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/duecit/duecit/internal/auth"
	"github.com/duecit/duecit/internal/duel"
	"github.com/duecit/duecit/internal/judge"
	"github.com/duecit/duecit/internal/matchmaking"
	"github.com/duecit/duecit/internal/models"
	"github.com/duecit/duecit/internal/problems"
	"github.com/duecit/duecit/pkg/response"
	"github.com/go-chi/chi/v5"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Handlers struct {
	Auth        *auth.Service
	Problems    *problems.Service
	Matchmaking *matchmaking.Service
	Duel        *duel.Manager
}

// --- Auth ---

type registerReq struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *Handlers) Register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request")
		return
	}
	if len(req.Password) < 8 {
		response.Error(w, http.StatusBadRequest, "Password must be at least 8 characters")
		return
	}
	user, err := h.Auth.Register(r.Context(), req.Username, req.Email, req.Password)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	response.JSON(w, http.StatusCreated, "User registered", user)
}

type loginReq struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request")
		return
	}
	user, access, refresh, err := h.Auth.Login(r.Context(), req.Login, req.Password)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Logged in", map[string]interface{}{
		"user": user, "accessToken": access, "refreshToken": refresh,
	})
}

func (h *Handlers) Refresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refreshToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request")
		return
	}
	access, refresh, err := h.Auth.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		response.Error(w, http.StatusUnauthorized, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Token refreshed", map[string]string{
		"accessToken": access, "refreshToken": refresh,
	})
}

func (h *Handlers) Logout(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	_ = h.Auth.Logout(r.Context(), user.ID)
	response.JSON(w, http.StatusOK, "Logged out", nil)
}

func (h *Handlers) Me(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	response.JSON(w, http.StatusOK, "User fetched", user)
}

func (h *Handlers) OAuthStart(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	redirectURL, err := h.Auth.OAuthRedirectURL(provider)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

func (h *Handlers) OAuthCallback(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")
	code := r.URL.Query().Get("code")
	if code == "" {
		response.Error(w, http.StatusBadRequest, "Missing authorization code")
		return
	}
	user, access, refresh, err := h.Auth.HandleOAuthCallback(r.Context(), provider, code)
	if err != nil {
		http.Redirect(w, r, h.Auth.FrontendURL()+"/login?error="+url.QueryEscape(err.Error()), http.StatusTemporaryRedirect)
		return
	}
	target := fmt.Sprintf("%s/auth/callback?accessToken=%s&refreshToken=%s&username=%s",
		h.Auth.FrontendURL(),
		url.QueryEscape(access),
		url.QueryEscape(refresh),
		url.QueryEscape(user.Username),
	)
	http.Redirect(w, r, target, http.StatusTemporaryRedirect)
}

func (h *Handlers) OAuthProviders(w http.ResponseWriter, r *http.Request) {
	response.JSON(w, http.StatusOK, "OAuth providers", map[string]bool{
		"google": auth.OAuthConfigured(h.Auth.Config(), "google"),
		"github": auth.OAuthConfigured(h.Auth.Config(), "github"),
	})
}

func (h *Handlers) GetProfile(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	user, err := h.Auth.GetUserByUsername(r.Context(), username)
	if err != nil {
		response.Error(w, http.StatusNotFound, "User not found")
		return
	}
	matches, _ := h.Duel.GetUserMatchHistory(r.Context(), user.ID, 20)
	response.JSON(w, http.StatusOK, "Profile fetched", map[string]interface{}{
		"user":    user,
		"matches": matches,
	})
}

func (h *Handlers) MyMatchHistory(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	matches, err := h.Duel.GetUserMatchHistory(r.Context(), user.ID, 50)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Match history", matches)
}

// --- Match ---

type joinQueueReq struct {
	Category   string `json:"category"`
	Difficulty string `json:"difficulty"`
	Mode       string `json:"mode"`
	Language   string `json:"language"`
}

func (h *Handlers) JoinQueue(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user.Role == models.RoleAdmin {
		response.Error(w, http.StatusForbidden, "Admins cannot join matchmaking")
		return
	}
	var req joinQueueReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request")
		return
	}
	if req.Language == "" {
		req.Language = "python"
	}
	entry, err := h.Matchmaking.JoinQueue(r.Context(), user, req.Category, req.Difficulty, req.Mode, req.Language)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Joined queue", entry)
}

func (h *Handlers) GetPendingMatch(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	match, err := h.Matchmaking.GetPendingMatch(r.Context(), user.ID.Hex())
	if err != nil {
		response.JSON(w, http.StatusOK, "No pending match", nil)
		return
	}
	response.JSON(w, http.StatusOK, "Pending match", match)
}

func (h *Handlers) GetActiveMatch(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	match, err := h.Duel.GetActiveMatchForUser(r.Context(), user.ID)
	if err != nil {
		response.JSON(w, http.StatusOK, "No active match", nil)
		return
	}
	response.JSON(w, http.StatusOK, "Active match", match)
}

func (h *Handlers) GetMatchDetails(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	id, err := primitive.ObjectIDFromHex(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid match id")
		return
	}
	details, err := h.Duel.GetMatchDetails(r.Context(), id, user.ID)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Match details", details)
}

func (h *Handlers) GetMatchResult(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	id, err := primitive.ObjectIDFromHex(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid match id")
		return
	}
	result, err := h.Duel.GetMatchResult(r.Context(), id, user.ID)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Match result", result)
}

func (h *Handlers) LeaveQueue(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if err := h.Matchmaking.LeaveQueue(r.Context(), user.ID.Hex()); err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Left queue", nil)
}

func (h *Handlers) QueueStatus(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	entry, pos, err := h.Matchmaking.GetQueueStatus(r.Context(), user.ID.Hex())
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Queue status", map[string]interface{}{
		"entry": entry, "position": pos,
	})
}

func (h *Handlers) GetMatch(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	id, err := primitive.ObjectIDFromHex(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid match id")
		return
	}
	match, err := h.Matchmaking.GetMatchByID(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Match not found")
		return
	}
	if match.PlayerA != user.ID && match.PlayerB != user.ID {
		response.Error(w, http.StatusForbidden, "Not authorized")
		return
	}
	response.JSON(w, http.StatusOK, "Match fetched", match)
}

// --- Submission ---

type codeReq struct {
	Code        string `json:"code"`
	Language    string `json:"language"`
	PrevCodeLen int    `json:"prevCodeLen"`
}

func (h *Handlers) RunCode(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	matchID, err := primitive.ObjectIDFromHex(chi.URLParam(r, "matchId"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid match id")
		return
	}
	var req codeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request")
		return
	}
	result, err := h.Duel.RunCode(r.Context(), matchID, user.ID, req.Code, req.Language)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Run complete", result)
}

func (h *Handlers) SubmitCode(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	matchID, err := primitive.ObjectIDFromHex(chi.URLParam(r, "matchId"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid match id")
		return
	}
	var req codeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request")
		return
	}
	sub, finished, err := h.Duel.SubmitCode(r.Context(), matchID, user.ID, req.Code, req.Language, req.PrevCodeLen)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Submitted", map[string]interface{}{
		"submission": sub, "matchFinished": finished,
	})
}

// --- Admin Problems ---

func (h *Handlers) AdminListProblems(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	difficulty := r.URL.Query().Get("difficulty")
	list, err := h.Problems.ListProblems(r.Context(), category, difficulty)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Problems listed", list)
}

func (h *Handlers) AdminCreateProblem(w http.ResponseWriter, r *http.Request) {
	var p models.Problem
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request")
		return
	}
	if p.ProblemID == "" {
		p.ProblemID = "P" + strings.ToUpper(primitive.NewObjectID().Hex()[:6])
	}
	prepareProblemForSave(&p)
	created, err := h.Problems.CreateProblem(r.Context(), &p)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	response.JSON(w, http.StatusCreated, "Problem created", created)
}

type adminImportProblemsReq struct {
	Mode     string                   `json:"mode"`
	Problems []problems.ProblemImport `json:"problems"`
}

func (h *Handlers) AdminImportProblems(w http.ResponseWriter, r *http.Request) {
	var raw json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request")
		return
	}

	req := adminImportProblemsReq{Mode: string(problems.ImportModeSkip)}
	if err := json.Unmarshal(raw, &req); err != nil || len(req.Problems) == 0 {
		var items []problems.ProblemImport
		if arrErr := json.Unmarshal(raw, &items); arrErr != nil {
			response.Error(w, http.StatusBadRequest, "Expected { mode, problems } or a raw problem array")
			return
		}
		req.Problems = items
	}
	if len(req.Problems) == 0 {
		response.Error(w, http.StatusBadRequest, "No problems provided")
		return
	}

	for i := range req.Problems {
		prepareProblemForSave(&req.Problems[i].Problem)
	}

	result, err := h.Problems.ImportProblems(r.Context(), req.Problems, problems.ImportMode(req.Mode))
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Problems imported", result)
}

func prepareProblemForSave(p *models.Problem) {
	if p.StarterCode == nil {
		p.StarterCode = map[string]string{}
	}
	if p.Signature.FuncName != "" && len(p.Signature.Params) == 0 {
		for _, v := range p.InputSpec {
			if v.PassToFunc {
				p.Signature.Params = append(p.Signature.Params, v.Name)
			}
		}
	}
	// Competitive-mode syntax boilerplate (bare language keys, e.g. "python"):
	// fill in only where the admin didn't already provide one.
	for lang, tmpl := range judge.AllCompetitiveTemplates() {
		if _, exists := p.StarterCode[lang]; !exists {
			p.StarterCode[lang] = tmpl
		}
	}
	// Practice-mode function stub (_practice keys, e.g. "python_practice"):
	// only for problems that have declared a signature, same rule - don't
	// clobber anything explicitly supplied.
	if p.Signature.FuncName != "" {
		for lang, code := range judge.GenerateAllStarterCode(p.InputSpec, p.Signature) {
			if _, exists := p.StarterCode[lang]; !exists {
				p.StarterCode[lang] = code
			}
		}
	}
}

func (h *Handlers) AdminUpdateProblem(w http.ResponseWriter, r *http.Request) {
	problemID := chi.URLParam(r, "id")
	var update map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request")
		return
	}
	p, err := h.Problems.UpdateProblem(r.Context(), problemID, update)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	// If this update touched the signature or input spec, and the admin
	// didn't also hand-supply new starter code in the same request,
	// regenerate it so the editor stub stays in sync with the wrapper.
	_, touchedSig := update["signature"]
	_, touchedSpec := update["inputSpec"]
	_, touchedStarter := update["starterCode"]
	if (touchedSig || touchedSpec) && !touchedStarter && p.Signature.FuncName != "" {
		p.StarterCode = judge.GenerateAllStarterCode(p.InputSpec, p.Signature)
		p, err = h.Problems.UpdateProblem(r.Context(), problemID, map[string]interface{}{
			"starterCode": p.StarterCode,
		})
		if err != nil {
			response.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
	}
	response.JSON(w, http.StatusOK, "Problem updated", p)
}

func (h *Handlers) AdminDeleteProblem(w http.ResponseWriter, r *http.Request) {
	if err := h.Problems.DeleteProblem(r.Context(), chi.URLParam(r, "id")); err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Problem deleted", nil)
}

func (h *Handlers) AdminGetTestCases(w http.ResponseWriter, r *http.Request) {
	list, err := h.Problems.GetTestCases(r.Context(), chi.URLParam(r, "id"), false)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Test cases fetched", list)
}

func (h *Handlers) AdminAddTestCase(w http.ResponseWriter, r *http.Request) {
	var tc models.TestCase
	if err := json.NewDecoder(r.Body).Decode(&tc); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request")
		return
	}
	tc.ProblemID = chi.URLParam(r, "id")
	if tc.Weight == 0 {
		tc.Weight = 10
	}
	created, err := h.Problems.AddTestCase(r.Context(), &tc)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	response.JSON(w, http.StatusCreated, "Test case added", created)
}

func (h *Handlers) AdminDeleteTestCase(w http.ResponseWriter, r *http.Request) {
	id, err := primitive.ObjectIDFromHex(chi.URLParam(r, "tcId"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid id")
		return
	}
	if err := h.Problems.DeleteTestCase(r.Context(), id); err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Test case deleted", nil)
}

func (h *Handlers) AdminStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.Duel.GetAdminStats(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Admin stats", stats)
}

func (h *Handlers) AdminActiveMatches(w http.ResponseWriter, r *http.Request) {
	matches, err := h.Duel.ListActiveMatches(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, "Active matches", matches)
}

func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	response.JSON(w, http.StatusOK, "OK", map[string]string{"status": "healthy"})
}
