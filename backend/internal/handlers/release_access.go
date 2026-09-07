package handlers

import (
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

var authLimit = struct {
	sync.Mutex
	entries map[string]struct {
		count int
		at    time.Time
	}
}{entries: make(map[string]struct {
	count int
	at    time.Time
})}

// Protect old handlers centrally and keep globally scoped integrations out of
// the hosted release. Legacy mode is only for an operator's private instance.
func ReleaseAccess(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if strings.HasPrefix(p, "/api/launch/") {
			next.ServeHTTP(w, r)
			return
		}
		if strings.HasPrefix(p, "/api/auth/") {
			if os.Getenv("ENABLE_LEGACY_SINGLE_TENANT") != "true" && p != "/api/auth/otp/send" && p != "/api/auth/otp/verify" && p != "/api/auth/me" && p != "/api/auth/logout" {
				writeError(w, 404, "Use email sign-in for this release")
				return
			}
			if os.Getenv("APP_ENV") == "production" && (strings.Contains(p, "/google") || strings.Contains(p, "/github") || strings.Contains(p, "/gitlab")) {
				writeError(w, 501, "Social login is not enabled in this release. Use email sign-in.")
				return
			}
			if r.Method != "GET" {
				if !allowedOrigin(r.Header.Get("Origin")) {
					writeError(w, 403, "Open Meridian to sign in")
					return
				}
				// Trust the socket peer, not an arbitrary client-supplied forwarded IP.
				authLimit.Lock()
				now := time.Now()
				for k, v := range authLimit.entries {
					if now.Sub(v.at) > time.Minute {
						delete(authLimit.entries, k)
					}
				}
				key, _, _ := net.SplitHostPort(r.RemoteAddr)
				entry := authLimit.entries[key]
				if now.Sub(entry.at) > time.Minute {
					entry.count = 0
					entry.at = now
				}
				entry.count++
				authLimit.entries[key] = entry
				denied := entry.count > 20 || len(authLimit.entries) > 10000
				authLimit.Unlock()
				if denied {
					w.Header().Set("Retry-After", "60")
					writeError(w, 429, "Too many attempts; try again in one minute")
					return
				}
			}
			next.ServeHTTP(w, r)
			return
		}
		if _, ok := requireUser(w, r); !ok {
			return
		}
		if r.Method != "GET" && r.Method != "HEAD" && !allowedOrigin(r.Header.Get("Origin")) {
			writeError(w, 403, "Request must originate from Meridian")
			return
		}
		if os.Getenv("ENABLE_LEGACY_SINGLE_TENANT") != "true" {
			writeError(w, 503, "This legacy feature is disabled in the hosted release")
			return
		}
		next.ServeHTTP(w, r)
	})
}
