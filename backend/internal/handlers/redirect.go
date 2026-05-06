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

// Redirect resolves the short code and increments the click counter atomically.
// The conditional UPDATE prevents a TOCTOU race where multiple concurrent
// requests could each pass a non-atomic check and exceed max_clicks (critical
// for one-time links).
func (h *RedirectHandler) Redirect(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")

	var target string
	err := h.pool.QueryRow(r.Context(),
		`UPDATE links
		 SET click_count = click_count + 1
		 WHERE code = $1
		   AND (expires_at IS NULL OR expires_at > NOW())
		   AND (max_clicks IS NULL OR click_count < max_clicks)
		 RETURNING target_url`,
		code,
	).Scan(&target)

	if err == nil {
		http.Redirect(w, r, target, http.StatusFound)
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		renderErrorHTML(w, http.StatusInternalServerError,
			"Ошибка сервера", "Повторите попытку позднее.")
		return
	}

	// UPDATE matched no rows: figure out why.
	var (
		expiresAt  *time.Time
		clickCount int64
		maxClicks  *int
	)
	err = h.pool.QueryRow(r.Context(),
		`SELECT expires_at, click_count, max_clicks FROM links WHERE code = $1`,
		code,
	).Scan(&expiresAt, &clickCount, &maxClicks)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			renderErrorHTML(w, http.StatusNotFound,
				"Ссылка не найдена",
				"Возможно, она была удалена или адрес введён с ошибкой.")
			return
		}
		renderErrorHTML(w, http.StatusInternalServerError,
			"Ошибка сервера", "Повторите попытку позднее.")
		return
	}

	if expiresAt != nil && time.Now().After(*expiresAt) {
		renderErrorHTML(w, http.StatusGone,
			"Срок действия ссылки истёк",
			"Эта короткая ссылка больше не активна.")
		return
	}
	renderErrorHTML(w, http.StatusGone,
		"Лимит переходов исчерпан",
		"По этой ссылке нельзя больше перейти.")
}
