"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Link as LinkRow } from "@/lib/api";
import { authStore } from "@/lib/auth";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Toggle } from "@/components/Toggle";
import { DateTimePicker } from "@/components/DateTimePicker";

export default function DashboardPage() {
  const router = useRouter();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [target, setTarget] = useState("");
  const [slugEnabled, setSlugEnabled] = useState(false);
  const [slug, setSlug] = useState("");
  const [expiresEnabled, setExpiresEnabled] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
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
    if (!authStore.token()) {
      router.replace("/login");
      return;
    }
    refresh();
  }, [refresh, router]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (slugEnabled && slug.trim() && !/^[a-zA-Z0-9_-]{3,64}$/.test(slug.trim())) {
      setError("Свой slug: 3-64 символа, латиница/цифры/_/-");
      return;
    }
    if (expiresEnabled && !expiresAt) {
      setError("Выберите дату и время истечения");
      return;
    }

    setCreating(true);
    try {
      const expiresIso =
        expiresEnabled && expiresAt ? expiresAt.toISOString() : undefined;
      const slugVal = slugEnabled && slug.trim() ? slug.trim() : undefined;
      await api.createLink(target.trim(), slugVal, expiresIso);
      setTarget("");
      setSlug("");
      setSlugEnabled(false);
      setExpiresAt(null);
      setExpiresEnabled(false);
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

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold mb-4">Создать короткую ссылку</h1>
        <form
          onSubmit={create}
          className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4"
        >
          <input
            className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:border-indigo-500"
            placeholder="https://example.com/очень/длинный/адрес"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
            type="url"
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
                className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:border-indigo-500 animate-popIn"
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
                if (!v) setExpiresAt(null);
              }}
              label="Срок действия"
              description="Ссылка перестанет работать после указанной даты"
            />
            {expiresEnabled && (
              <div className="animate-popIn">
                <DateTimePicker
                  value={expiresAt}
                  onChange={setExpiresAt}
                  minDate={new Date()}
                />
              </div>
            )}
          </div>

          {error && <p className="text-rose-400 text-sm">{error}</p>}

          <button
            disabled={creating}
            className="rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 font-medium"
          >
            {creating ? "Создание..." : "Сократить"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Ваши ссылки</h2>
        {links.length === 0 ? (
          <p className="text-slate-400 text-sm">Ссылок пока нет.</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-900/40">
            {links.map((l) => (
              <li
                key={l.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={l.short_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:underline font-mono break-all"
                  >
                    {l.short_url}
                  </a>
                  <div className="text-xs text-slate-400 truncate">
                    → {l.target_url}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {new Date(l.created_at).toLocaleString("ru-RU")}
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
                    className="rounded bg-slate-800 hover:bg-slate-700 px-3 py-1 text-sm"
                  >
                    {copied === l.id ? "Скопировано!" : "Копировать"}
                  </button>
                  <button
                    onClick={() => setDeletingId(l.id)}
                    className="rounded bg-rose-700/70 hover:bg-rose-600 px-3 py-1 text-sm"
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
