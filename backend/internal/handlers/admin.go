package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

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
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()
	out := []adminUserView{}
	for rows.Next() {
		var u adminUserView
		if err := rows.Scan(&u.ID, &u.Username, &u.IsAdmin, &u.CreatedAt, &u.LinksCount); err != nil {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
		out = append(out, u)
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	selfID := middleware.UserID(r.Context())
	if id == selfID {
		writeError(w, http.StatusBadRequest, "cannot delete yourself")
		return
	}
	cmd, err := h.pool.Exec(r.Context(), "DELETE FROM users WHERE id = $1", id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	if cmd.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminHandler) ListAllLinks(w http.ResponseWriter, r *http.Request) {
	rows, err := h.pool.Query(r.Context(),
		`SELECT l.id, l.code, l.target_url, l.user_id, u.username, l.expires_at, l.created_at
		 FROM links l JOIN users u ON u.id = l.user_id
		 ORDER BY l.created_at DESC`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	defer rows.Close()
	out := []linkView{}
	for rows.Next() {
		var v linkView
		if err := rows.Scan(&v.ID, &v.Code, &v.TargetURL, &v.UserID, &v.Username, &v.ExpiresAt, &v.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
		v.ShortURL = shortURL(h.cfg, v.Code)
		out = append(out, v)
	}
	writeJSON(w, http.StatusOK, out)
}
