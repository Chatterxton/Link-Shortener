"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authStore } from "@/lib/auth";
import { api, type User } from "@/lib/api";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    setUser(authStore.user());
    const onChange = () => setUser(authStore.user());
    window.addEventListener("auth-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("auth-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore — clearing client state regardless
    }
    authStore.clear();
    router.push("/login");
  };

  return (
    <header className="border-b border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60 backdrop-blur transition-colors">
      <div className="container mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="font-semibold text-lg text-slate-900 dark:text-slate-50"
        >
          Сокращатель
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Мои ссылки
              </Link>
              {user.is_admin && (
                <Link
                  href="/admin"
                  className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  Админка
                </Link>
              )}
              <span className="text-slate-500 dark:text-slate-400">
                @{user.username}
              </span>
              <button
                onClick={logout}
                className="rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1"
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Вход
              </Link>
              <Link
                href="/register"
                className="rounded bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1"
              >
                Регистрация
              </Link>
            </>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
