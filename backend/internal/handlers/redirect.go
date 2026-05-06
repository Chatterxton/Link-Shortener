package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RedirectHandler struct {
	pool *pgxpool.Pool
}

func NewRedirectHandler(pool *pgxpool.Pool) *RedirectHandler {
	return &RedirectHandler{pool: pool}
}

func (h *RedirectHandler) Redirect(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	var (
		target    string
		expiresAt *time.Time
	)
	err := h.pool.QueryRow(r.Context(),
		"SELECT target_url, expires_at FROM links WHERE code = $1", code,
	).Scan(&target, &expiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "Ссылка не найдена", http.StatusNotFound)
			return
		}
		http.Error(w, "Ошибка базы данных", http.StatusInternalServerError)
		return
	}
	if expiresAt != nil && time.Now().After(*expiresAt) {
		http.Error(w, "Срок действия ссылки истёк", http.StatusGone)
		return
	}
	http.Redirect(w, r, target, http.StatusFound)
}
