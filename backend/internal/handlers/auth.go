package handlers

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/mail"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/pquerna/otp/totp"
	"meridian/internal/auth"
	"meridian/internal/config"
	"meridian/internal/db"
	"meridian/internal/services"
)

// ── helpers ──────────────────────────────────────────────────────────────────

func genOTP() string {
	digits := make([]byte, 6)
	for i := range digits {
		n, _ := rand.Int(rand.Reader, big.NewInt(10))
		digits[i] = byte('0') + byte(n.Int64())
	}
	return string(digits)
}

func hashAPIKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return fmt.Sprintf("%x", h)
}

func sendEmailOTP(ctx context.Context, email, code string) bool {
	if config.ResendAPIKey == "" {
		log.Printf("RESEND_API_KEY not set — OTP: %s", code)
		return true
	}
	body := map[string]interface{}{
		"from":    config.EmailFrom,
		"to":      []string{email},
		"subject": fmt.Sprintf("Your Meridian verification code: %s", code),
		"html": fmt.Sprintf(`<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fafaf8;border-radius:12px">
			<h2>Verification code</h2>
			<div style="font-size:36px;font-weight:800;letter-spacing:0.2em;color:#1a1a1a">%s</div>
			<p style="color:#666;font-size:13px">Expires in 10 minutes.</p></div>`, code),
	}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, "POST", "https://api.resend.com/emails", bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+config.ResendAPIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		log.Printf("Email provider returned HTTP %d", resp.StatusCode)
		return false
	}
	return true
}

func storeOTP(ctx context.Context, contact, code string) {
	if !db.Available() {
		return
	}
	expires := time.Now().UTC().Add(10 * time.Minute)
	db.Pool.Exec(ctx,
		`INSERT INTO otp_codes (contact, code, expires_at) VALUES ($1, $2, $3)`,
		contact, code, expires,
	)
}

func verifyOTP(ctx context.Context, contact, code string) bool {
	if !db.Available() {
		return false
	}
	var matched bool
	err := db.Pool.QueryRow(ctx, `UPDATE otp_codes SET attempts=attempts+1,used=(code=$2) WHERE id=(SELECT id FROM otp_codes WHERE contact=$1 AND used=FALSE AND expires_at>now() AND attempts<5 ORDER BY created_at DESC LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING used`, contact, code).Scan(&matched)
	return err == nil && matched
}

func getOrCreateUser(ctx context.Context, email, name, provider, providerID, avatarURL string) (*db.User, error) {
	var u db.User
	err := db.Pool.QueryRow(ctx,
		`SELECT id, email, phone, name, avatar_url, avatar_color, provider, provider_id, hashed_password,
		        email_verified, phone_verified, plan, role, totp_secret, totp_enabled, totp_pending_secret, created_at
		 FROM users WHERE email=$1`, email,
	).Scan(&u.ID, &u.Email, &u.Phone, &u.Name, &u.AvatarURL, &u.AvatarColor, &u.Provider, &u.ProviderID,
		&u.HashedPassword, &u.EmailVerified, &u.PhoneVerified, &u.Plan, &u.Role,
		&u.TOTPSecret, &u.TOTPEnabled, &u.TOTPPendingSecret, &u.CreatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		// create
		if name == "" {
			parts := strings.Split(email, "@")
			name = parts[0]
		}
		var newID int
		err2 := db.Pool.QueryRow(ctx,
			`INSERT INTO users (email, name, provider, provider_id, avatar_url, email_verified)
			 VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING id`,
			email, name, provider, nullStr(providerID), nullStr(avatarURL),
		).Scan(&newID)
		if err2 != nil {
			return nil, err2
		}
		return getUserByID(ctx, newID)
	}
	return &u, err
}

func getUserByID(ctx context.Context, id int) (*db.User, error) {
	var u db.User
	err := db.Pool.QueryRow(ctx,
		`SELECT id, email, phone, name, avatar_url, avatar_color, provider, provider_id, hashed_password,
		        email_verified, phone_verified, plan, role, totp_secret, totp_enabled, totp_pending_secret, created_at
		 FROM users WHERE id=$1`, id,
	).Scan(&u.ID, &u.Email, &u.Phone, &u.Name, &u.AvatarURL, &u.AvatarColor, &u.Provider, &u.ProviderID,
		&u.HashedPassword, &u.EmailVerified, &u.PhoneVerified, &u.Plan, &u.Role,
		&u.TOTPSecret, &u.TOTPEnabled, &u.TOTPPendingSecret, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func userToDict(u *db.User) map[string]interface{} {
	return map[string]interface{}{
		"id":             u.ID,
		"name":           u.Name,
		"email":          u.Email,
		"phone":          u.Phone,
		"avatar_url":     u.AvatarURL,
		"avatar_color":   u.AvatarColor,
		"plan":           u.Plan,
		"role":           u.Role,
		"provider":       u.Provider,
		"email_verified": u.EmailVerified,
		"phone_verified": u.PhoneVerified,
		"totp_enabled":   u.TOTPEnabled,
	}
}

func recordSession(ctx context.Context, userID int, token string, r *http.Request) error {
	if !db.Available() {
		return fmt.Errorf("database unavailable")
	}
	ua := r.Header.Get("User-Agent")
	ip := clientIP(r)
	tokenHash := auth.HashToken(token)
	deviceInfo := auth.ParseUA(ua)
	_, err := db.Pool.Exec(ctx,
		`INSERT INTO user_sessions (user_id, session_token_hash, device_info, ip_address)
		 VALUES ($1, $2, $3, $4)`,
		userID, tokenHash, deviceInfo, ip,
	)
	return err
}

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// ── Signup ────────────────────────────────────────────────────────────────────

func Signup(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid request")
		return
	}

	var exists int
	db.Pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM users WHERE email=$1`, req.Email).Scan(&exists)
	if exists > 0 {
		writeError(w, 409, "Email already registered")
		return
	}

	hashed, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, 500, "Internal error")
		return
	}

	name := req.Name
	if name == "" {
		parts := strings.Split(req.Email, "@")
		name = parts[0]
	}

	_, err = db.Pool.Exec(r.Context(),
		`INSERT INTO users (email, name, hashed_password, provider) VALUES ($1,$2,$3,'email')`,
		req.Email, name, hashed,
	)
	if err != nil {
		writeError(w, 500, "Failed to create user")
		return
	}

	code := genOTP()
	storeOTP(r.Context(), req.Email, code)
	sendEmailOTP(r.Context(), req.Email, code)
	writeJSON(w, 200, map[string]string{"message": "OTP sent to your email — check your inbox"})
}

// ── Login ─────────────────────────────────────────────────────────────────────

func Login(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, 400, "Invalid request")
		return
	}

	var u db.User
	err := db.Pool.QueryRow(r.Context(),
		`SELECT id, email, phone, name, avatar_url, avatar_color, provider, provider_id, hashed_password,
		        email_verified, phone_verified, plan, role, totp_secret, totp_enabled, totp_pending_secret, created_at
		 FROM users WHERE email=$1`, req.Email,
	).Scan(&u.ID, &u.Email, &u.Phone, &u.Name, &u.AvatarURL, &u.AvatarColor, &u.Provider, &u.ProviderID,
		&u.HashedPassword, &u.EmailVerified, &u.PhoneVerified, &u.Plan, &u.Role,
		&u.TOTPSecret, &u.TOTPEnabled, &u.TOTPPendingSecret, &u.CreatedAt)

	if err != nil || u.HashedPassword == nil || !auth.VerifyPassword(req.Password, *u.HashedPassword) {
		services.AuditLog(r.Context(), nil, req.Email, "login", "email", clientIP(r), "failed", nil)
		writeError(w, 401, "Invalid email or password")
		return
	}

	token, err := auth.CreateToken(u.ID)
	if err != nil {
		writeError(w, 500, "Token creation failed")
		return
	}

	setSessionCookie(w, token)
	recordSession(r.Context(), u.ID, token, r)
	services.AuditLog(r.Context(), &u.ID, strVal(u.Email), "login", "email", clientIP(r), "success", nil)
	writeJSON(w, 200, map[string]interface{}{"user": userToDict(&u)})
}

// ── OTP ───────────────────────────────────────────────────────────────────────

func betaEmailAllowed(email string) bool {
	allowed := strings.TrimSpace(os.Getenv("BETA_ALLOWED_EMAILS"))
	if allowed == "" {
		return os.Getenv("APP_ENV") != "production"
	}
	for _, entry := range strings.Split(allowed, ",") {
		if strings.EqualFold(strings.TrimSpace(entry), email) {
			return true
		}
	}
	return false
}

func OTPSend(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	var req struct {
		Contact string `json:"contact"`
	}
	if !launchDecode(w, r, &req) {
		return
	}
	req.Contact = strings.ToLower(strings.TrimSpace(req.Contact))
	address, err := mail.ParseAddress(req.Contact)
	if err != nil || address.Address != req.Contact || len(req.Contact) > 254 {
		writeError(w, 400, "Enter a valid email address")
		return
	}
	if !betaEmailAllowed(req.Contact) {
		writeError(w, 403, "Meridian is invite-only during early access. Ask the operator to invite your email.")
		return
	}
	// Serialize sends for the same email across API replicas, including new users.
	tx, err := db.Pool.Begin(r.Context())
	if err != nil {
		writeError(w, 503, "Sign-in is temporarily unavailable")
		return
	}
	defer tx.Rollback(r.Context())
	if _, err = tx.Exec(r.Context(), `SELECT pg_advisory_xact_lock(hashtextextended($1,71423821))`, req.Contact); err != nil {
		writeError(w, 503, "Sign-in is temporarily unavailable")
		return
	}
	var count int
	if tx.QueryRow(r.Context(), `SELECT count(*) FROM otp_codes WHERE contact=$1 AND created_at>now()-interval '15 minutes'`, req.Contact).Scan(&count) != nil {
		writeError(w, 503, "Sign-in is temporarily unavailable")
		return
	}
	if count >= 3 {
		writeError(w, 429, "Please wait before requesting another email code")
		return
	}
	code := genOTP()
	if _, err = tx.Exec(r.Context(), `UPDATE otp_codes SET used=TRUE WHERE contact=$1 AND used=FALSE`, req.Contact); err != nil {
		writeError(w, 503, "Could not send code")
		return
	}
	if _, err = tx.Exec(r.Context(), `INSERT INTO otp_codes(contact,code,expires_at) VALUES($1,$2,now()+interval '10 minutes')`, req.Contact, code); err != nil {
		writeError(w, 503, "Could not save sign-in code")
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		writeError(w, 503, "Could not save sign-in code")
		return
	}
	if !sendEmailOTP(r.Context(), req.Contact, code) {
		writeError(w, 500, "Failed to send OTP")
		return
	}
	writeJSON(w, 200, map[string]string{"message": "OTP sent to your email"})
}

func OTPVerify(w http.ResponseWriter, r *http.Request) {
	if !requireDB(w) {
		return
	}
	var req struct {
		Contact string `json:"contact"`
		Code    string `json:"code"`
		Name    string `json:"name"`
	}
	if !launchDecode(w, r, &req) {
		return
	}
	req.Contact = strings.ToLower(strings.TrimSpace(req.Contact))
	if !betaEmailAllowed(req.Contact) {
		writeError(w, 403, "This email is not invited to early access")
		return
	}
	if len(req.Code) != 6 {
		writeError(w, 400, "Enter the six-digit code")
		return
	}
	var hasTOTP bool
	err := db.Pool.QueryRow(r.Context(), `SELECT totp_enabled FROM users WHERE email=$1`, req.Contact).Scan(&hasTOTP)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		writeError(w, 503, "Sign-in is temporarily unavailable")
		return
	}
	if hasTOTP {
		writeError(w, 403, "This account requires the legacy two-factor login flow")
		return
	}

	if !verifyOTP(r.Context(), req.Contact, req.Code) {
		writeError(w, 400, "Invalid or expired OTP")
		return
	}

	u, err := getOrCreateUser(r.Context(), req.Contact, req.Name, "email", "", "")
	if err != nil {
		writeError(w, 500, "Could not complete sign-in")
		return
	}

	if _, err = db.Pool.Exec(r.Context(), `UPDATE users SET email_verified=TRUE WHERE id=$1`, u.ID); err != nil {
		writeError(w, 503, "Could not complete sign-in")
		return
	}

	token, err := auth.CreateToken(u.ID)
	if err != nil || recordSession(r.Context(), u.ID, token, r) != nil {
		writeError(w, 503, "Could not create a session; request a new code and try again")
		return
	}
	setSessionCookie(w, token)
	services.AuditLog(r.Context(), &u.ID, strVal(u.Email), "login", "otp", clientIP(r), "success", nil)

	u.EmailVerified = true
	writeJSON(w, 200, map[string]interface{}{"user": userToDict(u)})
}

// ── Me / Logout ───────────────────────────────────────────────────────────────

func Me(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	u, err := getUserByID(r.Context(), uid)
	if err != nil {
		writeError(w, 404, "User not found")
		return
	}

	d := userToDict(u)
	var expLevel *string
	db.Pool.QueryRow(r.Context(), `SELECT experience_level FROM user_settings WHERE user_id=$1`, uid).Scan(&expLevel)
	d["experience_level"] = expLevel
	writeJSON(w, 200, d)
}

func Logout(w http.ResponseWriter, r *http.Request) {
	token := getToken(r)
	if token != "" && !db.Available() {
		writeError(w, 503, "Sign-out is temporarily unavailable; please retry")
		return
	}
	if token != "" && db.Available() {
		hash := auth.HashToken(token)
		if _, err := db.Pool.Exec(r.Context(), `UPDATE user_sessions SET is_revoked=TRUE WHERE session_token_hash=$1`, hash); err != nil {
			writeError(w, 503, "Could not revoke the server session; please retry sign-out")
			return
		}
	}
	clearSessionCookie(w)
	writeJSON(w, 200, map[string]string{"message": "Logged out"})
}

// ── Change password ───────────────────────────────────────────────────────────

func ChangePassword(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	u, err := getUserByID(r.Context(), uid)
	if err != nil {
		writeError(w, 404, "User not found")
		return
	}
	if u.HashedPassword == nil || !auth.VerifyPassword(req.CurrentPassword, *u.HashedPassword) {
		writeError(w, 401, "Current password is incorrect")
		return
	}
	if len(req.NewPassword) < 8 {
		writeError(w, 400, "New password must be at least 8 characters")
		return
	}

	hashed, _ := auth.HashPassword(req.NewPassword)
	db.Pool.Exec(r.Context(), `UPDATE users SET hashed_password=$1 WHERE id=$2`, hashed, uid)
	services.AuditLog(r.Context(), &uid, strVal(u.Email), "password.changed", "account", clientIP(r), "success", nil)
	writeJSON(w, 200, map[string]string{"message": "Password updated successfully"})
}

// ── Sessions ──────────────────────────────────────────────────────────────────

func ListSessions(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !db.Available() {
		writeJSON(w, 200, map[string]interface{}{"sessions": []interface{}{}})
		return
	}

	currentHash := auth.HashToken(getToken(r))
	rows, err := db.Pool.Query(r.Context(),
		`SELECT id, device_info, ip_address, last_active, created_at, session_token_hash
		 FROM user_sessions WHERE user_id=$1 AND is_revoked=FALSE ORDER BY last_active DESC`,
		uid,
	)
	if err != nil {
		writeJSON(w, 200, map[string]interface{}{"sessions": []interface{}{}})
		return
	}
	defer rows.Close()

	sessions := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var device, ip, hash string
		var lastActive, createdAt time.Time
		rows.Scan(&id, &device, &ip, &lastActive, &createdAt, &hash)
		sessions = append(sessions, map[string]interface{}{
			"id":          id,
			"device_info": device,
			"ip_address":  ip,
			"last_active": lastActive.Format(time.RFC3339),
			"created_at":  createdAt.Format(time.RFC3339),
			"is_current":  hash == currentHash,
		})
	}
	writeJSON(w, 200, map[string]interface{}{"sessions": sessions})
}

func RevokeSession(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	sessionID := chi.URLParam(r, "session_id")
	if db.Available() {
		db.Pool.Exec(r.Context(),
			`UPDATE user_sessions SET is_revoked=TRUE WHERE id=$1 AND user_id=$2`,
			sessionID, uid,
		)
	}
	w.WriteHeader(204)
}

func RevokeAllSessions(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	currentHash := auth.HashToken(getToken(r))
	if db.Available() {
		db.Pool.Exec(r.Context(),
			`UPDATE user_sessions SET is_revoked=TRUE WHERE user_id=$1 AND is_revoked=FALSE AND session_token_hash!=$2`,
			uid, currentHash,
		)
	}
	w.WriteHeader(204)
}

// ── API Keys ──────────────────────────────────────────────────────────────────

func ListAPIKeys(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !db.Available() {
		writeJSON(w, 200, map[string]interface{}{"keys": []interface{}{}})
		return
	}

	rows, _ := db.Pool.Query(r.Context(),
		`SELECT id, name, key_prefix, key_hash, scopes, expires_at, last_used_at, created_at
		 FROM api_keys WHERE user_id=$1 AND is_revoked=FALSE ORDER BY created_at DESC`,
		uid,
	)
	defer rows.Close()

	keys := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var name, prefix, hash, scopes string
		var expiresAt, lastUsedAt *time.Time
		var createdAt time.Time
		rows.Scan(&id, &name, &prefix, &hash, &scopes, &expiresAt, &lastUsedAt, &createdAt)
		k := map[string]interface{}{
			"id":           id,
			"name":         name,
			"key_prefix":   prefix + "****" + hash[len(hash)-4:],
			"scopes":       strings.Split(scopes, ","),
			"expires_at":   nil,
			"last_used_at": nil,
			"created_at":   createdAt.Format(time.RFC3339),
		}
		if expiresAt != nil {
			k["expires_at"] = expiresAt.Format(time.RFC3339)
		}
		if lastUsedAt != nil {
			k["last_used_at"] = lastUsedAt.Format(time.RFC3339)
		}
		keys = append(keys, k)
	}
	writeJSON(w, 200, map[string]interface{}{"keys": keys})
}

func CreateAPIKey(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	var req struct {
		Name       string   `json:"name"`
		Scopes     []string `json:"scopes"`
		ExpiryDays *int     `json:"expiry_days"`
	}
	req.Scopes = []string{"read"}
	json.NewDecoder(r.Body).Decode(&req)

	b := make([]byte, 24)
	rand.Read(b)
	rawKey := "sk-ip-" + fmt.Sprintf("%x", b)
	prefix := rawKey[:12]
	keyHash := hashAPIKey(rawKey)

	var expiresAt *time.Time
	if req.ExpiryDays != nil && *req.ExpiryDays > 0 {
		t := time.Now().UTC().Add(time.Duration(*req.ExpiryDays) * 24 * time.Hour)
		expiresAt = &t
	}

	var id int
	var createdAt time.Time
	db.Pool.QueryRow(r.Context(),
		`INSERT INTO api_keys (user_id, name, key_prefix, key_hash, scopes, expires_at)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
		uid, req.Name, prefix, keyHash, strings.Join(req.Scopes, ","), expiresAt,
	).Scan(&id, &createdAt)

	resp := map[string]interface{}{
		"id":         id,
		"name":       req.Name,
		"key":        rawKey,
		"scopes":     req.Scopes,
		"expires_at": nil,
		"created_at": createdAt.Format(time.RFC3339),
	}
	if expiresAt != nil {
		resp["expires_at"] = expiresAt.Format(time.RFC3339)
	}
	writeJSON(w, 201, resp)
}

func RevokeAPIKey(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	keyID := chi.URLParam(r, "key_id")
	if db.Available() {
		db.Pool.Exec(r.Context(),
			`UPDATE api_keys SET is_revoked=TRUE WHERE id=$1 AND user_id=$2`,
			keyID, uid,
		)
	}
	w.WriteHeader(204)
}

// ── 2FA / TOTP ────────────────────────────────────────────────────────────────

func Setup2FA(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	u, err := getUserByID(r.Context(), uid)
	if err != nil {
		writeError(w, 404, "User not found")
		return
	}

	email := strVal(u.Email)
	if email == "" {
		email = fmt.Sprintf("user_%d", uid)
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Meridian",
		AccountName: email,
	})
	if err != nil {
		writeError(w, 500, "TOTP generation failed")
		return
	}

	db.Pool.Exec(r.Context(), `UPDATE users SET totp_pending_secret=$1 WHERE id=$2`, key.Secret(), uid)
	writeJSON(w, 200, map[string]string{
		"secret":      key.Secret(),
		"otpauth_uri": key.URL(),
	})
}

func Enable2FA(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	var req struct {
		Code string `json:"code"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	u, err := getUserByID(r.Context(), uid)
	if err != nil || u.TOTPPendingSecret == nil {
		writeError(w, 400, "No pending 2FA setup — call /auth/2fa/setup first")
		return
	}

	if !totp.Validate(req.Code, *u.TOTPPendingSecret) {
		writeError(w, 400, "Invalid TOTP code")
		return
	}

	db.Pool.Exec(r.Context(),
		`UPDATE users SET totp_secret=$1, totp_pending_secret=NULL, totp_enabled=TRUE WHERE id=$2`,
		*u.TOTPPendingSecret, uid,
	)

	backupCodes := make([]string, 8)
	for i := range backupCodes {
		b := make([]byte, 4)
		rand.Read(b)
		backupCodes[i] = strings.ToUpper(fmt.Sprintf("%x", b))
	}

	services.AuditLog(r.Context(), &uid, strVal(u.Email), "2fa.enabled", "account", clientIP(r), "success", nil)
	writeJSON(w, 200, map[string]interface{}{"message": "2FA enabled", "backup_codes": backupCodes})
}

func Disable2FA(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(w, r)
	if !ok {
		return
	}
	if !requireDB(w) {
		return
	}

	var req struct {
		Code string `json:"code"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	u, err := getUserByID(r.Context(), uid)
	if err != nil || !u.TOTPEnabled || u.TOTPSecret == nil {
		writeError(w, 400, "2FA is not enabled")
		return
	}

	if !totp.Validate(req.Code, *u.TOTPSecret) {
		writeError(w, 400, "Invalid TOTP code")
		return
	}

	db.Pool.Exec(r.Context(),
		`UPDATE users SET totp_secret=NULL, totp_enabled=FALSE WHERE id=$1`, uid,
	)

	services.AuditLog(r.Context(), &uid, strVal(u.Email), "2fa.disabled", "account", clientIP(r), "success", nil)
	writeJSON(w, 200, map[string]string{"message": "2FA disabled"})
}

// ── Google OAuth ──────────────────────────────────────────────────────────────

func GoogleAuth(w http.ResponseWriter, r *http.Request) {
	if config.GoogleClientID == "" {
		writeError(w, 501, "Google OAuth not configured")
		return
	}
	url := fmt.Sprintf(
		"https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=%s&response_type=code&scope=openid%%20email%%20profile&access_type=offline&prompt=consent",
		config.GoogleClientID, config.GoogleRedirectURI,
	)
	http.Redirect(w, r, url, http.StatusFound)
}

func GoogleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Redirect(w, r, config.FrontendURL+"/login?error=google_failed", http.StatusFound)
		return
	}

	tokenData, err := exchangeOAuthCode("https://oauth2.googleapis.com/token", map[string]string{
		"code": code, "client_id": config.GoogleClientID, "client_secret": config.GoogleClientSecret,
		"redirect_uri": config.GoogleRedirectURI, "grant_type": "authorization_code",
	})
	if err != nil {
		http.Redirect(w, r, config.FrontendURL+"/login?error=google_failed", http.StatusFound)
		return
	}

	accessToken, _ := tokenData["access_token"].(string)
	info, err := httpGet("https://www.googleapis.com/oauth2/v2/userinfo", accessToken)
	if err != nil {
		http.Redirect(w, r, config.FrontendURL+"/login?error=google_failed", http.StatusFound)
		return
	}

	email, _ := info["email"].(string)
	name, _ := info["name"].(string)
	avatar, _ := info["picture"].(string)
	providerID := fmt.Sprintf("%v", info["id"])

	if email == "" || !db.Available() {
		http.Redirect(w, r, config.FrontendURL+"/login?error=google_failed", http.StatusFound)
		return
	}

	u, _ := getOrCreateUser(r.Context(), email, name, "google", providerID, avatar)
	token, _ := auth.CreateToken(u.ID)
	recordSession(r.Context(), u.ID, token, r)

	redirect := &http.Response{}
	_ = redirect
	http.SetCookie(w, &http.Cookie{Name: auth.SessionCookie, Value: token, HttpOnly: true, MaxAge: 604800, Path: "/"})
	http.Redirect(w, r, config.FrontendURL+"/auth/callback", http.StatusFound)
}

func GitHubAuth(w http.ResponseWriter, r *http.Request) {
	if config.GitHubClientID == "" {
		writeError(w, 501, "GitHub OAuth not configured")
		return
	}
	url := fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&scope=user:email,repo",
		config.GitHubClientID, config.GitHubRedirectURI,
	)
	http.Redirect(w, r, url, http.StatusFound)
}

func GitHubCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Redirect(w, r, config.FrontendURL+"/login?error=github_failed", http.StatusFound)
		return
	}

	tokenData, err := exchangeOAuthCode("https://github.com/login/oauth/access_token", map[string]string{
		"client_id": config.GitHubClientID, "client_secret": config.GitHubClientSecret,
		"code": code, "redirect_uri": config.GitHubRedirectURI,
	})
	if err != nil {
		http.Redirect(w, r, config.FrontendURL+"/login?error=github_failed", http.StatusFound)
		return
	}

	accessToken, _ := tokenData["access_token"].(string)
	if accessToken == "" {
		http.Redirect(w, r, config.FrontendURL+"/login?error=github_failed", http.StatusFound)
		return
	}

	ghUser, err := httpGet("https://api.github.com/user", accessToken)
	if err != nil {
		http.Redirect(w, r, config.FrontendURL+"/login?error=github_failed", http.StatusFound)
		return
	}

	name, _ := ghUser["login"].(string)
	avatar, _ := ghUser["avatar_url"].(string)
	providerID := fmt.Sprintf("%v", ghUser["id"])

	// Get primary email
	emails, _ := httpGetSlice("https://api.github.com/user/emails", accessToken)
	email := ""
	for _, e := range emails {
		if em, ok := e.(map[string]interface{}); ok {
			if prim, _ := em["primary"].(bool); prim {
				email, _ = em["email"].(string)
				break
			}
		}
	}
	if email == "" {
		email, _ = ghUser["email"].(string)
	}

	if email == "" || !db.Available() {
		http.Redirect(w, r, config.FrontendURL+"/login?error=github_failed", http.StatusFound)
		return
	}

	u, _ := getOrCreateUser(r.Context(), email, name, "github", providerID, avatar)
	token, _ := auth.CreateToken(u.ID)
	recordSession(r.Context(), u.ID, token, r)

	http.SetCookie(w, &http.Cookie{Name: auth.SessionCookie, Value: token, HttpOnly: true, MaxAge: 604800, Path: "/"})
	http.Redirect(w, r, config.FrontendURL+"/auth/callback", http.StatusFound)
}

func GitLabAuth(w http.ResponseWriter, r *http.Request) {
	if config.GitLabClientID == "" {
		writeError(w, 501, "GitLab OAuth not configured")
		return
	}
	url := fmt.Sprintf(
		"%s/oauth/authorize?client_id=%s&redirect_uri=%s&response_type=code&scope=read_user",
		config.GitLabURL, config.GitLabClientID, config.GitLabRedirectURI,
	)
	http.Redirect(w, r, url, http.StatusFound)
}

func GitLabCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Redirect(w, r, config.FrontendURL+"/login?error=gitlab_failed", http.StatusFound)
		return
	}

	tokenData, err := exchangeOAuthCode(config.GitLabURL+"/oauth/token", map[string]string{
		"client_id": config.GitLabClientID, "client_secret": config.GitLabClientSecret,
		"code": code, "grant_type": "authorization_code", "redirect_uri": config.GitLabRedirectURI,
	})
	if err != nil {
		http.Redirect(w, r, config.FrontendURL+"/login?error=gitlab_failed", http.StatusFound)
		return
	}

	accessToken, _ := tokenData["access_token"].(string)
	glUser, err := httpGet(config.GitLabURL+"/api/v4/user", accessToken)
	if err != nil {
		http.Redirect(w, r, config.FrontendURL+"/login?error=gitlab_failed", http.StatusFound)
		return
	}

	email, _ := glUser["email"].(string)
	name, _ := glUser["username"].(string)
	avatar, _ := glUser["avatar_url"].(string)
	providerID := fmt.Sprintf("%v", glUser["id"])

	if email == "" || !db.Available() {
		http.Redirect(w, r, config.FrontendURL+"/login?error=gitlab_failed", http.StatusFound)
		return
	}

	u, _ := getOrCreateUser(r.Context(), email, name, "gitlab", providerID, avatar)
	token, _ := auth.CreateToken(u.ID)
	recordSession(r.Context(), u.ID, token, r)

	http.SetCookie(w, &http.Cookie{Name: auth.SessionCookie, Value: token, HttpOnly: true, MaxAge: 604800, Path: "/"})
	http.Redirect(w, r, config.FrontendURL+"/auth/callback", http.StatusFound)
}

// ── OAuth helpers ──────────────────────────────────────────────────────────────

func exchangeOAuthCode(url string, params map[string]string) (map[string]interface{}, error) {
	body, _ := json.Marshal(params)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

func httpGet(url, token string) (map[string]interface{}, error) {
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result, nil
}

func httpGetSlice(url, token string) ([]interface{}, error) {
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	var result []interface{}
	json.Unmarshal(b, &result)
	return result, nil
}

func strVal(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// keep strconv used
var _ = strconv.Itoa
