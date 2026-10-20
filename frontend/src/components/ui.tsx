// Komponen UI kecil yang dipakai di semua halaman.
import { ReactNode } from "react";
import { AlertTriangle, Loader2, Lock } from "lucide-react";
import type { DayStatus } from "../types";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-parang-text">{title}</h1>
        {subtitle && <p className="text-sm text-parang-subtle mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, hint, children, className = "" }: { title?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-xl border border-parang-divider p-4 md:p-5 ${className}`}>
      {title && <h2 className="text-base font-semibold text-parang-text">{title}</h2>}
      {hint && <p className="text-xs text-parang-subtle mt-1 mb-3">{hint}</p>}
      {!hint && title && <div className="mb-3" />}
      {children}
    </section>
  );
}

export function Loading({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-parang-subtle py-10 justify-center">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-accent-dangerBg text-accent-danger px-4 py-3 text-sm">
      <AlertTriangle className="w-4 h-4" /> <span className="flex-1">{message}</span>
      {onRetry && (
        <button className="underline font-medium" onClick={onRetry}>
          Coba lagi
        </button>
      )}
    </div>
  );
}

export function LockNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-accent-warningBg text-accent-warning px-3 py-2 text-sm mb-3">
      <Lock className="w-4 h-4 mt-0.5 shrink-0" /> <span>{children}</span>
    </div>
  );
}

export const statusTone = (s: DayStatus) =>
  s === "OK" ? "ok" : s === "Cek selisih tunai" ? "bad" : s ? "wait" : "none";

const PILL: Record<string, string> = {
  ok: "bg-accent-successBg text-accent-success",
  bad: "bg-accent-dangerBg text-accent-danger",
  wait: "bg-accent-warningBg text-accent-warning",
  none: "bg-gray-100 text-parang-subtle",
  info: "bg-info-container text-accent-primaryDeep",
};

export function Pill({ tone = "none", children }: { tone?: keyof typeof PILL | string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${PILL[tone] ?? PILL.none}`}>{children}</span>;
}

export function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" }) {
  return (
    <div className="bg-white rounded-xl border border-parang-divider p-4">
      <div className="text-xs text-parang-subtle">{label}</div>
      <div className={`text-lg md:text-xl font-bold tnum mt-1 ${tone === "neg" ? "text-accent-danger" : tone === "pos" ? "text-accent-success" : "text-parang-text"}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-parang-subtle mt-1">{sub}</div>}
    </div>
  );
}

export function CheckList({ checks }: { checks: { label: string; ok: boolean; diff?: number }[] }) {
  return (
    <ul className="space-y-2">
      {checks.map((c) => (
        <li key={c.label} className="flex items-center gap-2 text-sm">
          <span className={`w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold ${c.ok ? "bg-accent-successBg text-accent-success" : "bg-accent-dangerBg text-accent-danger"}`}>
            {c.ok ? "✓" : "!"}
          </span>
          {c.label}
          {!c.ok && c.diff !== undefined && <span className="text-accent-danger tnum">selisih {c.diff.toLocaleString("id-ID")}</span>}
        </li>
      ))}
    </ul>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-xs font-medium text-parang-neutral ${className}`}>
      <span className="block mb-1">{label}</span>
      {children}
    </label>
  );
}
