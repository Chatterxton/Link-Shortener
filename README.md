# Link Shortener

A self-hosted URL shortener with a Go backend, a Next.js + Tailwind frontend,
and PostgreSQL — all wired up via `docker-compose` and designed to sit behind
your existing host nginx.

![Go](https://img.shields.io/badge/Go-1.22-00ADD8?logo=go&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38BDF8?logo=tailwindcss&logoColor=white)
![Postgres](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

---

## Features

- **Login / register** — JWT-based, bcrypt-hashed passwords
- **First user is admin** — bootstrapped automatically on initial registration
- **Custom slugs** — pick your own (`/r/my-link`) or let the server generate one
- **Optional expiration** — links can be set to expire at a specific time
- **Admin panel** — list & delete users, view & delete every link in the system
- **Single binary backend** — embedded SQL migrations, no extra tooling
- **Production-ready compose** — services bind to `127.0.0.1`, ready for a reverse proxy

---

## Tech stack

| Layer    | Tech                                                    |
| -------- | ------------------------------------------------------- |
| Backend  | Go 1.22, [chi](https://github.com/go-chi/chi), [pgx](https://github.com/jackc/pgx), `golang-jwt`, `bcrypt` |
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS 3       |
| Database | PostgreSQL 16                                           |
| Runtime  | Docker Compose                                          |
| Proxy    | Host nginx (config example included)                    |

---

## Architecture

```
                  ┌─────────────────────────────────────────────┐
   internet ────► │  nginx on host (TLS, virtual host)          │
                  └────────┬─────────────────────────┬──────────┘
                           │                         │
            /api/*, /r/*   ▼                         ▼   everything else
                  ┌────────────────┐         ┌───────────────────┐
                  │ backend:8080   │         │ frontend:3000     │
                  │ (Go, chi)      │         │ (Next.js standalone)
                  └───────┬────────┘         └───────────────────┘
                          │
                          ▼
                  ┌────────────────┐
                  │ postgres:5432  │
                  └────────────────┘
       (all three containers publish only to 127.0.0.1)
```

Short URLs are intentionally prefixed with `/r/` so the host nginx can route
cleanly without an explicit allow-list of frontend routes.

---

## Quick start

```bash
git clone https://github.com/Chatterxton/Link-Shortener.git
cd Link-Shortener
cp .env.example .env
# edit .env — at minimum set JWT_SECRET, POSTGRES_PASSWORD and PUBLIC_DOMAIN

docker compose up -d --build
```

Open `http://localhost:3000` (or your domain through nginx) and register —
the first account becomes admin.

---

## Configuration

All config lives in a single `.env` file at the repo root.

| Variable               | Default     | Purpose                                                      |
| ---------------------- | ----------- | ------------------------------------------------------------ |
| `PUBLIC_DOMAIN`        | `localhost` | Domain shown in generated short URLs                         |
| `PUBLIC_SCHEME`        | `http`      | `http` or `https` for generated short URLs                   |
| `PUBLIC_PORT_SUFFIX`   | *(empty)*   | e.g. `:8080` for direct dev access; leave empty behind nginx |
| `BACKEND_PORT`         | `8080`      | Host port for backend (bound to `127.0.0.1`)                 |
| `FRONTEND_PORT`        | `3000`      | Host port for frontend (bound to `127.0.0.1`)                |
| `POSTGRES_USER`        | `shortener` | DB user                                                      |
| `POSTGRES_PASSWORD`    | —           | DB password (**change this**)                                |
| `POSTGRES_DB`          | `shortener` | DB name                                                      |
| `POSTGRES_PORT`        | `5432`      | Host port for postgres (bound to `127.0.0.1`)                |
| `JWT_SECRET`           | —           | Random string used to sign JWTs (**change this**)            |
| `JWT_TTL_HOURS`        | `72`        | Token lifetime                                               |
| `SHORT_CODE_LENGTH`    | `7`         | Length of auto-generated codes (base62)                      |
| `NEXT_PUBLIC_API_BASE` | *(empty)*   | Empty = same-origin via nginx; set to `http://localhost:8080` for direct dev |

---

## API reference

| Method   | Path                       | Auth        | Purpose                                                |
| -------- | -------------------------- | ----------- | ------------------------------------------------------ |
| `POST`   | `/api/auth/register`       | public      | Create account; first registration is granted admin    |
| `POST`   | `/api/auth/login`          | public      | Get a JWT                                              |
| `GET`    | `/api/auth/me`             | bearer      | Current user                                           |
| `GET`    | `/api/links`               | bearer      | List your links                                        |
| `POST`   | `/api/links`               | bearer      | Create a link (`target_url`, optional `custom_slug`, `expires_at` RFC3339) |
| `DELETE` | `/api/links/{id}`          | bearer      | Delete your own link (admin can delete any)            |
| `GET`    | `/api/admin/users`         | admin       | List all users with link counts                        |
| `DELETE` | `/api/admin/users/{id}`    | admin       | Delete a user and all their links                      |
| `GET`    | `/api/admin/links`         | admin       | List every link in the system                          |
| `GET`    | `/r/{code}`                | public      | Resolve a short link → 302 redirect (410 if expired)   |
| `GET`    | `/healthz`                 | public      | Liveness probe                                         |

### Example

```bash
# Register (first call → admin)
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"hunter2!"}'

# Create a link with a custom slug + expiration
curl -X POST http://localhost:8080/api/links \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"target_url":"https://example.com","custom_slug":"hello","expires_at":"2026-12-31T23:59:59Z"}'
```

---

## Hosting it behind your nginx

The compose file binds every container port to `127.0.0.1`, so nothing is
exposed to the internet directly. Drop something like the snippet below into
your existing nginx config (full example: [`nginx.example.conf`](nginx.example.conf)):

```nginx
server {
    listen 443 ssl;
    server_name short.example.com;

    # ssl_certificate ... ;

    location /api/ { proxy_pass http://127.0.0.1:8080; }
    location /r/   { proxy_pass http://127.0.0.1:8080; }
    location /     { proxy_pass http://127.0.0.1:3000; }
}
```

Then in `.env`:

```env
PUBLIC_DOMAIN=short.example.com
PUBLIC_SCHEME=https
PUBLIC_PORT_SUFFIX=
NEXT_PUBLIC_API_BASE=
```

`NEXT_PUBLIC_API_BASE` is left empty so the frontend uses same-origin
relative requests — nginx routes them to the right container.

---

## Project structure

```
.
├── backend/                  # Go service
│   ├── main.go               # router, server lifecycle
│   ├── internal/
│   │   ├── auth/             # JWT manager
│   │   ├── config/           # env loader
│   │   ├── db/               # pgx pool + embedded migrations
│   │   ├── handlers/         # auth, links, admin, redirect, shared utils
│   │   └── middleware/       # auth/admin guards, CORS
│   └── Dockerfile
├── frontend/                 # Next.js app
│   ├── src/app/              # /, /login, /register, /dashboard, /admin
│   ├── src/components/       # Navbar
│   ├── src/lib/              # api client, auth store
│   └── Dockerfile
├── docker-compose.yml
├── nginx.example.conf
└── .env.example
```

---

## Development notes

- **Migrations** are embedded into the binary via `embed.FS` and executed on
  every boot — they're written with `IF NOT EXISTS`, so re-running is safe.
- **Short codes** use a base62 alphabet, generated with `crypto/rand`. On the
  rare collision the handler retries up to 10 times before failing.
- **Expired links** return HTTP `410 Gone` rather than a redirect — they stay
  in the DB so the slug isn't silently reusable.
- **Admin bootstrap** is decided at registration time (`COUNT(*) == 0`) inside
  a transaction, so two simultaneous first-registrations can't both win.
