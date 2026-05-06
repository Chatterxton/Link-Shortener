package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/vladimir/link-shortener/internal/auth"
	"github.com/vladimir/link-shortener/internal/middleware"
)

type AuthHandler struct {
	pool *pgxpool.Pool
	jwt  *auth.JWTManager
}

func NewAuthHandler(pool *pgxpool.Pool, jm *auth.JWTManager) *AuthHandler {
	return &AuthHandler{pool: pool, jwt: jm}
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

type authResp struct {
	Token string   `json:"token"`
	User  userView `json:"user"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req credsReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный запрос")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if len(req.Username) < 3 || len(req.Username) > 64 {
		writeError(w, http.StatusBadRequest, "Логин должен быть от 3 до 64 символов")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "Пароль должен быть не короче 6 символов")
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
	isAdmin := existingCount == 0

	var u userView
	err = tx.QueryRow(ctx,
		"INSERT INTO users (username, password_hash, is_admin) VALUES ($1, $2, $3) RETURNING id, username, is_admin",
		req.Username, string(hash), isAdmin,
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
	writeJSON(w, http.StatusOK, authResp{Token: tok, User: u})
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
	writeJSON(w, http.StatusOK, authResp{
		Token: tok,
		User:  userView{ID: id, Username: username, IsAdmin: isAdmin},
	})
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
