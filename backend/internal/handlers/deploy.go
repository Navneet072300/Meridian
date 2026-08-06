package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"meridian/internal/db"
	"meridian/internal/services"
)

func DeployList(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !db.Available() {
		writeJSON(w, 200, map[string]interface{}{"configs": []interface{}{}})
		return
	}

	rows, _ := db.Pool.Query(r.Context(),
		`SELECT id, repo_full_name, branch, language, framework, ci_tool, registry,
		        secrets_manager, deploy_target, port, created_at
		 FROM deploy_configs WHERE user_id=$1 ORDER BY created_at DESC`,
		uid,
	)
	defer rows.Close()

	configs := []map[string]interface{}{}
	for rows.Next() {
		var id, port int
		var repo, branch, lang, fw, ci, reg, sm, dt string
		var createdAt time.Time
		rows.Scan(&id, &repo, &branch, &lang, &fw, &ci, &reg, &sm, &dt, &port, &createdAt)
		configs = append(configs, map[string]interface{}{
			"id":              id,
			"repo_full_name":  repo,
			"branch":          branch,
			"language":        lang,
			"framework":       fw,
			"ci_tool":         ci,
			"registry":        reg,
			"secrets_manager": sm,
			"deploy_target":   dt,
			"port":            port,
			"created_at":      createdAt.Format(time.RFC3339),
		})
	}
	writeJSON(w, 200, map[string]interface{}{"configs": configs})
}

func DeployCreate(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	var req struct {
		RepoFullName   string `json:"repo_full_name"`
		Branch         string `json:"branch"`
		Language       string `json:"language"`
		Framework      string `json:"framework"`
		CITool         string `json:"ci_tool"`
		Registry       string `json:"registry"`
		SecretsManager string `json:"secrets_manager"`
		DeployTarget   string `json:"deploy_target"`
		Port           int    `json:"port"`
	}
	req.Branch = "main"
	req.Port = 8080
	json.NewDecoder(r.Body).Decode(&req)

	var id int
	var createdAt time.Time
	db.Pool.QueryRow(r.Context(),
		`INSERT INTO deploy_configs (user_id, repo_full_name, branch, language, framework, ci_tool, registry, secrets_manager, deploy_target, port)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, created_at`,
		uid, req.RepoFullName, req.Branch, req.Language, req.Framework, req.CITool, req.Registry, req.SecretsManager, req.DeployTarget, req.Port,
	).Scan(&id, &createdAt)

	writeJSON(w, 201, map[string]interface{}{"id": id, "created_at": createdAt.Format(time.RFC3339)})
}

func DeployGenerate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Prompt  string   `json:"prompt"`
		Context []string `json:"context"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid request")
		return
	}

	sseHeaders(w)

	var buf bytes.Buffer
	err := services.AI.StreamDevops(r.Context(), &buf, req.Prompt, []string{"CI/CD", "Docker"}, "")
	content := buf.String()
	if err != nil {
		sseWrite(w, map[string]interface{}{"error": err.Error(), "done": true})
		return
	}
	for i := 0; i < len(content); i += 64 {
		end := i + 64
		if end > len(content) {
			end = len(content)
		}
		sseWrite(w, map[string]interface{}{"chunk": content[i:end], "done": false})
	}
	sseWrite(w, map[string]interface{}{"done": true})
}

func DeployDelete(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if db.Available() {
		db.Pool.Exec(r.Context(),
			`DELETE FROM deploy_configs WHERE id=$1 AND user_id=$2`, id, uid,
		)
	}
	w.WriteHeader(204)
}
