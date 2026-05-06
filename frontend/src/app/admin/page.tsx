"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  type AdminUser,
  type Link as LinkRow,
} from "@/lib/api";
import { authStore } from "@/lib/auth";

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [allLinks, setAllLinks] = useState<LinkRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const deleteUser = async (id: number, username: string) => {
    if (
      !confirm(`Удалить пользователя «${username}» со всеми его ссылками?`)
    )
      return;
    try {
      await api.adminDeleteUser(id);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось удалить пользователя",
      );
    }
  };

  const deleteLink = async (id: number) => {
    if (!confirm("Удалить эту ссылку?")) return;
    try {
      await api.deleteLink(id);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось удалить ссылку",
      );
    }
  };

  if (loading) {
    return <p className="text-slate-400">Загрузка...</p>;
  }

  return (
    <div className="space-y-10">
      {error && <p className="text-rose-400 text-sm">{error}</p>}

      <section>
        <h1 className="text-2xl font-semibold mb-4">Пользователи</h1>
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Логин</th>
                <th className="px-4 py-2">Роль</th>
                <th className="px-4 py-2">Ссылок</th>
                <th className="px-4 py-2">Создан</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 font-mono">{u.id}</td>
                  <td className="px-4 py-2">{u.username}</td>
                  <td className="px-4 py-2">
                    {u.is_admin ? (
                      <span className="rounded bg-indigo-700/40 text-indigo-300 px-2 py-0.5 text-xs">
                        админ
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">пользователь</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{u.links_count}</td>
                  <td className="px-4 py-2 text-slate-400">
                    {new Date(u.created_at).toLocaleString("ru-RU")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {!u.is_admin && (
                      <button
                        onClick={() => deleteUser(u.id, u.username)}
                        className="rounded bg-rose-700/70 hover:bg-rose-600 px-3 py-1 text-xs"
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
          <p className="text-slate-400 text-sm">Ссылок нет.</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-900/40">
            {allLinks.map((l) => (
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
                    от @{l.username} ·{" "}
                    {new Date(l.created_at).toLocaleString("ru-RU")}
                    {l.expires_at && (
                      <>
                        {" · истекает "}
                        {new Date(l.expires_at).toLocaleString("ru-RU")}
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteLink(l.id)}
                  className="rounded bg-rose-700/70 hover:bg-rose-600 px-3 py-1 text-sm"
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
