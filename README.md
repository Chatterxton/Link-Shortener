# Link Shortener

Самохостящийся сокращатель ссылок: бэкенд на Go, фронтенд на Next.js + Tailwind,
PostgreSQL — всё связано через `docker-compose` и спроектировано так, чтобы
работать за уже стоящим на сервере nginx.

![Go](https://img.shields.io/badge/Go-1.22-00ADD8?logo=go&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38BDF8?logo=tailwindcss&logoColor=white)
![Postgres](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

---

## Возможности

- **Регистрация и вход** — JWT, пароли хешируются bcrypt
- **Первый пользователь становится админом** — назначается автоматически при первой регистрации
- **Кастомные slug-и** — можно задать свой (`/r/my-link`) либо позволить серверу сгенерировать
- **Опциональный срок действия** — у ссылки можно задать дату истечения
- **Админ-панель** — список и удаление пользователей, просмотр и удаление любых ссылок
- **Один бинарник на бэкенде** — миграции встроены через `embed`, дополнительные тулзы не нужны
- **Готов к продакшену** — все контейнеры публикуют порты только на `127.0.0.1`, готовы для reverse-proxy

---

## Стек

| Слой     | Технологии                                              |
| -------- | ------------------------------------------------------- |
| Backend  | Go 1.22, [chi](https://github.com/go-chi/chi), [pgx](https://github.com/jackc/pgx), `golang-jwt`, `bcrypt` |
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS 3       |
| БД       | PostgreSQL 16                                           |
| Runtime  | Docker Compose                                          |
| Прокси   | Хостовый nginx (пример конфига в комплекте)             |

---

## Архитектура

```
                  ┌─────────────────────────────────────────────┐
   интернет ────► │  nginx на хосте (TLS, virtual host)         │
                  └────────┬─────────────────────────┬──────────┘
                           │                         │
            /api/*, /r/*   ▼                         ▼   всё остальное
                  ┌────────────────┐         ┌───────────────────┐
                  │ backend:8080   │         │ frontend:3000     │
                  │ (Go, chi)      │         │ (Next.js standalone)
                  └───────┬────────┘         └───────────────────┘
                          │
                          ▼
                  ┌────────────────┐
                  │ postgres:5432  │
                  └────────────────┘
       (все три контейнера публикуются только на 127.0.0.1)
```

Короткие ссылки намеренно идут с префиксом `/r/`, чтобы хостовый nginx мог
маршрутизировать их без явного списка путей фронтенда.

---

## Быстрый старт

```bash
git clone https://github.com/Chatterxton/Link-Shortener.git
cd Link-Shortener
cp .env.example .env
# отредактируйте .env — как минимум JWT_SECRET, POSTGRES_PASSWORD и PUBLIC_DOMAIN

docker compose up -d --build
```

Откройте `http://localhost:3000` (или ваш домен через nginx) и зарегистрируйтесь —
первый созданный аккаунт получит права администратора.

---

## Конфигурация

Вся конфигурация — в одном `.env` в корне репозитория.

| Переменная             | По умолчанию | Назначение                                                    |
| ---------------------- | ------------ | ------------------------------------------------------------- |
| `PUBLIC_DOMAIN`        | `localhost`  | Домен, который попадёт в сгенерированные короткие ссылки      |
| `PUBLIC_SCHEME`        | `http`       | `http` или `https` для коротких ссылок                        |
| `PUBLIC_PORT_SUFFIX`   | *(пусто)*    | Например `:8080` для прямого dev-доступа; пусто за nginx      |
| `BACKEND_PORT`         | `8080`       | Порт бэкенда на хосте (привязан к `127.0.0.1`)                |
| `FRONTEND_PORT`        | `3000`       | Порт фронтенда на хосте (привязан к `127.0.0.1`)              |
| `POSTGRES_USER`        | `shortener`  | Пользователь БД                                               |
| `POSTGRES_PASSWORD`    | —            | Пароль БД (**обязательно поменять**)                          |
| `POSTGRES_DB`          | `shortener`  | Имя БД                                                        |
| `POSTGRES_PORT`        | `5432`       | Порт postgres на хосте (привязан к `127.0.0.1`)               |
| `JWT_SECRET`           | —            | Длинная случайная строка для подписи JWT (**обязательно поменять**) |
| `JWT_TTL_HOURS`        | `72`         | Время жизни токена                                            |
| `SHORT_CODE_LENGTH`    | `7`          | Длина автоматически генерируемого кода (base62)               |
| `NEXT_PUBLIC_API_BASE` | *(пусто)*    | Пусто = same-origin через nginx; для прямого dev: `http://localhost:8080` |

---

## API

| Метод    | Путь                       | Доступ      | Назначение                                              |
| -------- | -------------------------- | ----------- | ------------------------------------------------------- |
| `POST`   | `/api/auth/register`       | публичный   | Регистрация; первая регистрация даёт права админа       |
| `POST`   | `/api/auth/login`          | публичный   | Получить JWT                                            |
| `GET`    | `/api/auth/me`             | bearer      | Текущий пользователь                                    |
| `GET`    | `/api/links`               | bearer      | Список ваших ссылок                                     |
| `POST`   | `/api/links`               | bearer      | Создать ссылку (`target_url`, опционально `custom_slug`, `expires_at` RFC3339) |
| `DELETE` | `/api/links/{id}`          | bearer      | Удалить свою ссылку (админ может удалить любую)         |
| `GET`    | `/api/admin/users`         | admin       | Список всех пользователей со счётчиком ссылок           |
| `DELETE` | `/api/admin/users/{id}`    | admin       | Удалить пользователя со всеми его ссылками              |
| `GET`    | `/api/admin/links`         | admin       | Список всех ссылок в системе                            |
| `GET`    | `/r/{code}`                | публичный   | Перейти по короткой ссылке → 302 (410, если истекла)    |
| `GET`    | `/healthz`                 | публичный   | Healthcheck                                             |

### Пример

```bash
# Регистрация (первая → становится админом)
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"hunter2!"}'

# Создание ссылки с кастомным slug-ом и сроком действия
curl -X POST http://localhost:8080/api/links \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"target_url":"https://example.com","custom_slug":"hello","expires_at":"2026-12-31T23:59:59Z"}'
```

---

## Размещение за хостовым nginx

Compose-файл привязывает все порты контейнеров к `127.0.0.1`, поэтому
наружу ничего напрямую не торчит. В существующий конфиг nginx добавьте
что-то такое (полный пример — в [`nginx.example.conf`](nginx.example.conf)):

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

И в `.env`:

```env
PUBLIC_DOMAIN=short.example.com
PUBLIC_SCHEME=https
PUBLIC_PORT_SUFFIX=
NEXT_PUBLIC_API_BASE=
```

`NEXT_PUBLIC_API_BASE` остаётся пустым — фронтенд будет ходить
относительными путями к тому же домену, а nginx направит запросы
в нужный контейнер.

---

## Структура проекта

```
.
├── backend/                  # Go-сервис
│   ├── main.go               # роутер, жизненный цикл сервера
│   ├── internal/
│   │   ├── auth/             # JWT-менеджер
│   │   ├── config/           # загрузка переменных окружения
│   │   ├── db/               # pgx pool + embedded-миграции
│   │   ├── handlers/         # auth, links, admin, redirect, общие утилиты
│   │   └── middleware/       # auth/admin guard-ы, CORS
│   └── Dockerfile
├── frontend/                 # Next.js-приложение
│   ├── src/app/              # /, /login, /register, /dashboard, /admin
│   ├── src/components/       # Navbar
│   ├── src/lib/              # API-клиент, хранилище токена
│   └── Dockerfile
├── docker-compose.yml
├── nginx.example.conf
└── .env.example
```

---

## Заметки разработчика

- **Миграции** встроены в бинарник через `embed.FS` и применяются при каждом
  запуске — все они написаны с `IF NOT EXISTS`, повторный запуск безопасен.
- **Короткие коды** генерируются из алфавита base62 через `crypto/rand`. На
  редкой коллизии хендлер делает до 10 повторных попыток.
- **Истёкшие ссылки** возвращают HTTP `410 Gone`, а не редирект, — они
  остаются в БД, чтобы slug нельзя было молча переиспользовать.
- **Bootstrap админа** определяется в момент регистрации (`COUNT(*) == 0`)
  внутри транзакции, так что две одновременные первые регистрации
  не смогут обе получить права.
