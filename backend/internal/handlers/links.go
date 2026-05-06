package handlers

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/vladimir/link-shortener/internal/config"
	"github.com/vladimir/link-shortener/internal/middleware"
)

const codeAlphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

var (
	slugRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,64}$`)
	urlRegex  = regexp.MustCompile(`^https?://`)
)

type LinksHandler struct {
	pool *pgxpool.Pool
	cfg  *config.Config
}

func NewLinksHandler(pool *pgxpool.Pool, cfg *config.Config) *LinksHandler {
	return &LinksHandler{pool: pool, cfg: cfg}
}

type createLinkReq struct {
	TargetURL  string  `json:"target_url"`
	CustomSlug string  `json:"custom_slug,omitempty"`
	ExpiresAt  *string `json:"expires_at,omitempty"`
}

type linkView struct {
	ID        int64      `json:"id"`
	Code      string     `json:"code"`
	ShortURL  string     `json:"short_url"`
	TargetURL string     `json:"target_url"`
	UserID    int64      `json:"user_id"`
	Username  string     `json:"username,omitempty"`
	ExpiresAt *time.Time `json:"expires_at"`
	CreatedAt time.Time  `json:"created_at"`
}

func shortURL(cfg *config.Config, code string) string {
	return cfg.PublicBase() + "/r/" + code
}

func (h *LinksHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createLinkReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный запрос")
		return
	}
	req.TargetURL = strings.TrimSpace(req.TargetURL)
	if !urlRegex.MatchString(req.TargetURL) {
		writeError(w, http.StatusBadRequest, "Ссылка должна начинаться с http:// или https://")
		return
	}

	var expiresAt *time.Time
	if req.ExpiresAt != nil && *req.ExpiresAt != "" {
		t, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Некорректный формат срока действия")
			return
		}
		if t.Before(time.Now()) {
			writeError(w, http.StatusBadRequest, "Срок действия должен быть в будущем")
			return
		}
		expiresAt = &t
	}

	uid := middleware.UserID(r.Context())
	var code string

	if strings.TrimSpace(req.CustomSlug) != "" {
		slug := strings.TrimSpace(req.CustomSlug)
		if !slugRegex.MatchString(slug) {
			writeError(w, http.StatusBadRequest, "Свой slug: 3-64 символа, латиница/цифры/_/-")
			return
		}
		code = slug
	} else {
		c, err := h.generateUniqueCode(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Не удалось сгенерировать код")
			return
		}
		code = c
	}

	var v linkView
	err := h.pool.QueryRow(r.Context(),
		`INSERT INTO links (code, target_url, user_id, expires_at)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, code, target_url, user_id, expires_at, created_at`,
		code, req.TargetURL, uid, expiresAt,
	).Scan(&v.ID, &v.Code, &v.TargetURL, &v.UserID, &v.ExpiresAt, &v.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "Этот slug уже используется")
			return
		}
		writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
		return
	}
	v.ShortURL = shortURL(h.cfg, v.Code)
	writeJSON(w, http.StatusOK, v)
}

func (h *LinksHandler) List(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	rows, err := h.pool.Query(r.Context(),
		`SELECT id, code, target_url, user_id, expires_at, created_at
		 FROM links WHERE user_id = $1 ORDER BY created_at DESC`,
		uid,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
		return
	}
	defer rows.Close()

	out := []linkView{}
	for rows.Next() {
		var v linkView
		if err := rows.Scan(&v.ID, &v.Code, &v.TargetURL, &v.UserID, &v.ExpiresAt, &v.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
			return
		}
		v.ShortURL = shortURL(h.cfg, v.Code)
		out = append(out, v)
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *LinksHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Некорректный идентификатор")
		return
	}
	uid := middleware.UserID(r.Context())
	isAdmin := middleware.IsAdmin(r.Context())

	var sql string
	var args []any
	if isAdmin {
		sql = "DELETE FROM links WHERE id = $1"
		args = []any{id}
	} else {
		sql = "DELETE FROM links WHERE id = $1 AND user_id = $2"
		args = []any{id, uid}
	}
	cmd, err := h.pool.Exec(r.Context(), sql, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Ошибка базы данных")
		return
	}
	if cmd.RowsAffected() == 0 {
		writeError(w, http.StatusNotFound, "Ссылка не найдена")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *LinksHandler) generateUniqueCode(ctx context.Context) (string, error) {
	for i := 0; i < 10; i++ {
		code, err := randomCode(h.cfg.ShortCodeLength)
		if err != nil {
			return "", err
		}
		var exists bool
		if err := h.pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM links WHERE code = $1)", code).Scan(&exists); err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}
	return "", errors.New("could not generate unique code after retries")
}

func randomCode(n int) (string, error) {
	b := make([]byte, n)
	max := big.NewInt(int64(len(codeAlphabet)))
	for i := 0; i < n; i++ {
		idx, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		b[i] = codeAlphabet[idx.Int64()]
	}
	return string(b), nil
}
