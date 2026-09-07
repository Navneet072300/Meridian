package handlers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"meridian/internal/auth"
	"meridian/internal/config"
	"meridian/internal/db"
	"meridian/internal/launch"
	"meridian/internal/services"
)

type launchUserKey struct{}

var sourceSlots = make(chan struct{}, 2)

func launchUser(r *http.Request) int { return r.Context().Value(launchUserKey{}).(int) }

// Agent credentials only authorize /launch. They never grant access to the
// legacy cluster, account, or credential endpoints.
func LaunchAccess(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !requireDB(w) {
			return
		}
		var uid int
		bearer := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if strings.HasPrefix(bearer, "mrd_launch_") {
			e := db.Pool.QueryRow(r.Context(), `SELECT user_id FROM launch_agent_keys WHERE key_hash=$1 AND expires_at>now()`, auth.HashToken(bearer)).Scan(&uid)
			if e != nil {
				writeError(w, 401, "Agent key is invalid or expired")
				return
			}
			if strings.HasPrefix(r.URL.Path, "/api/launch/agent-keys") {
				writeError(w, 403, "Sign in to manage agent access")
				return
			}
		} else {
			var ok bool
			uid, ok = requireUser(w, r)
			if !ok {
				return
			}
			var active bool
			db.Pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM user_sessions WHERE user_id=$1 AND session_token_hash=$2 AND NOT is_revoked)`, uid, auth.HashToken(getToken(r))).Scan(&active)
			if !active {
				writeError(w, 401, "Session expired; sign in again")
				return
			}
			if r.Method != "GET" && r.Method != "HEAD" {
				origin := r.Header.Get("Origin")
				if origin == "" || !allowedOrigin(origin) {
					writeError(w, 403, "Request must originate from Meridian")
					return
				}
			}
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), launchUserKey{}, uid)))
	})
}

func allowedOrigin(s string) bool {
	if s == strings.TrimRight(config.FrontendURL, "/") {
		return true
	}
	return os.Getenv("APP_ENV") != "production" && (s == "http://localhost:5173" || s == "http://localhost:3000")
}
func launchDecode(w http.ResponseWriter, r *http.Request, v interface{}) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(v) != nil {
		writeError(w, 400, "Invalid request fields")
		return false
	}
	var extra interface{}
	if d.Decode(&extra) != io.EOF {
		writeError(w, 400, "Expected one JSON object")
		return false
	}
	return true
}
func projectOwner(r *http.Request) (string, bool) {
	id := chi.URLParam(r, "project")
	var found string
	e := db.Pool.QueryRow(r.Context(), `SELECT id::text FROM launch_projects WHERE id::text=$1 AND user_id=$2`, id, launchUser(r)).Scan(&found)
	return found, e == nil
}

func LaunchStatus(w http.ResponseWriter, r *http.Request) {
	var online bool
	db.Pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM launch_worker_health WHERE last_seen>now()-interval '45 seconds')`).Scan(&online)
	writeJSON(w, 200, map[string]interface{}{"worker_online": online, "max_archive_mb": 32, "runtimes": []string{"Node.js", "Python (FastAPI)", "Go", "Static HTML", "Dockerfile"}, "github_private": false, "automatic_databases": false})
}
func LaunchProjects(w http.ResponseWriter, r *http.Request) {
	rows, e := db.Pool.Query(r.Context(), `SELECT id::text,name,created_at FROM launch_projects WHERE user_id=$1 ORDER BY created_at DESC`, launchUser(r))
	if e != nil {
		writeError(w, 500, "Could not load projects")
		return
	}
	defer rows.Close()
	out := []map[string]interface{}{}
	for rows.Next() {
		var id, name string
		var created time.Time
		if rows.Scan(&id, &name, &created) != nil {
			writeError(w, 500, "Could not read project")
			return
		}
		out = append(out, map[string]interface{}{"id": id, "name": name, "created_at": created})
	}
	if rows.Err() != nil {
		writeError(w, 500, "Could not load projects")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"projects": out})
}
func LaunchCreateProject(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if !launchDecode(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 1 || len(req.Name) > 80 {
		writeError(w, 400, "Name must be between 1 and 80 characters")
		return
	}
	enc, e := services.Encrypt("{}")
	if e != nil {
		writeError(w, 503, "Secret encryption is not configured")
		return
	}
	tx, e := db.Pool.Begin(r.Context())
	if e != nil {
		writeError(w, 500, "Could not create project")
		return
	}
	defer tx.Rollback(r.Context())
	var locked int
	if e = tx.QueryRow(r.Context(), `SELECT id FROM users WHERE id=$1 FOR UPDATE`, launchUser(r)).Scan(&locked); e != nil {
		writeError(w, 401, "Account unavailable")
		return
	}
	var count int
	tx.QueryRow(r.Context(), `SELECT count(*) FROM launch_projects WHERE user_id=$1`, locked).Scan(&count)
	if count >= 20 {
		writeError(w, 409, "The beta supports up to 20 projects per account")
		return
	}
	var id string
	if e = tx.QueryRow(r.Context(), `INSERT INTO launch_projects(user_id,name,env_encrypted) VALUES($1,$2,$3) RETURNING id::text`, locked, req.Name, enc).Scan(&id); e != nil {
		writeError(w, 500, "Could not create project")
		return
	}
	if tx.Commit(r.Context()) != nil {
		writeError(w, 500, "Could not save project")
		return
	}
	writeJSON(w, 201, map[string]string{"id": id, "name": req.Name})
}

// ZIP bytes are received directly, avoiding multipart temp files and base64 copies.
func LaunchUpload(w http.ResponseWriter, r *http.Request) {
	select {
	case sourceSlots <- struct{}{}:
		defer func() { <-sourceSlots }()
	default:
		writeError(w, 429, "Uploads are busy. Try again shortly.")
		return
	}
	id, ok := projectOwner(r)
	if !ok {
		writeError(w, 404, "Project not found")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, launch.MaxArchive)
	data, e := io.ReadAll(r.Body)
	if e != nil {
		writeError(w, 413, "ZIP must be smaller than 32 MB")
		return
	}
	saveRevision(w, r, id, data)
}
func saveRevision(w http.ResponseWriter, r *http.Request, id string, data []byte) {
	_, plan, e := launch.Inspect(data)
	if e != nil {
		writeError(w, 400, e.Error())
		return
	}
	tx, e := db.Pool.Begin(r.Context())
	if e != nil {
		writeError(w, 500, "Could not save upload")
		return
	}
	defer tx.Rollback(r.Context())
	var locked string
	if tx.QueryRow(r.Context(), `SELECT id::text FROM launch_projects WHERE id=$1 FOR UPDATE`, id).Scan(&locked) != nil {
		writeError(w, 404, "Project not found")
		return
	}
	var n int
	if tx.QueryRow(r.Context(), `SELECT count(*) FROM launch_revisions WHERE project_id=$1`, id).Scan(&n) != nil {
		writeError(w, 500, "Could not inspect revisions")
		return
	}
	if n >= 30 {
		writeError(w, 409, "Beta source retention limit reached (30 uploads per project)")
		return
	}
	key, e := launch.StoreSource(data)
	if e != nil {
		writeError(w, 503, "Source storage is unavailable")
		return
	}
	p, _ := json.Marshal(plan)
	var rev string
	if tx.QueryRow(r.Context(), `INSERT INTO launch_revisions(project_id,source_key,plan) VALUES($1,$2,$3) RETURNING id::text`, id, key, p).Scan(&rev) != nil {
		writeError(w, 500, "Could not save revision")
		return
	}
	if tx.Commit(r.Context()) != nil {
		writeError(w, 500, "Could not save revision")
		return
	}
	writeJSON(w, 201, map[string]interface{}{"revision_id": rev, "plan": plan})
}

var githubName = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)

func LaunchGitHub(w http.ResponseWriter, r *http.Request) {
	select {
	case sourceSlots <- struct{}{}:
		defer func() { <-sourceSlots }()
	default:
		writeError(w, 429, "Imports are busy. Try again shortly.")
		return
	}
	id, ok := projectOwner(r)
	if !ok {
		writeError(w, 404, "Project not found")
		return
	}
	var req struct {
		Repository string `json:"repository"`
		Ref        string `json:"ref"`
	}
	if !launchDecode(w, r, &req) {
		return
	}
	repo := strings.TrimSuffix(strings.TrimPrefix(strings.TrimSpace(req.Repository), "https://github.com/"), ".git")
	if !githubName.MatchString(repo) || strings.Contains(repo, "..") {
		writeError(w, 400, "Use a public GitHub repository such as owner/repository")
		return
	}
	if req.Ref == "" {
		req.Ref = "HEAD"
	}
	if len(req.Ref) > 200 || strings.ContainsAny(req.Ref, "\r\n?#") {
		writeError(w, 400, "Invalid branch or commit")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()
	remote, _ := http.NewRequestWithContext(ctx, "GET", "https://codeload.github.com/"+repo+"/zip/"+url.PathEscape(req.Ref), nil)
	client := &http.Client{Timeout: 45 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	resp, e := client.Do(remote)
	if e != nil {
		writeError(w, 502, "GitHub could not be reached")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		writeError(w, 400, "Repository or branch unavailable. For private repositories, upload a ZIP or use your coding agent.")
		return
	}
	data, e := io.ReadAll(io.LimitReader(resp.Body, launch.MaxArchive+1))
	if e != nil || len(data) > launch.MaxArchive {
		writeError(w, 413, "Repository archive is too large")
		return
	}
	saveRevision(w, r, id, data)
}

func LaunchProject(w http.ResponseWriter, r *http.Request) {
	id, ok := projectOwner(r)
	if !ok {
		writeError(w, 404, "Project not found")
		return
	}
	var enc string
	if db.Pool.QueryRow(r.Context(), `SELECT env_encrypted FROM launch_projects WHERE id=$1`, id).Scan(&enc) != nil {
		writeError(w, 500, "Could not read project")
		return
	}
	plain, e := services.Decrypt(enc)
	if e != nil {
		writeError(w, 500, "Could not decrypt settings")
		return
	}
	env := map[string]string{}
	if json.Unmarshal([]byte(plain), &env) != nil {
		writeError(w, 500, "Invalid settings")
		return
	}
	keys := []string{}
	for k := range env {
		keys = append(keys, k)
	}
	revisions := []map[string]interface{}{}
	rows, e := db.Pool.Query(r.Context(), `SELECT id::text,plan,created_at FROM launch_revisions WHERE project_id=$1 ORDER BY created_at DESC`, id)
	if e != nil {
		writeError(w, 500, "Could not read revisions")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var rev string
		var p json.RawMessage
		var at time.Time
		if rows.Scan(&rev, &p, &at) != nil {
			writeError(w, 500, "Could not read revision")
			return
		}
		revisions = append(revisions, map[string]interface{}{"id": rev, "plan": p, "created_at": at})
	}
	if rows.Err() != nil {
		writeError(w, 500, "Could not read revisions")
		return
	}
	deployments, e := listLaunchDeployments(r, id)
	if e != nil {
		writeError(w, 500, "Could not read deployments")
		return
	}
	writeJSON(w, 200, map[string]interface{}{"id": id, "environment_keys": keys, "revisions": revisions, "deployments": deployments})
}
func LaunchEnvironment(w http.ResponseWriter, r *http.Request) {
	id, ok := projectOwner(r)
	if !ok {
		writeError(w, 404, "Project not found")
		return
	}
	var req struct {
		Values map[string]string `json:"values"`
		Remove []string          `json:"remove"`
	}
	if !launchDecode(w, r, &req) {
		return
	}
	if e := launch.ValidateEnv(req.Values); e != nil {
		writeError(w, 400, e.Error())
		return
	}
	tx, e := db.Pool.Begin(r.Context())
	if e != nil {
		writeError(w, 500, "Could not save settings")
		return
	}
	defer tx.Rollback(r.Context())
	var enc string
	if tx.QueryRow(r.Context(), `SELECT env_encrypted FROM launch_projects WHERE id=$1 FOR UPDATE`, id).Scan(&enc) != nil {
		writeError(w, 500, "Could not read settings")
		return
	}
	plain, e := services.Decrypt(enc)
	if e != nil {
		writeError(w, 500, "Could not decrypt settings")
		return
	}
	values := map[string]string{}
	if json.Unmarshal([]byte(plain), &values) != nil {
		writeError(w, 500, "Invalid settings")
		return
	}
	for _, k := range req.Remove {
		delete(values, k)
	}
	for k, v := range req.Values {
		values[k] = v
	}
	if e = launch.ValidateEnv(values); e != nil {
		writeError(w, 400, e.Error())
		return
	}
	b, _ := json.Marshal(values)
	enc, e = services.Encrypt(string(b))
	if e != nil {
		writeError(w, 503, "Could not encrypt settings")
		return
	}
	if _, e = tx.Exec(r.Context(), `UPDATE launch_projects SET env_encrypted=$2 WHERE id=$1`, id, enc); e != nil {
		writeError(w, 500, "Could not save settings")
		return
	}
	if tx.Commit(r.Context()) != nil {
		writeError(w, 500, "Could not save settings")
		return
	}
	writeJSON(w, 200, map[string]bool{"saved": true})
}

func LaunchDeploy(w http.ResponseWriter, r *http.Request) {
	id, ok := projectOwner(r)
	if !ok {
		writeError(w, 404, "Project not found")
		return
	}
	var req struct {
		Revision    string `json:"revision_id"`
		Environment string `json:"environment"`
		Port        int    `json:"port"`
		Confirmed   bool   `json:"confirmed"`
		Rollback    string `json:"rollback_id"`
	}
	if !launchDecode(w, r, &req) {
		return
	}
	if req.Environment != "preview" && req.Environment != "production" {
		writeError(w, 400, "Choose preview or production")
		return
	}
	if req.Environment == "production" && !req.Confirmed {
		writeError(w, 409, "Confirm publication to production")
		return
	}
	// Agent keys can build previews, but publishing always happens in the UI.
	if req.Environment == "production" && strings.HasPrefix(r.Header.Get("Authorization"), "Bearer mrd_launch_") {
		writeError(w, 403, "Publish production from the Meridian dashboard")
		return
	}
	key := r.Header.Get("Idempotency-Key")
	if len(key) < 8 || len(key) > 128 {
		writeError(w, 400, "Provide an Idempotency-Key between 8 and 128 characters")
		return
	}
	var existing string
	if db.Pool.QueryRow(r.Context(), `SELECT id::text FROM launch_deployments WHERE project_id=$1 AND idempotency_key=$2`, id, key).Scan(&existing) == nil {
		writeJSON(w, 200, map[string]string{"id": existing})
		return
	}
	var online bool
	db.Pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM launch_worker_health WHERE last_seen>now()-interval '45 seconds')`).Scan(&online)
	if !online {
		writeError(w, 503, "Deployment worker is offline. Your source is saved; try again when hosting is connected.")
		return
	}
	var enc, image string
	if req.Rollback != "" { // Reuse the prior immutable image AND configuration snapshot.
		e := db.Pool.QueryRow(r.Context(), `SELECT revision_id::text,env_encrypted,image,port FROM launch_deployments WHERE id::text=$1 AND project_id=$2 AND status='healthy' AND environment=$3`, req.Rollback, id, req.Environment).Scan(&req.Revision, &enc, &image, &req.Port)
		if e != nil || image == "" {
			writeError(w, 400, "Choose a healthy release from this environment")
			return
		}
	} else {
		if db.Pool.QueryRow(r.Context(), `SELECT env_encrypted FROM launch_projects WHERE id=$1`, id).Scan(&enc) != nil {
			writeError(w, 500, "Could not read configuration")
			return
		}
	}
	var plan launch.Plan
	var raw []byte
	if db.Pool.QueryRow(r.Context(), `SELECT plan FROM launch_revisions WHERE id::text=$1 AND project_id=$2`, req.Revision, id).Scan(&raw) != nil {
		writeError(w, 404, "Source revision not found")
		return
	}
	if json.Unmarshal(raw, &plan) != nil {
		writeError(w, 500, "Invalid launch plan")
		return
	}
	if len(plan.Blockers) > 0 {
		writeError(w, 422, strings.Join(plan.Blockers, " "))
		return
	}
	if req.Port == 0 {
		req.Port = plan.Port
	}
	if req.Port < 1024 || req.Port > 65535 {
		writeError(w, 400, "Use a port from 1024 to 65535")
		return
	}
	plain, e := services.Decrypt(enc)
	if e != nil {
		writeError(w, 500, "Could not decrypt configuration")
		return
	}
	env := map[string]string{}
	if json.Unmarshal([]byte(plain), &env) != nil {
		writeError(w, 500, "Invalid configuration")
		return
	}
	for _, k := range plan.Required {
		if env[k] == "" {
			writeError(w, 422, "Add the required environment variable: "+k)
			return
		}
	}
	var dep string
	e = db.Pool.QueryRow(r.Context(), `INSERT INTO launch_deployments(project_id,revision_id,environment,env_encrypted,port,image,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id::text`, id, req.Revision, req.Environment, enc, req.Port, image, key).Scan(&dep)
	if e != nil {
		writeError(w, 409, "A deployment is already in progress; refresh the project before retrying")
		return
	}
	writeJSON(w, 202, map[string]string{"id": dep, "status": "queued"})
}
func listLaunchDeployments(r *http.Request, id string) ([]map[string]interface{}, error) {
	rows, e := db.Pool.Query(r.Context(), `SELECT id::text,revision_id::text,environment,status,url,message,created_at,updated_at FROM launch_deployments WHERE project_id=$1 ORDER BY updated_at DESC LIMIT 100`, id)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []map[string]interface{}{}
	for rows.Next() {
		var dep, rev, env, status, u, msg string
		var at, updated time.Time
		if e = rows.Scan(&dep, &rev, &env, &status, &u, &msg, &at, &updated); e != nil {
			return nil, e
		}
		out = append(out, map[string]interface{}{"id": dep, "revision_id": rev, "environment": env, "status": status, "url": u, "message": msg, "created_at": at, "updated_at": updated})
	}
	return out, rows.Err()
}
func LaunchEvents(w http.ResponseWriter, r *http.Request) {
	id, ok := projectOwner(r)
	if !ok {
		writeError(w, 404, "Project not found")
		return
	}
	dep := chi.URLParam(r, "deployment")
	var found string
	if db.Pool.QueryRow(r.Context(), `SELECT id::text FROM launch_deployments WHERE id::text=$1 AND project_id=$2`, dep, id).Scan(&found) != nil {
		writeError(w, 404, "Deployment not found")
		return
	}
	rows, e := db.Pool.Query(r.Context(), `SELECT id,message,created_at FROM launch_events WHERE deployment_id=$1 ORDER BY id DESC LIMIT 200`, found)
	if e != nil {
		writeError(w, 500, "Could not load events")
		return
	}
	defer rows.Close()
	events := []map[string]interface{}{}
	for rows.Next() {
		var seq int64
		var msg string
		var at time.Time
		if rows.Scan(&seq, &msg, &at) != nil {
			writeError(w, 500, "Could not read event")
			return
		}
		events = append(events, map[string]interface{}{"id": seq, "message": msg, "created_at": at})
	}
	writeJSON(w, 200, map[string]interface{}{"events": events})
}
func LaunchCancel(w http.ResponseWriter, r *http.Request) {
	id, ok := projectOwner(r)
	if !ok {
		writeError(w, 404, "Project not found")
		return
	}
	tag, e := db.Pool.Exec(r.Context(), `UPDATE launch_deployments SET status='cancelled',message='Cancelled before execution',updated_at=now() WHERE id::text=$1 AND project_id=$2 AND status='queued'`, chi.URLParam(r, "deployment"), id)
	if e != nil || tag.RowsAffected() != 1 {
		writeError(w, 409, "Only queued deployments can be cancelled")
		return
	}
	writeJSON(w, 200, map[string]bool{"cancelled": true})
}

func LaunchAgentKeys(w http.ResponseWriter, r *http.Request) {
	uid := launchUser(r)
	if r.Method == "DELETE" {
		_, e := db.Pool.Exec(r.Context(), `DELETE FROM launch_agent_keys WHERE user_id=$1`, uid)
		if e != nil {
			writeError(w, 500, "Could not revoke keys")
			return
		}
		w.WriteHeader(204)
		return
	}
	if r.Method == "GET" {
		var n int
		db.Pool.QueryRow(r.Context(), `SELECT count(*) FROM launch_agent_keys WHERE user_id=$1 AND expires_at>now()`, uid).Scan(&n)
		writeJSON(w, 200, map[string]int{"active_keys": n})
		return
	}
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		writeError(w, 500, "Could not create key")
		return
	}
	key := "mrd_launch_" + hex.EncodeToString(b)
	sum := sha256.Sum256([]byte(key))
	_, e := db.Pool.Exec(r.Context(), `INSERT INTO launch_agent_keys(user_id,key_hash) VALUES($1,$2)`, uid, hex.EncodeToString(sum[:]))
	if e != nil {
		writeError(w, 500, "Could not store key")
		return
	}
	writeJSON(w, 201, map[string]string{"key": key, "expires_in": "30 days", "scope": "Your projects: uploads, settings and previews; no production publishing"})
}
