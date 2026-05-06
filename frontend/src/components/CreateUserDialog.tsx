"use client";
import { useState } from "react";
import { Modal } from "./Modal";
import { Toggle } from "./Toggle";
import { api } from "@/lib/api";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
};

export function CreateUserDialog({ open, onClose, onCreated }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setUsername("");
    setPassword("");
    setIsAdmin(false);
    setError(null);
    setSubmitting(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.adminCreateUser({
        username: username.trim(),
        password,
        is_admin: isAdmin,
      });
      await onCreated();
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать");
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none focus:border-indigo-500 transition-colors";

  return (
    <Modal open={open} onClose={close}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          Новый пользователь
        </h3>
        <input
          className={inputCls}
          placeholder="Логин (3-64 символа)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={64}
          autoComplete="off"
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
        <Toggle
          checked={isAdmin}
          onChange={setIsAdmin}
          label="Администратор"
          description="Может создавать пользователей и удалять любые ссылки"
        />
        {error && (
          <p className="text-rose-600 dark:text-rose-400 text-sm">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={close}
            className="rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 text-sm"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium"
          >
            {submitting ? "Создание..." : "Создать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
