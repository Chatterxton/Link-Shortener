"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { authStore } from "@/lib/auth";

type GateState = "checking" | "open" | "closed";

export default function RegisterPage() {
  const router = useRouter();
  const [gate, setGate] = useState<GateState>("checking");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .needsBootstrap()
      .then((r) => {
        if (!alive) return;
        if (r.needs_bootstrap) {
          setGate("open");
        } else {
          setGate("closed");
          router.replace("/login");
        }
      })
      .catch(() => alive && setGate("closed"));
    return () => {
      alive = false;
    };
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.register(username, password);
      authStore.setUser(res.user);
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось зарегистрироваться",
      );
    } finally {
      setLoading(false);
    }
  };

  if (gate === "checking") {
    return <p className="text-slate-500 dark:text-slate-400">Загрузка...</p>;
  }
  if (gate === "closed") {
    return (
      <p className="text-slate-500 dark:text-slate-400">
        Регистрация закрыта. Обратитесь к администратору для создания аккаунта.
      </p>
    );
  }

  const inputCls =
    "w-full rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none focus:border-indigo-500 transition-colors";

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Создать первого админа</h1>
      <p className="text-xs text-slate-500 mb-6">
        Это первоначальная настройка. После регистрации первого пользователя
        форма станет недоступна, и новых пользователей сможет создавать только
        администратор.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <input
          className={inputCls}
          placeholder="Логин (3-64 символа)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={64}
          autoComplete="username"
        />
        <input
          className={inputCls}
          type="password"
          placeholder="Пароль (минимум 6 символов)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
        {error && (
          <p className="text-rose-600 dark:text-rose-400 text-sm">{error}</p>
        )}
        <button
          disabled={loading}
          className="w-full rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 px-4 py-2 font-medium"
        >
          {loading ? "Создание..." : "Создать"}
        </button>
      </form>
    </div>
  );
}
