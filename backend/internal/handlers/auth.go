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
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if len(req.Username) < 3 || len(req.Username) > 64 {
		writeError(w, http.StatusBadRequest, "username must be 3-64 chars")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "password must be at least 6 chars")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "hash error")
		return
	}

	ctx := r.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer tx.Rollback(ctx)

	var existingCount int64
	if err := tx.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&existingCount); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
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
			writeError(w, http.StatusConflict, "username taken")
			return
		}
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	tok, err := h.jwt.Generate(u.ID, u.IsAdmin)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token error")
		return
	}
	writeJSON(w, http.StatusOK, authResp{Token: tok, User: u})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req credsReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
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
			writeError(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	tok, err := h.jwt.Generate(id, isAdmin)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token error")
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
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, u)
}
