"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authStore } from "@/lib/auth";
import type { User } from "@/lib/api";

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

  const logout = () => {
    authStore.clear();
    router.push("/login");
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
      <div className="container mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-lg text-slate-50">
          Shortener
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="hover:text-white text-slate-300"
              >
                Dashboard
              </Link>
              {user.is_admin && (
                <Link
                  href="/admin"
                  className="hover:text-white text-slate-300"
                >
                  Admin
                </Link>
              )}
              <span className="text-slate-400">@{user.username}</span>
              <button
                onClick={logout}
                className="rounded bg-slate-800 px-3 py-1 hover:bg-slate-700"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hover:text-white text-slate-300"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded bg-indigo-600 px-3 py-1 hover:bg-indigo-500"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
