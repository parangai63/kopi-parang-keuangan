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
    <div className="relative" ref={ref}>
      <button type="button" className="btn-ghost" disabled={disabled || busy} onClick={() => setOpen((v) => !v)}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Ekspor
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg border border-parang-outline/40 shadow-lg py-1 z-20">
          <button type="button" onClick={() => pick("xlsx")} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
            <FileSpreadsheet className="w-4 h-4" /> Excel (.xlsx)
          </button>
          <button type="button" onClick={() => pick("pdf")} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      )}
    </div>
  );
}
