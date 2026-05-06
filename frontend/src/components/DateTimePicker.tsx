"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  value: Date | null;
  onChange: (d: Date | null) => void;
  minDate?: Date;
  placeholder?: string;
};

const MONTHS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];
const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function DateTimePicker({
  value,
  onChange,
  minDate,
  placeholder = "Выбрать дату и время",
}: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => value ?? new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setView(new Date(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // Mon=0
  const startDate = new Date(year, month, 1 - firstWeekday);

  const cells: { date: Date; current: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    cells.push({ date: d, current: d.getMonth() === month });
  }

  const today = new Date();
  const min = minDate ? startOfDay(minDate) : null;

  const selectDay = (d: Date) => {
    const base = value ? new Date(value) : new Date();
    base.setFullYear(d.getFullYear());
    base.setMonth(d.getMonth());
    base.setDate(d.getDate());
    if (!value) base.setHours(23, 59, 0, 0);
    onChange(base);
  };

  const setHour = (h: number) => {
    const d = value ? new Date(value) : new Date();
    if (!value) d.setMinutes(0, 0, 0);
    d.setHours(clamp(h, 0, 23));
    onChange(d);
  };
  const setMinute = (m: number) => {
    const d = value ? new Date(value) : new Date();
    d.setMinutes(clamp(m, 0, 59), 0, 0);
    onChange(d);
  };

  const formattedValue = value
    ? value.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const hours = value?.getHours() ?? 23;
  const minutes = value?.getMinutes() ?? 59;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left rounded bg-slate-900 border border-slate-700 px-3 py-2 outline-none focus:border-indigo-500 hover:border-slate-600 transition-colors flex items-center justify-between"
      >
        <span>
          {value ? (
            formattedValue
          ) : (
            <span className="text-slate-500">{placeholder}</span>
          )}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="text-slate-500"
        >
          <rect
            x="3"
            y="5"
            width="18"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M3 9h18M8 3v4M16 3v4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-[320px] rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-3 animate-popIn">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setView(new Date(year, month - 1, 1))}
              className="rounded px-2 py-1 hover:bg-slate-800 text-slate-300 text-lg leading-none"
              aria-label="Предыдущий месяц"
            >
              ‹
            </button>
            <div className="text-sm font-medium text-slate-100">
              {MONTHS_RU[month]} {year}
            </div>
            <button
              type="button"
              onClick={() => setView(new Date(year, month + 1, 1))}
              className="rounded px-2 py-1 hover:bg-slate-800 text-slate-300 text-lg leading-none"
              aria-label="Следующий месяц"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-1">
            {WEEKDAYS_RU.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              const isToday = sameDay(c.date, today);
              const isSelected = value ? sameDay(c.date, value) : false;
              const disabled = min ? c.date < min : false;
              const cls = [
                "h-8 rounded text-sm transition-colors",
                !c.current && !isSelected
                  ? "text-slate-600"
                  : "text-slate-200",
                isSelected
                  ? "bg-indigo-600 text-white font-semibold"
                  : isToday
                    ? "ring-1 ring-indigo-500/50 hover:bg-slate-800"
                    : "hover:bg-slate-800",
                disabled ? "opacity-30 cursor-not-allowed hover:bg-transparent" : "",
              ].join(" ");
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && selectDay(c.date)}
                  className={cls}
                >
                  {c.date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-slate-800 pt-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Время:</span>
              <input
                type="number"
                min={0}
                max={23}
                value={hours.toString().padStart(2, "0")}
                onChange={(e) =>
                  setHour(parseInt(e.target.value || "0", 10) || 0)
                }
                className="w-14 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-center"
              />
              <span className="text-slate-500">:</span>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes.toString().padStart(2, "0")}
                onChange={(e) =>
                  setMinute(parseInt(e.target.value || "0", 10) || 0)
                }
                className="w-14 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-center"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
              >
                Очистить
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-1 text-sm font-medium"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
