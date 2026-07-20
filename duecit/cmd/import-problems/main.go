package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/duecit/duecit/internal/config"
	"github.com/duecit/duecit/internal/database"
	"github.com/duecit/duecit/internal/judge"
	"github.com/duecit/duecit/internal/models"
	"github.com/duecit/duecit/internal/problems"
	"github.com/joho/godotenv"
)

type importFile struct {
	Mode     string                   `json:"mode"`
	Problems []problems.ProblemImport `json:"problems"`
}

func main() {
	mode := flag.String("mode", string(problems.ImportModeSkip), "import mode: skip or overwrite")
	flag.Parse()
	if flag.NArg() == 0 {
		log.Fatal("usage: go run ./cmd/import-problems [-mode=skip|overwrite] problems/all_easy.json [more.json...]")
	}

	_ = godotenv.Load()
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	db, err := database.ConnectMongo(ctx, cfg.MongoURI, cfg.MongoDB)
	if err != nil {
		log.Fatalf("MongoDB: %v", err)
	}

	service := problems.NewService(db)
	total := problems.ImportResult{}

	for _, path := range flag.Args() {
		items, err := readImportFile(path)
		if err != nil {
			log.Fatalf("%s: %v", path, err)
		}
		for i := range items {
			prepareProblemForSave(&items[i].Problem)
		}
		result, err := service.ImportProblems(ctx, items, problems.ImportMode(*mode))
		if err != nil {
			log.Fatalf("%s: %v", path, err)
		}
		total.Created += result.Created
		total.Overwritten += result.Overwritten
		total.Skipped += result.Skipped
		total.Failed += result.Failed
		total.Items = append(total.Items, result.Items...)
		fmt.Printf("%s: created=%d overwritten=%d skipped=%d failed=%d\n", path, result.Created, result.Overwritten, result.Skipped, result.Failed)
	}

	fmt.Printf("total: created=%d overwritten=%d skipped=%d failed=%d\n", total.Created, total.Overwritten, total.Skipped, total.Failed)
	for _, item := range total.Items {
		if item.Status == "failed" {
			fmt.Printf("failed %s: %s\n", item.ProblemID, item.Error)
		}
	}
}

func readImportFile(path string) ([]problems.ProblemImport, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var wrapped importFile
	if err := json.Unmarshal(raw, &wrapped); err == nil && len(wrapped.Problems) > 0 {
		return wrapped.Problems, nil
	}

	var items []problems.ProblemImport
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, fmt.Errorf("expected a raw problem array or { problems: [...] }: %w", err)
	}
	return items, nil
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
	for lang, tmpl := range judge.AllCompetitiveTemplates() {
		if _, exists := p.StarterCode[lang]; !exists {
			p.StarterCode[lang] = tmpl
		}
	}
	if p.Signature.FuncName != "" {
		for lang, code := range judge.GenerateAllStarterCode(p.InputSpec, p.Signature) {
			if _, exists := p.StarterCode[lang]; !exists {
				p.StarterCode[lang] = code
			}
		}
	}
}
