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
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Create account</h1>
      <p className="text-xs text-slate-500 mb-6">
        The first registered user becomes the admin.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <input
          className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:border-indigo-500"
          placeholder="Username (3-64 chars)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={64}
        />
        <input
          className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:border-indigo-500"
          type="password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        {error && <p className="text-rose-400 text-sm">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 font-medium"
        >
          {loading ? "Creating..." : "Register"}
        </button>
      </form>
      <p className="text-sm text-slate-400 mt-4">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo-400 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
