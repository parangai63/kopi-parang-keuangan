// Komponen UI kecil yang dipakai di semua halaman. Kelas CSS mengikuti rancangan original
// (original/kopi-parang-keuangan-artifact.html) — lihat src/index.css.
import { ReactNode } from "react";
import { Loader2, Lock, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { BULAN } from "../utils/format";
import type { DayStatus, Role } from "../types";

export const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", ADMIN: "Admin keuangan", KASIR: "Kasir" };

/** Header halaman: judul (Literata) + sub, lalu chip tutup buku, pengguna yang masuk, dan tombol keluar. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <header className="top">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      <div className="top-right">
        {actions}
        {user && (
          <>
            <span className="chip">Tutup buku s.d. {user.closedMonth ? `${BULAN[user.closedMonth - 1]} ${user.fiscalYear}` : "–"}</span>
            <span className="seg-label">Masuk sebagai</span>
            <span className="who">
              {user.name} <small>· {ROLE_LABEL[user.role]}</small>
            </span>
            <button className="btn ghost sm" onClick={logout}>
              <LogOut /> Keluar
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export function Panel({ title, hint, children, className = "", id }: { title?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`panel ${className}`} id={id}>
      {title && <h2>{title}</h2>}
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  );
}

export function Loading({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="loading">
      <Loader2 /> {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="errbox">
      <span>{message}</span>
      {onRetry && (
        <button className="btn ghost sm" onClick={onRetry}>
          Coba lagi
        </button>
      )}
    </div>
  );
}

export function LockNote({ children }: { children: ReactNode }) {
  return (
    <div className="lock" style={{ marginBottom: 12 }}>
      <Lock /> <span>{children}</span>
    </div>
  );
}

/** Kelas status hari: ok (hijau), bad (merah), wait (kuning), "" (kosong). Sama dengan stClass di prototipe. */
export const statusTone = (s: DayStatus) => (s === "OK" ? "ok" : s === "Cek selisih tunai" ? "bad" : s ? "wait" : "");

/** Pill: ok | wait | bad | auto (nila) | adj (soga) | tag (abu). */
export function Pill({ tone = "tag", children }: { tone?: string; children: ReactNode }) {
  return <span className={`pill ${tone || "tag"}`}>{children}</span>;
}

export function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" }) {
  return (
    <div className="kpi">
      <span className="l">{label}</span>
      <span className={`v ${tone ?? ""}`}>{value}</span>
      {sub && <span className="s">{sub}</span>}
    </div>
  );
}

/** Cek kesehatan data: ✓ hijau, ! merah (salah hitung), ⚠ kuning (peringatan yang perlu ditindaklanjuti). */
export function CheckList({ checks }: { checks: { label: string; ok: boolean; diff?: number; level?: "warn"; note?: string }[] }) {
  return (
    <ul className="checks">
      {checks.map((c) => {
        const tone = c.ok ? "ok" : c.level === "warn" ? "warn" : "bad";
        return (
          <li key={c.label}>
            <span className={`dot ${tone}`}>{c.ok ? "✓" : c.level === "warn" ? "⚠" : "!"}</span>
            {c.label}
            {!c.ok && c.level === "warn" && c.note && <span className="warn-text"> {c.note}</span>}
            {!c.ok && c.level !== "warn" && c.diff !== undefined && <span className="neg"> selisih {c.diff.toLocaleString("id-ID")}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`fld ${className}`}>
      {label}
      {children}
    </label>
  );
}

/** Daftar baris "label — nilai" berlatar sunk (kelas .calc di rancangan original). */
export function CalcList({ rows }: { rows: { label: string; value: string; big?: boolean; cls?: string }[] }) {
  return (
    <div className="calc">
      {rows.map((r) => [
        <span key={`${r.label}-l`} className={r.big ? "big" : ""}>{r.label}</span>,
        <span key={`${r.label}-v`} className={`${r.big ? "big" : ""} ${r.cls ?? ""}`}>{r.value}</span>,
      ])}
    </div>
  );
}
