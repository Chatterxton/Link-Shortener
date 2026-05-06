package handlers

import (
	"fmt"
	"html"
	"net/http"
)

const errorPageTemplate = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>%s</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%%; margin: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    display: flex; align-items: center; justify-content: center;
    background: #fff; color: #0f172a;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #020617; color: #f1f5f9; }
    .card { background: rgba(15, 23, 42, 0.6); border-color: #1e293b; }
    .muted { color: #94a3b8; }
    .code { color: #64748b; }
  }
  .card {
    max-width: 28rem; width: calc(100%% - 2rem); padding: 2rem 1.75rem;
    border: 1px solid #e2e8f0; border-radius: 14px;
    background: #f8fafc;
    text-align: center;
  }
  .code { font-family: ui-monospace, "Cascadia Mono", "JetBrains Mono", monospace; font-size: 0.8rem; letter-spacing: 0.04em; color: #64748b; margin: 0 0 0.75rem; }
  h1 { margin: 0 0 0.5rem; font-size: 1.5rem; font-weight: 600; }
  p { margin: 0; line-height: 1.55; font-size: 0.95rem; }
  .muted { color: #475569; }
</style>
</head>
<body>
  <main class="card">
    <p class="code">HTTP %d</p>
    <h1>%s</h1>
    <p class="muted">%s</p>
  </main>
</body>
</html>`

func renderErrorHTML(w http.ResponseWriter, status int, title, message string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	_, _ = fmt.Fprintf(w, errorPageTemplate, html.EscapeString(title), status, html.EscapeString(title), html.EscapeString(message))
}
