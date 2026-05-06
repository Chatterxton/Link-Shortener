"use client";
import { Modal } from "./Modal";

type Props = {
  open: boolean;
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title = "Подтверждение",
  message,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  variant = "primary",
  onConfirm,
  onClose,
}: Props) {
  const confirmCls =
    variant === "danger"
      ? "bg-rose-600 hover:bg-rose-500"
      : "bg-indigo-600 hover:bg-indigo-500";

  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-50">
          {title}
        </h3>
        <div className="text-slate-600 dark:text-slate-300 text-sm mb-6">
          {message}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`rounded ${confirmCls} text-white px-4 py-2 text-sm font-medium`}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
