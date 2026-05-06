package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/vladimir/link-shortener/internal/auth"
	"github.com/vladimir/link-shortener/internal/middleware"
)

const AuthCookieName = "auth_token"

type AuthHandler struct {
	pool         *pgxpool.Pool
	jwt          *auth.JWTManager
	cookieSecure bool
	cookieTTL    time.Duration
}

func NewAuthHandler(pool *pgxpool.Pool, jm *auth.JWTManager, cookieSecure bool, cookieTTL time.Duration) *AuthHandler {
	return &AuthHandler{pool: pool, jwt: jm, cookieSecure: cookieSecure, cookieTTL: cookieTTL}
}

type credsReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type userView struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	IsAdmin  bool   `json:"is_admin"`
}

func (h *AuthHandler) setAuthCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     AuthCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(h.cookieTTL.Seconds()),
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (h *AuthHandler) clearAuthCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     AuthCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func validateCreds(username, password string) (string, string) {
	username = strings.TrimSpace(username)
	if len(username) < 3 || len(username) > 64 {
		return "", "Логин должен быть от 3 до 64 символов"
	}
	if len(password) < 6 {
		return "", "Пароль должен быть не короче 6 символов"
	}
	return username, ""
}

func (h *AuthHandler) NeedsBootstrap(w http.ResponseWriter, r *http.Request) {
	var count int64
	if err := h.pool.QueryRow(r.Context(), "SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"needs_bootstrap": count == 0})
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req credsReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный запрос")
		return
	}
	username, vErr := validateCreds(req.Username, req.Password)
	if vErr != "" {
		writeError(w, http.StatusBadRequest, vErr)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка хеширования пароля")
		return
	}

	ctx := r.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
		return
	}
	defer tx.Rollback(ctx)

	var existingCount int64
	if err := tx.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&existingCount); err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
		return
	}
	if existingCount > 0 {
		writeError(w, http.StatusForbidden, "Регистрация закрыта. Обратитесь к администратору.")
		return
	}

	var u userView
	err = tx.QueryRow(ctx,
		"INSERT INTO users (username, password_hash, is_admin) VALUES ($1, $2, TRUE) RETURNING id, username, is_admin",
		username, string(hash),
	).Scan(&u.ID, &u.Username, &u.IsAdmin)
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "Логин уже занят")
			return
		}
		writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
		return
	}

	tok, err := h.jwt.Generate(u.ID, u.IsAdmin)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось создать токен")
		return
	}
	h.setAuthCookie(w, tok)
	writeJSON(w, http.StatusOK, map[string]any{"user": u})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req credsReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный запрос")
		return
	}

	var (
		id       int64
		username string
		passHash string
		isAdmin  bool
	)
	err := h.pool.QueryRow(r.Context(),
		"SELECT id, username, password_hash, is_admin FROM users WHERE username = $1",
		strings.TrimSpace(req.Username),
	).Scan(&id, &username, &passHash, &isAdmin)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "Неверный логин или пароль")
			return
		}
		writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "Неверный логин или пароль")
		return
	}

	tok, err := h.jwt.Generate(id, isAdmin)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось создать токен")
		return
	}
	h.setAuthCookie(w, tok)
	writeJSON(w, http.StatusOK, map[string]any{
		"user": userView{ID: id, Username: username, IsAdmin: isAdmin},
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, _ *http.Request) {
	h.clearAuthCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	var u userView
	err := h.pool.QueryRow(r.Context(),
		"SELECT id, username, is_admin FROM users WHERE id = $1", uid,
	).Scan(&u.ID, &u.Username, &u.IsAdmin)
	if err != nil {
		writeError(w, http.StatusNotFound, "Пользователь не найден")
		return
	}
	writeJSON(w, http.StatusOK, u)
}
