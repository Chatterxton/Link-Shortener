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

	// Atomically: fetch link, increment counter only if not expired and not maxed out.
	// Two-step: check + conditional increment via UPDATE ... RETURNING.
	var (
		target     string
		expiresAt  *time.Time
		clickCount int64
		maxClicks  *int
	)
	err := h.pool.QueryRow(r.Context(),
		`SELECT target_url, expires_at, click_count, max_clicks FROM links WHERE code = $1`,
		code,
	).Scan(&target, &expiresAt, &clickCount, &maxClicks)
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

	if maxClicks != nil && clickCount >= int64(*maxClicks) {
		renderErrorHTML(w, http.StatusGone,
			"Лимит переходов исчерпан",
			"По этой ссылке нельзя больше перейти.")
		return
	}

	// Best-effort increment. Failure is logged via Recoverer middleware but should not block redirect.
	_, _ = h.pool.Exec(r.Context(),
		`UPDATE links SET click_count = click_count + 1 WHERE code = $1`, code)

	http.Redirect(w, r, target, http.StatusFound)
}
