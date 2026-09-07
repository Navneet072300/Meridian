package handlers

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"meridian/internal/auth"
	"meridian/internal/config"
	"meridian/internal/db"
	"meridian/internal/launch"
)

func TestLaunchIntegration(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL for PostgreSQL integration tests")
	}
	ctx := context.Background()
	admin, e := pgxpool.New(ctx, dsn)
	if e != nil {
		t.Fatal(e)
	}
	defer admin.Close()
	schema := fmt.Sprintf("meridian_test_%d", time.Now().UnixNano())
	identifier := pgx.Identifier{schema}.Sanitize()
	if _, e = admin.Exec(ctx, "CREATE SCHEMA "+identifier); e != nil {
		t.Fatal(e)
	}
	defer admin.Exec(ctx, "DROP SCHEMA "+identifier+" CASCADE")
	pc, e := pgxpool.ParseConfig(dsn)
	if e != nil {
		t.Fatal(e)
	}
	pc.ConnConfig.RuntimeParams["search_path"] = schema
	pool, e := pgxpool.NewWithConfig(ctx, pc)
	if e != nil {
		t.Fatal(e)
	}
	defer pool.Close()
	old := db.Pool
	db.Pool = pool
	defer func() { db.Pool = old }()
	_, e = pool.Exec(ctx, `CREATE TABLE users(id SERIAL PRIMARY KEY,email TEXT); CREATE TABLE user_sessions(user_id INTEGER,session_token_hash TEXT,is_revoked BOOLEAN DEFAULT FALSE);CREATE TABLE otp_codes(id SERIAL PRIMARY KEY,contact TEXT,code TEXT,used BOOLEAN DEFAULT FALSE,expires_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT now())`)
	if e != nil {
		t.Fatal(e)
	}
	if e = launch.Migrate(ctx); e != nil {
		t.Fatal(e)
	}
	if e = launch.Migrate(ctx); e != nil {
		t.Fatal("non-idempotent migration:", e)
	}
	t.Setenv("SOURCE_DIR", t.TempDir())
	oldEnc := config.EncryptionKey
	config.EncryptionKey = "12345678901234567890123456789012"
	defer func() { config.EncryptionKey = oldEnc }()
	t.Setenv("APP_ENV", "development")
	t.Setenv("BETA_ALLOWED_EMAILS", "otp@example.test")
	oldEmailKey := config.ResendAPIKey
	config.ResendAPIKey = ""
	defer func() { config.ResendAPIKey = oldEmailKey }()
	for i := 0; i < 4; i++ {
		req := httptest.NewRequest("POST", "/api/auth/otp/send", bytes.NewBufferString(`{"contact":"OTP@example.test"}`))
		w := httptest.NewRecorder()
		OTPSend(w, req)
		expected := 200
		if i == 3 {
			expected = 429
		}
		if w.Code != expected {
			t.Fatalf("OTP send %d: got %d: %s", i, w.Code, w.Body.String())
		}
	}
	var currentCode string
	if err := pool.QueryRow(ctx, `SELECT code FROM otp_codes WHERE contact='otp@example.test' AND used=FALSE`).Scan(&currentCode); err != nil {
		t.Fatal(err)
	}
	if !verifyOTP(ctx, "otp@example.test", currentCode) || verifyOTP(ctx, "otp@example.test", currentCode) {
		t.Fatal("OTP must work exactly once")
	}
	if _, err := pool.Exec(ctx, `INSERT INTO otp_codes(contact,code,expires_at) VALUES('attempts@example.test','123456',now()+interval '10 minutes')`); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 5; i++ {
		if verifyOTP(ctx, "attempts@example.test", "000000") {
			t.Fatal("incorrect code accepted")
		}
	}
	if verifyOTP(ctx, "attempts@example.test", "123456") {
		t.Fatal("code accepted after attempt limit")
	}
	denied := httptest.NewRecorder()
	OTPSend(denied, httptest.NewRequest("POST", "/api/auth/otp/send", bytes.NewBufferString(`{"contact":"outside@example.test"}`)))
	if denied.Code != 403 {
		t.Fatal("non-invited email accepted")
	}
	tokens := []string{}
	for i := 0; i < 2; i++ {
		var uid int
		if e = pool.QueryRow(ctx, `INSERT INTO users(email) VALUES($1) RETURNING id`, fmt.Sprintf("u%d@example.test", i)).Scan(&uid); e != nil {
			t.Fatal(e)
		}
		token, _ := auth.CreateToken(uid)
		pool.Exec(ctx, `INSERT INTO user_sessions(user_id,session_token_hash) VALUES($1,$2)`, uid, auth.HashToken(token))
		tokens = append(tokens, token)
	}
	r := chi.NewRouter()
	r.Route("/api/launch", func(r chi.Router) {
		r.Use(LaunchAccess)
		r.Post("/projects", LaunchCreateProject)
		r.Get("/projects", LaunchProjects)
		r.Get("/projects/{project}", LaunchProject)
		r.Post("/projects/{project}/sources", LaunchUpload)
		r.Put("/projects/{project}/environment", LaunchEnvironment)
		r.Post("/projects/{project}/deployments", LaunchDeploy)
		r.Get("/projects/{project}/deployments/{deployment}/events", LaunchEvents)
		r.Post("/agent-keys", LaunchAgentKeys)
	})
	request := func(user int, method, path string, body []byte, key string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, "/api/launch"+path, bytes.NewReader(body))
		req.AddCookie(&http.Cookie{Name: auth.SessionCookie, Value: tokens[user]})
		req.Header.Set("Origin", "http://localhost:3000")
		req.Header.Set("Idempotency-Key", key)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}
	decode := func(w *httptest.ResponseRecorder) map[string]interface{} {
		t.Helper()
		var v map[string]interface{}
		if e := json.Unmarshal(w.Body.Bytes(), &v); e != nil {
			t.Fatalf("bad response %s", w.Body.String())
		}
		return v
	}
	check := func(w *httptest.ResponseRecorder, status int) {
		t.Helper()
		if w.Code != status {
			t.Fatalf("wanted %d, got %d: %s", status, w.Code, w.Body.String())
		}
	}
	w := request(0, "POST", "/projects", []byte(`{"name":"hello"}`), "")
	check(w, 201)
	id := decode(w)["id"].(string)
	check(request(1, "GET", "/projects/"+id, nil, ""), 404)
	check(request(1, "PUT", "/projects/"+id+"/environment", []byte(`{"values":{"X":"secret"}}`), ""), 404)
	check(request(0, "POST", "/projects", []byte(`{"name":"bad","admin":true}`), ""), 400)
	var b bytes.Buffer
	zw := zip.NewWriter(&b)
	f, _ := zw.Create("index.html")
	f.Write([]byte("<h1>Hello</h1>"))
	zw.Close()
	check(request(1, "POST", "/projects/"+id+"/sources", b.Bytes(), ""), 404)
	w = request(0, "POST", "/projects/"+id+"/sources", b.Bytes(), "")
	check(w, 201)
	revision := decode(w)["revision_id"].(string)
	body := []byte(fmt.Sprintf(`{"revision_id":%q,"environment":"preview","port":8080}`, revision))
	check(request(0, "POST", "/projects/"+id+"/deployments", body, "test-request-1"), 503)
	pool.Exec(ctx, `INSERT INTO launch_worker_health(name,last_seen) VALUES('test',now())`)
	w = request(0, "POST", "/projects/"+id+"/deployments", body, "test-request-1")
	check(w, 202)
	deployment := decode(w)["id"].(string)
	check(request(0, "POST", "/projects/"+id+"/deployments", body, "test-request-1"), 200)
	check(request(0, "POST", "/projects/"+id+"/deployments", body, "test-request-2"), 409)
	check(request(1, "GET", "/projects/"+id+"/deployments/"+deployment+"/events", nil, ""), 404)
	w = request(0, "PUT", "/projects/"+id+"/environment", []byte(`{"values":{"DATABASE_URL":"test-secret-value"}}`), "")
	check(w, 200)
	w = request(0, "GET", "/projects/"+id, nil, "")
	check(w, 200)
	if bytes.Contains(w.Body.Bytes(), []byte("test-secret-value")) {
		t.Fatal("secret leaked")
	}
	var count int
	pool.QueryRow(ctx, `SELECT count(*) FROM launch_deployments WHERE project_id=$1`, id).Scan(&count)
	if count != 1 {
		t.Fatal("idempotency failed")
	}
	w = request(0, "POST", "/agent-keys", []byte(`{}`), "")
	check(w, 201)
	agent := decode(w)["key"].(string)
	req := httptest.NewRequest("POST", "/api/launch/projects/"+id+"/deployments", bytes.NewReader([]byte(fmt.Sprintf(`{"revision_id":%q,"environment":"production","confirmed":true}`, revision))))
	req.Header.Set("Authorization", "Bearer "+agent)
	req.Header.Set("Idempotency-Key", "production-attempt")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	check(w, 403)
	req = httptest.NewRequest("POST", "/api/launch/projects", bytes.NewReader([]byte(`{"name":"csrf"}`)))
	req.AddCookie(&http.Cookie{Name: auth.SessionCookie, Value: tokens[0]})
	req.Header.Set("Origin", "https://evil.example")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	check(w, 403)
	pool.Exec(ctx, `UPDATE user_sessions SET is_revoked=TRUE WHERE user_id=1`)
	check(request(0, "GET", "/projects", nil, ""), 401)
}
