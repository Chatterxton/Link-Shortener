"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type AdminUser, type Link as LinkRow } from "@/lib/api";
import { authStore } from "@/lib/auth";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CreateUserDialog } from "@/components/CreateUserDialog";

type ConfirmState =
  | { kind: "user"; id: number; name: string }
  | { kind: "link"; id: number; url: string }
  | null;

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [allLinks, setAllLinks] = useState<LinkRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [u, l] = await Promise.all([
        api.adminListUsers(),
        api.adminListAllLinks(),
      ]);
      setUsers(u);
      setAllLinks(l);
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
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const u = authStore.user();
    if (!u) {
      router.replace("/login");
      return;
    }
    if (!u.is_admin) {
      router.replace("/dashboard");
      return;
    }
    refresh();
  }, [refresh, router]);

  const performConfirm = async () => {
    if (!confirmState) return;
    try {
      if (confirmState.kind === "user") {
        await api.adminDeleteUser(confirmState.id);
      } else {
        await api.deleteLink(confirmState.id);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  if (loading) {
    return <p className="text-slate-500 dark:text-slate-400">Загрузка...</p>;
  }

  const cardCls =
    "rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40";

  return (
    <div className="space-y-10">
      {error && (
        <p className="text-rose-600 dark:text-rose-400 text-sm">{error}</p>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">Пользователи</h1>
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-1.5 font-medium"
          >
            Добавить
          </button>
        </div>
        <div className={`overflow-x-auto ${cardCls}`}>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Логин</th>
                <th className="px-4 py-2">Роль</th>
                <th className="px-4 py-2">Ссылок</th>
                <th className="px-4 py-2">Создан</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 font-mono">{u.id}</td>
                  <td className="px-4 py-2">{u.username}</td>
                  <td className="px-4 py-2">
                    {u.is_admin ? (
                      <span className="rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-700/40 dark:text-indigo-300 px-2 py-0.5 text-xs">
                        админ
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400 text-xs">
                        пользователь
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{u.links_count}</td>
                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                    {new Date(u.created_at).toLocaleString("ru-RU")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {!u.is_admin && (
                      <button
                        onClick={() =>
                          setConfirmState({
                            kind: "user",
                            id: u.id,
                            name: u.username,
                          })
                        }
                        className="rounded bg-rose-600/90 hover:bg-rose-500 text-white px-3 py-1 text-xs"
                      >
                        Удалить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Все ссылки</h2>
        {allLinks.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Ссылок нет.
          </p>
        ) : (
          <ul
            className={`divide-y divide-slate-200 dark:divide-slate-800 ${cardCls}`}
          >
            {allLinks.map((l) => (
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
                    от @{l.username} ·{" "}
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
                <button
                  onClick={() =>
                    setConfirmState({
                      kind: "link",
                      id: l.id,
                      url: l.short_url,
                    })
                  }
                  className="rounded bg-rose-600/90 hover:bg-rose-500 text-white px-3 py-1 text-sm"
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refresh}
      />

      <ConfirmDialog
        open={confirmState !== null}
        title={
          confirmState?.kind === "user"
            ? "Удалить пользователя"
            : "Удалить ссылку"
        }
        message={
          confirmState?.kind === "user" ? (
            <>
              Пользователь{" "}
              <span className="text-slate-900 dark:text-slate-100 font-medium">
                «{confirmState.name}»
              </span>{" "}
              и все его ссылки будут удалены без возможности восстановления.
            </>
          ) : confirmState?.kind === "link" ? (
            <>
              Ссылка{" "}
              <span className="font-mono text-slate-900 dark:text-slate-100">
                {confirmState.url}
              </span>{" "}
              перестанет работать. Действие нельзя отменить.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={performConfirm}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
}
