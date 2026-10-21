import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import type { ExportSpec } from "../utils/exportTable";

// xlsx & jspdf besar (~700 kB) — dimuat hanya saat tombol ekspor dipakai,
// supaya layar kasir di HP tetap ringan.
const loadExporters = () => import("../utils/exportTable");

/** Tombol Ekspor (Excel/PDF) — wajib ada di setiap tabel laporan. */
export default function ExportMenu({ build, disabled }: { build: () => ExportSpec | Promise<ExportSpec>; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = async (format: "xlsx" | "pdf") => {
    setOpen(false);
    setBusy(true);
    try {
      const [spec, m] = await Promise.all([build(), loadExporters()]);
      (format === "xlsx" ? m.exportToExcel : m.exportToPdf)(spec);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Ekspor gagal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export" ref={ref}>
      <button type="button" className="btn ghost" disabled={disabled || busy} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />} Ekspor
      </button>
      {open && (
        <div className="export-menu">
          <button type="button" onClick={() => pick("xlsx")}>
            <FileSpreadsheet /> Excel (.xlsx)
          </button>
          <button type="button" onClick={() => pick("pdf")}>
            <FileText /> PDF
          </button>
        </div>
      )}
    </div>
  );
}
