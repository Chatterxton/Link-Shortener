"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { authStore } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.register(username, password);
      authStore.set(res.token, res.user);
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось зарегистрироваться",
      );
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none focus:border-indigo-500 transition-colors";

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Создать аккаунт</h1>
      <p className="text-xs text-slate-500 mb-6">
        Первый зарегистрированный пользователь становится администратором.
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
        />
        <input
          className={inputCls}
          type="password"
          placeholder="Пароль (минимум 6 символов)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        {error && (
          <p className="text-rose-600 dark:text-rose-400 text-sm">{error}</p>
        )}
        <button
          disabled={loading}
          className="w-full rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 px-4 py-2 font-medium"
        >
          {loading ? "Создание..." : "Зарегистрироваться"}
        </button>
      </form>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">
        Уже есть аккаунт?{" "}
        <Link
          href="/login"
          className="text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Войти
        </Link>
      </p>
    </div>
  );
}
