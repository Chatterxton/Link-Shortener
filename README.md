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

## Деплой на продакшен

Гайд написан под Ubuntu/Debian-сервер с уже работающим nginx. На других
дистрибутивах меняются только команды установки пакетов.

### 1. Подготовка сервера

Установите Docker Engine и плагин Compose, если их ещё нет:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo apt install -y docker-compose-plugin
sudo usermod -aG docker $USER
# перелогиньтесь, чтобы группа docker применилась
```

Проверьте версии:

```bash
docker --version
docker compose version
```

### 2. DNS-записи

До настройки nginx и выпуска SSL домен должен резолвиться в IP сервера.
В панели вашего DNS-провайдера (регистратор, Cloudflare, Route 53 и т.п.)
создайте запись:

| Тип    | Имя/Host                 | Значение            | TTL   |
| ------ | ------------------------ | ------------------- | ----- |
| `A`    | `short` *(или `@` для apex-домена)* | публичный IPv4 сервера | `300` |
| `AAAA` | `short` *(опционально)*  | публичный IPv6 сервера | `300` |

Если короткий домен — это поддомен уже существующего сайта, можно
использовать `CNAME` вместо `A`, но **не на apex-домене** (для `example.com`
обязательно `A`/`AAAA`).

Низкий TTL (`300`) удобен на этапе настройки — если ошиблись, исправление
подхватится за 5 минут. После того как всё работает, можно поднять до
`3600`–`86400`.

Подождите распространения записи (обычно минуты, иногда до пары часов)
и проверьте, что домен указывает на ваш сервер:

```bash
dig +short short.example.com
# или
nslookup short.example.com 1.1.1.1
```

Должен вернуться IP вашего сервера. Если используете **Cloudflare с
проксированием** (оранжевая тучка), для выпуска сертификата через
`certbot --nginx` (HTTP-01 challenge) проксирование нужно временно
отключить (поставить «DNS only»), либо использовать DNS-01 challenge
с плагином `python3-certbot-dns-cloudflare`.

Заодно убедитесь, что фаервол на сервере пропускает входящий трафик на
порты `80` и `443`:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 3. Клонирование и настройка `.env`

```bash
sudo mkdir -p /opt/link-shortener
sudo chown $USER:$USER /opt/link-shortener
cd /opt/link-shortener
git clone https://github.com/Chatterxton/Link-Shortener.git .
cp .env.example .env
```

Сгенерируйте безопасные секреты и подставьте их в `.env`:

```bash
# Сильный JWT-секрет
openssl rand -hex 48
# Пароль для postgres
openssl rand -base64 24
```

Минимальный продакшен-`.env`:

```env
PUBLIC_DOMAIN=short.example.com
PUBLIC_SCHEME=https
PUBLIC_PORT_SUFFIX=

BACKEND_PORT=8080
FRONTEND_PORT=3000

POSTGRES_USER=shortener
POSTGRES_PASSWORD=<сгенерированный пароль>
POSTGRES_DB=shortener
POSTGRES_PORT=5432

JWT_SECRET=<сгенерированный hex-секрет>
JWT_TTL_HOURS=72
SHORT_CODE_LENGTH=7

NEXT_PUBLIC_API_BASE=
```

> Если на хосте уже занят какой-то из портов 8080/3000/5432 — поменяйте
> `*_PORT` в `.env` и одновременно поправьте upstream-ы в nginx.

### 4. Запуск контейнеров

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend   # убедитесь, что миграции применились
```

Все три сервиса должны быть в статусе `running` и слушать только на
`127.0.0.1`. Проверка:

```bash
ss -ltn | grep -E '127\.0\.0\.1:(3000|8080|5432)'
curl -fsS http://127.0.0.1:8080/healthz && echo OK
```

### 5. Настройка nginx

Создайте конфиг сайта на основе [`nginx.example.conf`](nginx.example.conf):

```bash
sudo cp nginx.example.conf /etc/nginx/sites-available/link-shortener
sudo nano /etc/nginx/sites-available/link-shortener   # поправьте server_name
sudo ln -s /etc/nginx/sites-available/link-shortener /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Минимальный server-блок (HTTP, без TLS — будет добавлен на следующем шаге):

```nginx
server {
    listen 80;
    server_name short.example.com;

    location /api/ { proxy_pass http://127.0.0.1:8080; }
    location /r/   { proxy_pass http://127.0.0.1:8080; }
    location /     { proxy_pass http://127.0.0.1:3000; }
}
```

Не забудьте проставить proxy-заголовки (`Host`, `X-Forwarded-For`,
`X-Forwarded-Proto`) — они уже есть в [`nginx.example.conf`](nginx.example.conf).

### 6. SSL через Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d short.example.com
```

Certbot сам отредактирует ваш nginx-конфиг (добавит `listen 443 ssl;` и
блок редиректа `80 → 443`). Автообновление по таймеру включено по
умолчанию — проверить можно через `systemctl list-timers | grep certbot`.

После выпуска сертификата в `.env` уже стоит `PUBLIC_SCHEME=https`, так
что сгенерированные короткие ссылки автоматически получат правильный
протокол.

### 7. Первая регистрация

Откройте `https://short.example.com/register` и создайте аккаунт — он
получит права администратора. Сразу после этого можно пользоваться
сервисом или закрыть регистрацию (см. ниже).

### 8. Обновление

```bash
cd /opt/link-shortener
git pull
docker compose up -d --build
```

Миграции применятся автоматически при старте бэкенда.

### 9. Бэкап БД

Том postgres называется `link-shortener_db_data`. Дамп руками:

```bash
docker compose exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > backup-$(date +%F).sql.gz
```

Восстановление:

```bash
gunzip -c backup-2026-05-06.sql.gz \
  | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Имеет смысл повесить это на cron + класть в S3/rsync на удалённое
хранилище.

### 10. Полезные команды

```bash
docker compose logs -f backend         # логи бэкенда
docker compose logs -f frontend        # логи фронтенда
docker compose restart backend         # перезапустить один сервис
docker compose down                    # остановить всё (данные сохраняются в томе)
docker compose down -v                 # ВНИМАНИЕ: удалит том БД
docker compose exec db psql -U "$POSTGRES_USER" "$POSTGRES_DB"  # psql внутри контейнера
```

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
