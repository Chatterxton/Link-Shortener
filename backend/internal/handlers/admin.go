package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/vladimir/link-shortener/internal/config"
	"github.com/vladimir/link-shortener/internal/middleware"
)

type AdminHandler struct {
	pool *pgxpool.Pool
	cfg  *config.Config
}

func NewAdminHandler(pool *pgxpool.Pool, cfg *config.Config) *AdminHandler {
	return &AdminHandler{pool: pool, cfg: cfg}
}

type adminUserView struct {
	ID         int64     `json:"id"`
	Username   string    `json:"username"`
	IsAdmin    bool      `json:"is_admin"`
	CreatedAt  time.Time `json:"created_at"`
	LinksCount int64     `json:"links_count"`
}

func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.pool.Query(r.Context(),
		`SELECT u.id, u.username, u.is_admin, u.created_at,
		        COALESCE((SELECT COUNT(*) FROM links l WHERE l.user_id = u.id), 0) AS links_count
		 FROM users u
		 ORDER BY u.id ASC`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
		return
	}
	defer rows.Close()
	out := []adminUserView{}
	for rows.Next() {
		var u adminUserView
		if err := rows.Scan(&u.ID, &u.Username, &u.IsAdmin, &u.CreatedAt, &u.LinksCount); err != nil {
			writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
			return
		}
		out = append(out, u)
	}
	writeJSON(w, http.StatusOK, out)
}

type createUserReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
	IsAdmin  bool   `json:"is_admin"`
}

func (h *AdminHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req createUserReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный запрос")
		return
	}
	username := strings.TrimSpace(req.Username)
	if len(username) < 3 || len(username) > 64 {
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

	var u adminUserView
	err = h.pool.QueryRow(r.Context(),
		`INSERT INTO users (username, password_hash, is_admin)
		 VALUES ($1, $2, $3)
		 RETURNING id, username, is_admin, created_at, 0::bigint AS links_count`,
		username, string(hash), req.IsAdmin,
	).Scan(&u.ID, &u.Username, &u.IsAdmin, &u.CreatedAt, &u.LinksCount)
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "Логин уже занят")
			return
		}
		writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
		return
	}
	selfID := middleware.UserID(r.Context())
	if id == selfID {
		writeError(w, http.StatusBadRequest, "Нельзя удалить самого себя")
		return
	}
	cmd, err := h.pool.Exec(r.Context(), "DELETE FROM users WHERE id = $1", id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
		return
	}
	if cmd.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "Пользователь не найден")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminHandler) ListAllLinks(w http.ResponseWriter, r *http.Request) {
	rows, err := h.pool.Query(r.Context(),
		`SELECT l.id, l.code, l.target_url, l.user_id, u.username, l.note, l.click_count, l.max_clicks, l.expires_at, l.created_at
		 FROM links l JOIN users u ON u.id = l.user_id
		 ORDER BY l.created_at DESC`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
		return
	}
	defer rows.Close()
	out := []linkView{}
	for rows.Next() {
		var v linkView
		if err := rows.Scan(&v.ID, &v.Code, &v.TargetURL, &v.UserID, &v.Username, &v.Note, &v.ClickCount, &v.MaxClicks, &v.ExpiresAt, &v.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
			return
		}
		v.ShortURL = shortURL(h.cfg, v.Code)
		out = append(out, v)
	}
	writeJSON(w, http.StatusOK, out)
}
