package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"meridian/internal/auth"
	"meridian/internal/db"
)

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"detail": msg})
}

func getToken(r *http.Request) string {
	cookie := ""
	if c, err := r.Cookie(auth.SessionCookie); err == nil {
		cookie = c.Value
	}
	header := r.Header.Get("Authorization")
	return auth.TokenFromRequest(cookie, strings.TrimPrefix(header, "Bearer "))
}

func getUserID(r *http.Request) (int, bool) {
	token := getToken(r)
	if token == "" {
		return 0, false
	}
	return auth.ParseToken(token)
}

func requireUser(w http.ResponseWriter, r *http.Request) (int, bool) {
	uid, ok := getUserID(r)
	if !ok || uid == 0 {
		writeError(w, 401, "Not authenticated")
		return 0, false
	}
	if !db.Available() {
		writeError(w, 503, "Database unavailable")
		return 0, false
	}
	var active bool
	if err := db.Pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.user_id=$1 AND s.session_token_hash=$2 AND NOT s.is_revoked)`, uid, auth.HashToken(getToken(r))).Scan(&active); err != nil || !active {
		writeError(w, 401, "Session expired; sign in again")
		return 0, false
	}
	return uid, true
}

func requireDB(w http.ResponseWriter) bool {
	if !db.Available() {
		writeError(w, 503, "Database unavailable")
		return false
	}
	return true
}

func setSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.SessionCookie,
		Value:    token,
		HttpOnly: true,
		Secure:   os.Getenv("APP_ENV") == "production",
		MaxAge:   60 * 60 * 24 * 7,
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	})
}

func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:   auth.SessionCookie,
		Value:  "",
		MaxAge: -1,
		Path:   "/",
	})
}

func sseWrite(w http.ResponseWriter, data interface{}) {
	b, _ := json.Marshal(data)
	fmt.Fprintf(w, "data: %s\n\n", b)
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
}

func sseWriteRaw(w http.ResponseWriter, data string) {
	fmt.Fprintf(w, "data: %s\n\n", data)
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
}

func sseHeaders(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
}

func clientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return strings.Split(ip, ",")[0]
	}
	return strings.Split(r.RemoteAddr, ":")[0]
}
