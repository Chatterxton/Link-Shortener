"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Link as LinkRow } from "@/lib/api";
import { authStore } from "@/lib/auth";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Toggle } from "@/components/Toggle";
import { DateTimePicker } from "@/components/DateTimePicker";

type ExpiresMode = "preset" | "custom";
type PresetKey = "1h" | "24h" | "7d" | "30d";

const PRESETS: { key: PresetKey; label: string; hours: number }[] = [
  { key: "1h", label: "1 час", hours: 1 },
  { key: "24h", label: "24 часа", hours: 24 },
  { key: "7d", label: "7 дней", hours: 24 * 7 },
  { key: "30d", label: "30 дней", hours: 24 * 30 },
];

function addHours(date: Date, hours: number) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

export default function DashboardPage() {
  const router = useRouter();
  const [links, setLinks] = useState<LinkRow[]>([]);

  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [slugEnabled, setSlugEnabled] = useState(false);
  const [slug, setSlug] = useState("");
  const [expiresEnabled, setExpiresEnabled] = useState(false);
  const [expiresMode, setExpiresMode] = useState<ExpiresMode>("preset");
  const [presetKey, setPresetKey] = useState<PresetKey>("24h");
  const [expiresCustom, setExpiresCustom] = useState<Date | null>(null);
  const [maxClicksEnabled, setMaxClicksEnabled] = useState(false);
  const [maxClicks, setMaxClicks] = useState<string>("1");

  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listLinks();
      setLinks(data);
    } catch (err) {
      if (
        err instanceof Error &&
        /401|токен|авторизац|invalid|missing/i.test(err.message)
      ) {
        authStore.clear();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Не удалось загрузить");
    }
  }, [router]);

  useEffect(() => {
    if (!authStore.user()) {
      router.replace("/login");
      return;
    }
    refresh();
  }, [refresh, router]);

  const computeExpires = (): string | undefined => {
    if (!expiresEnabled) return undefined;
    if (expiresMode === "preset") {
      const p = PRESETS.find((x) => x.key === presetKey);
      if (!p) return undefined;
      return addHours(new Date(), p.hours).toISOString();
    }
    return expiresCustom ? expiresCustom.toISOString() : undefined;
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      slugEnabled &&
      slug.trim() &&
      !/^[a-zA-Z0-9_-]{3,64}$/.test(slug.trim())
    ) {
      setError("Свой slug: 3-64 символа, латиница/цифры/_/-");
      return;
    }
    if (expiresEnabled && expiresMode === "custom" && !expiresCustom) {
      setError("Выберите дату и время истечения");
      return;
    }
    let maxClicksVal: number | undefined;
    if (maxClicksEnabled) {
      const n = parseInt(maxClicks, 10);
      if (!Number.isFinite(n) || n <= 0) {
        setError("Лимит кликов должен быть положительным числом");
        return;
      }
      maxClicksVal = n;
    }

    setCreating(true);
    try {
      await api.createLink({
        target_url: target.trim(),
        custom_slug: slugEnabled && slug.trim() ? slug.trim() : undefined,
        expires_at: computeExpires(),
        note: note.trim() || undefined,
        max_clicks: maxClicksVal,
      });
      setTarget("");
      setNote("");
      setSlug("");
      setSlugEnabled(false);
      setExpiresEnabled(false);
      setExpiresMode("preset");
      setPresetKey("24h");
      setExpiresCustom(null);
      setMaxClicksEnabled(false);
      setMaxClicks("1");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать");
    } finally {
      setCreating(false);
    }
  };

  const performDelete = async () => {
    if (deletingId === null) return;
    try {
      await api.deleteLink(deletingId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  const copy = async (id: number, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      // ignore
    }
  };

  const inputCls =
    "w-full rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none focus:border-indigo-500 transition-colors";
  const cardCls =
    "rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40";
  const chipBase =
    "rounded-full px-3 py-1 text-xs font-medium border transition-colors";
  const chipOff =
    "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500";
  const chipOn =
    "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-500";

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold mb-4">Создать короткую ссылку</h1>
        <form onSubmit={create} className={`space-y-4 ${cardCls} p-4`}>
          <input
            className={inputCls}
            placeholder="https://example.com/очень/длинный/адрес"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
            type="url"
          />

          <input
            className={inputCls}
            placeholder="Описание (видно только вам, например: Видео для клиента X)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={255}
          />

          <div className="space-y-2">
            <Toggle
              checked={slugEnabled}
              onChange={(v) => {
                setSlugEnabled(v);
                if (!v) setSlug("");
              }}
              label="Свой slug"
              description="Например, /r/my-link вместо случайного кода"
            />
            {slugEnabled && (
              <input
                className={`${inputCls} animate-popIn`}
                placeholder="my-link"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                pattern="[a-zA-Z0-9_-]{3,64}"
                title="3-64 символа, латиница/цифры/_/-"
              />
            )}
          </div>

          <div className="space-y-2">
            <Toggle
              checked={expiresEnabled}
              onChange={(v) => {
                setExpiresEnabled(v);
                if (!v) {
                  setExpiresMode("preset");
                  setExpiresCustom(null);
                }
              }}
              label="Срок действия"
              description="Ссылка перестанет работать после указанной даты"
            />
            {expiresEnabled && (
              <div className="space-y-2 animate-popIn">
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setExpiresMode("preset");
                        setPresetKey(p.key);
                      }}
                      className={`${chipBase} ${
                        expiresMode === "preset" && presetKey === p.key
                          ? chipOn
                          : chipOff
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExpiresMode("custom")}
                    className={`${chipBase} ${
                      expiresMode === "custom" ? chipOn : chipOff
                    }`}
                  >
                    Своя дата
                  </button>
                </div>
                {expiresMode === "custom" && (
                  <DateTimePicker
                    value={expiresCustom}
                    onChange={setExpiresCustom}
                    minDate={new Date()}
                  />
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Toggle
              checked={maxClicksEnabled}
              onChange={(v) => {
                setMaxClicksEnabled(v);
                if (!v) setMaxClicks("1");
              }}
              label="Лимит кликов"
              description="После N переходов ссылка перестанет работать"
            />
            {maxClicksEnabled && (
              <input
                type="number"
                min={1}
                className={`${inputCls} animate-popIn`}
                placeholder="Например, 1 для одноразовой ссылки"
                value={maxClicks}
                onChange={(e) => setMaxClicks(e.target.value)}
              />
            )}
          </div>

          {error && (
            <p className="text-rose-600 dark:text-rose-400 text-sm">{error}</p>
          )}

          <button
            disabled={creating}
            className="rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 px-4 py-2 font-medium"
          >
            {creating ? "Создание..." : "Сократить"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Ваши ссылки</h2>
        {links.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Ссылок пока нет.
          </p>
        ) : (
          <ul
            className={`divide-y divide-slate-200 dark:divide-slate-800 ${cardCls}`}
          >
            {links.map((l) => (
              <li
                key={l.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  {l.note && (
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-0.5">
                      {l.note}
                    </div>
                  )}
                  <a
                    href={l.short_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-mono break-all"
                  >
                    {l.short_url}
                  </a>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    → {l.target_url}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {new Date(l.created_at).toLocaleString("ru-RU")}
                    {" · "}
                    {l.click_count}
                    {l.max_clicks != null ? `/${l.max_clicks}` : ""} переходов
                    {l.expires_at && (
                      <>
                        {" · истекает "}
                        {new Date(l.expires_at).toLocaleString("ru-RU")}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copy(l.id, l.short_url)}
                    className="rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1 text-sm"
                  >
                    {copied === l.id ? "Скопировано!" : "Копировать"}
                  </button>
                  <button
                    onClick={() => setDeletingId(l.id)}
                    className="rounded bg-rose-600/90 hover:bg-rose-500 text-white px-3 py-1 text-sm"
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={deletingId !== null}
        title="Удалить ссылку"
        message="Эта ссылка перестанет работать. Действие нельзя отменить."
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={performDelete}
        onClose={() => setDeletingId(null)}
      />
    </div>
  );
}
