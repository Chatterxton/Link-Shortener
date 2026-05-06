# Link Shortener

Самохостящийся сокращатель ссылок: бэкенд на Go, фронтенд на Next.js + Tailwind,
PostgreSQL — всё связано через `docker-compose` и спроектировано так, чтобы
работать за уже стоящим на сервере nginx.

![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38BDF8?logo=tailwindcss&logoColor=white)
![Postgres](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

---

## Возможности

- **Закрытая регистрация** — публично доступна только разовая bootstrap-форма
  для первого администратора; все последующие учётные записи создаёт админ
  через панель управления
- **JWT в `httpOnly` cookie** — токен недоступен из JavaScript, защита от XSS
- **Rate limiting** — `/api/auth/login` и `/r/{code}` ограничены по IP
- **Кастомные slug-и и автогенерация** короткого кода
- **Срок действия** — пресеты (1 час, 24 часа, 7 дней, 30 дней) или своя дата
- **Лимит переходов** — например, одноразовая ссылка
- **Описание ссылки** — внутреннее поле для менеджера («Видео для клиента X»)
- **Счётчик переходов** — видно сколько раз уже открывали
- **Админ-панель** — создание/удаление пользователей, просмотр всех ссылок
- **Кастомные страницы ошибок** — для истёкших ссылок и исчерпанных лимитов,
  с поддержкой светлой и тёмной темы
- **Светлая и тёмная темы** — автоматически подхватывают системную настройку,
  сохраняют ручной выбор пользователя
- **Собственный календарь** — без зависимостей, с русской локализацией
- **Готов к продакшену** — все контейнеры публикуют порты только на `127.0.0.1`,
  заголовки безопасности, защита от TOCTOU-гонок при инкременте счётчика

---

## Стек

| Слой     | Технологии                                              |
| -------- | ------------------------------------------------------- |
| Backend  | Go 1.24, [chi](https://github.com/go-chi/chi), [pgx](https://github.com/jackc/pgx), [httprate](https://github.com/go-chi/httprate), `golang-jwt`, `bcrypt` |
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS 3       |
| БД       | PostgreSQL 16                                           |
| Runtime  | Docker Compose                                          |
| Прокси   | Хостовый nginx (TLS, редирект, rate limiting)           |

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

Короткие ссылки идут с префиксом `/r/`, чтобы хостовый nginx мог
маршрутизировать их без явного списка путей фронтенда.

---

## Быстрый старт (локально)

```bash
git clone https://github.com/Chatterxton/Link-Shortener.git
cd Link-Shortener
cp .env.example .env
# отредактируйте .env — как минимум JWT_SECRET и POSTGRES_PASSWORD

docker compose up -d --build
```

Откройте `http://localhost:3000` и создайте первого пользователя — он получит
права администратора.

---

## Конфигурация

Вся конфигурация — в одном `.env` в корне репозитория.

| Переменная               | По умолчанию | Назначение                                                    |
| ------------------------ | ------------ | ------------------------------------------------------------- |
| `PUBLIC_DOMAIN`          | `localhost`  | Домен, который попадёт в сгенерированные короткие ссылки      |
| `PUBLIC_SCHEME`          | `http`       | `http` или `https` — определяет также флаг `Secure` у cookie  |
| `PUBLIC_PORT_SUFFIX`     | *(пусто)*    | Например `:8080` для прямого dev-доступа; пусто за nginx      |
| `BACKEND_PORT`           | `8080`       | Порт бэкенда на хосте (привязан к `127.0.0.1`)                |
| `FRONTEND_PORT`          | `3000`       | Порт фронтенда на хосте (привязан к `127.0.0.1`)              |
| `POSTGRES_USER`          | `shortener`  | Пользователь БД                                               |
| `POSTGRES_PASSWORD`      | —            | Пароль БД (**обязательно поменять**)                          |
| `POSTGRES_DB`            | `shortener`  | Имя БД                                                        |
| `POSTGRES_PORT`          | `5432`       | Порт postgres на хосте (привязан к `127.0.0.1`)               |
| `JWT_SECRET`             | —            | Длинная случайная строка для подписи JWT (**обязательно поменять**) |
| `JWT_TTL_HOURS`          | `72`         | Время жизни токена и cookie                                   |
| `SHORT_CODE_LENGTH`      | `7`          | Длина автоматически генерируемого кода (base62)               |
| `REDIRECT_RATE_PER_MIN`  | `60`         | Лимит запросов к `/r/{code}` на один IP в минуту              |
| `LOGIN_RATE_PER_MIN`     | `10`         | Лимит попыток `/api/auth/login` и `/api/auth/register` на IP  |
| `CORS_ORIGIN`            | *(пусто)*    | В production за nginx — пусто (same-origin). Для dev: `http://localhost:3000` |
| `NEXT_PUBLIC_API_BASE`   | *(пусто)*    | Пусто = same-origin через nginx; для прямого dev: `http://localhost:8080` |

---

## API

| Метод    | Путь                       | Доступ      | Назначение                                                |
| -------- | -------------------------- | ----------- | --------------------------------------------------------- |
| `GET`    | `/api/auth/needs-bootstrap`| публичный   | `{needs_bootstrap: bool}` — нужна ли первичная регистрация |
| `POST`   | `/api/auth/register`       | публичный\* | Регистрация **только** пока в БД нет ни одного пользователя |
| `POST`   | `/api/auth/login`          | публичный   | Ставит httpOnly-cookie `auth_token`                       |
| `POST`   | `/api/auth/logout`         | публичный   | Чистит cookie                                             |
| `GET`    | `/api/auth/me`             | cookie      | Текущий пользователь                                      |
| `GET`    | `/api/links`               | cookie      | Список ваших ссылок                                       |
| `POST`   | `/api/links`               | cookie      | Создать ссылку (`target_url`, опц. `custom_slug`, `expires_at`, `note`, `max_clicks`) |
| `DELETE` | `/api/links/{id}`          | cookie      | Удалить свою ссылку (админ может удалить любую)           |
| `GET`    | `/api/admin/users`         | admin       | Список пользователей со счётчиком ссылок                  |
| `POST`   | `/api/admin/users`         | admin       | Создать пользователя (`username`, `password`, `is_admin`) |
| `DELETE` | `/api/admin/users/{id}`    | admin       | Удалить пользователя со всеми его ссылками                |
| `GET`    | `/api/admin/links`         | admin       | Список всех ссылок в системе                              |
| `GET`    | `/r/{code}`                | публичный   | Атомарный инкремент счётчика и 302-редирект (или HTML 410) |
| `GET`    | `/healthz`                 | публичный   | Liveness                                                  |

\* После создания первого пользователя `POST /api/auth/register` возвращает 403.

### Пример

```bash
# Первичный bootstrap-админ (только пока БД пустая):
curl -X POST https://short.example.com/api/auth/register \
  -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"strong-password"}'

# Создать одноразовую ссылку с описанием и сроком действия:
curl -X POST https://short.example.com/api/links \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
        "target_url":"https://s3.example.com/video.mp4?signature=...",
        "note":"Презентация для ООО Ромашка",
        "max_clicks":1,
        "expires_at":"2026-12-31T23:59:59Z"
      }'
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

Откройте порты `80` и `443` в фаерволе:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 2. DNS-записи

В панели вашего DNS-провайдера (регистратор, Cloudflare, Route 53 и т.п.)
создайте `A`-запись:

| Тип | Имя/Host                            | Значение               | TTL   |
| --- | ----------------------------------- | ---------------------- | ----- |
| `A` | `short` *(или `@` для apex-домена)* | публичный IPv4 сервера | `300` |

Если короткий домен — это поддомен уже существующего сайта, можно использовать
`CNAME` вместо `A`, но **не на apex-домене** (для `example.com` обязательно `A`).

Низкий TTL (`300`) удобен на этапе настройки. После того как всё работает,
можно поднять до `3600`–`86400`.

Подождите распространения и проверьте, что домен указывает на сервер:

```bash
dig +short short.example.com
```

Если используете **Cloudflare с проксированием** (оранжевая тучка), для
выпуска сертификата через `certbot` проксирование нужно временно отключить
(перевести в «DNS only»), либо использовать DNS-01 challenge с плагином
`python3-certbot-dns-cloudflare`.

### 3. Получение SSL-сертификата

Установите certbot и плагин для nginx:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Выпустите сертификат через HTTP-01 challenge — certbot временно поднимет
свой обработчик `/.well-known/acme-challenge/` рядом с уже работающим nginx:

```bash
sudo certbot certonly --nginx -d short.example.com
```

Если nginx ещё не запущен, можно использовать `--standalone`
(порт `80` должен быть свободен):

```bash
sudo certbot certonly --standalone -d short.example.com
```

После успешного выпуска сертификат и ключ окажутся в
`/etc/letsencrypt/live/short.example.com/`. Включите автообновление:

```bash
sudo systemctl enable --now certbot.timer
systemctl list-timers | grep certbot
```

### 4. Клонирование и настройка `.env`

```bash
sudo mkdir -p /opt/link-shortener
sudo chown $USER:$USER /opt/link-shortener
cd /opt/link-shortener
git clone https://github.com/Chatterxton/Link-Shortener.git .
cp .env.example .env
```

Сгенерируйте безопасные секреты и подставьте их в `.env`:

```bash
openssl rand -hex 48      # JWT_SECRET
openssl rand -base64 24   # POSTGRES_PASSWORD
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

REDIRECT_RATE_PER_MIN=60
LOGIN_RATE_PER_MIN=10

CORS_ORIGIN=
NEXT_PUBLIC_API_BASE=
```

> Если на хосте уже занят какой-то из портов 8080/3000/5432 — поменяйте
> `*_PORT` в `.env` и одновременно поправьте upstream-ы в nginx.

### 5. Запуск контейнеров

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

### 6. Настройка nginx

Создайте конфиг сайта (предполагается, что сертификат уже выпущен —
см. [шаг 3](#3-получение-ssl-сертификата)):

```bash
sudo nano /etc/nginx/sites-available/link-shortener
```

```nginx
server {
    listen 80;
    server_name short.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name short.example.com;

    ssl_certificate     /etc/letsencrypt/live/short.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/short.example.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Content-Type-Options    "nosniff"                             always;

    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    location /api/ { proxy_pass http://127.0.0.1:8080; }
    location /r/   { proxy_pass http://127.0.0.1:8080; }
    location /     { proxy_pass http://127.0.0.1:3000; }
}
```

Включите сайт и перезагрузите nginx:

```bash
sudo ln -s /etc/nginx/sites-available/link-shortener /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 7. Первая регистрация

Откройте `https://short.example.com/register` и создайте первого пользователя —
он получит права администратора. Сразу после этого публичная регистрация
автоматически закрывается (`/register` начнёт редиректить на `/login`,
а `POST /api/auth/register` будет отвечать 403).

### 8. Создание остальных пользователей

Зайдите в `https://short.example.com/admin`, нажмите **«Добавить»** в секции
«Пользователи», задайте логин, пароль и при необходимости поставьте флаг
«Администратор». Менеджеры могут не быть админами и будут видеть только
свои ссылки.

### 9. Обновление

```bash
cd /opt/link-shortener
git pull
docker compose up -d --build
```

Миграции БД применятся автоматически при старте бэкенда (`IF NOT EXISTS`).

### 10. Бэкап БД

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

Имеет смысл повесить это на cron + класть в S3/rsync на удалённое хранилище.

### 11. Полезные команды

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
│   ├── main.go               # роутер, жизненный цикл сервера, rate limiting
│   ├── internal/
│   │   ├── auth/             # JWT-менеджер
│   │   ├── config/           # загрузка переменных окружения
│   │   ├── db/               # pgx pool + embedded-миграции
│   │   ├── handlers/         # auth, links, admin, redirect, страницы ошибок
│   │   └── middleware/       # auth/admin guard-ы, CORS, security headers
│   └── Dockerfile
├── frontend/                 # Next.js-приложение
│   ├── src/app/              # /, /login, /register, /dashboard, /admin
│   ├── src/components/       # Modal, ConfirmDialog, Toggle, DateTimePicker, ThemeToggle, ...
│   ├── src/lib/              # API-клиент, auth-store, тема
│   └── Dockerfile
├── docker-compose.yml
├── nginx.example.conf
└── .env.example
```
