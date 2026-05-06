package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/vladimir/link-shortener/internal/auth"
)

const AuthCookieName = "auth_token"

type ctxKey string

const (
	ctxUserID  ctxKey = "user_id"
	ctxIsAdmin ctxKey = "is_admin"
)

func extractToken(r *http.Request) string {
	if c, err := r.Cookie(AuthCookieName); err == nil && c.Value != "" {
		return c.Value
	}
	h := r.Header.Get("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer ")
	}
	return ""
}

func RequireAuth(jm *auth.JWTManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tok := extractToken(r)
			if tok == "" {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Требуется авторизация"})
				return
			}
			claims, err := jm.Parse(tok)
			if err != nil {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Недействительный токен"})
				return
			}
			ctx := context.WithValue(r.Context(), ctxUserID, claims.UserID)
			ctx = context.WithValue(ctx, ctxIsAdmin, claims.IsAdmin)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !IsAdmin(r.Context()) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Доступ только для администратора"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func UserID(ctx context.Context) int64 {
	v, _ := ctx.Value(ctxUserID).(int64)
	return v
}

func IsAdmin(ctx context.Context) bool {
	v, _ := ctx.Value(ctxIsAdmin).(bool)
	return v
}

// SecurityHeaders sets a baseline of HTTP response headers that protect against
// MIME sniffing, clickjacking and referrer leaks. HSTS is intentionally left to
// the host nginx since TLS termination happens there.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}

// CORS returns middleware that handles cross-origin requests.
// If allowedOrigin is empty, no CORS headers are emitted (suitable when frontend
// and backend share the same origin via reverse proxy). When set, the configured
// origin is mirrored back and credentials are allowed (required for cookie auth).
func CORS(allowedOrigin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if allowedOrigin != "" {
				origin := r.Header.Get("Origin")
				if origin != "" && origin == allowedOrigin {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Vary", "Origin")
					w.Header().Set("Access-Control-Allow-Credentials", "true")
					w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
					w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				}
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
