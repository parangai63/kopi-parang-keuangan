// Ekspor laporan ke Excel (.xlsx) dan PDF dengan kop Kopi Parang, periode, dan tanggal cetak
// (spesifikasi: Kebutuhan non-fungsional → Ekspor). Pola sama dengan Parang-ops.
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportColumn {
  header: string;
  key: string;
  /** rata kanan untuk kolom angka di PDF */
  numeric?: boolean;
}

export interface ExportSpec {
  filename: string;
  title: string;
  period: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
}

const stamp = () => new Date().toISOString().slice(0, 10);
const printed = () =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date());

export function exportToExcel(spec: ExportSpec) {
  const aoa: unknown[][] = [
    ["KOPI PARANG"],
    [spec.title],
    [spec.period],
    [`Dicetak ${printed()}`],
    [],
    spec.columns.map((c) => c.header),
    ...spec.rows.map((r) => spec.columns.map((c) => r[c.key] ?? "")),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = spec.columns.map((c) => ({
    wch: Math.min(Math.max(c.header.length, ...spec.rows.map((r) => String(r[c.key] ?? "").length)) + 2, 48),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, spec.title.slice(0, 31));
  XLSX.writeFile(wb, `${spec.filename}-${stamp()}.xlsx`);
}

export function exportToPdf(spec: ExportSpec) {
  const doc = new jsPDF({ orientation: spec.columns.length > 6 ? "landscape" : "portrait" });
  doc.setFontSize(13);
  doc.text("KOPI PARANG", 14, 14);
  doc.setFontSize(11);
  doc.text(spec.title, 14, 20);
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text(`${spec.period} · dalam Rupiah · dicetak ${printed()}`, 14, 25);
  autoTable(doc, {
    startY: 30,
    head: [spec.columns.map((c) => c.header)],
    body: spec.rows.map((r) => spec.columns.map((c) => String(r[c.key] ?? ""))),
    styles: { fontSize: 7.5, cellPadding: 1.6 },
    headStyles: { fillColor: [21, 28, 39] },
    columnStyles: Object.fromEntries(spec.columns.map((c, i) => [i, c.numeric ? { halign: "right" } : {}])),
    margin: { left: 10, right: 10 },
  });
  doc.save(`${spec.filename}-${stamp()}.pdf`);
}
