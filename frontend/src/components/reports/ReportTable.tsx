import { acct, pct } from "../../utils/format";
import type { ExportColumn } from "../../utils/exportTable";

export type RowStyle = "h" | "ind" | "sum" | "grand" | "ratio" | "plain";

/** Satu baris laporan. Satu definisi dipakai untuk tampilan DAN ekspor Excel/PDF. */
export interface ReportRow {
  label: string;
  style?: RowStyle;
  /** satu nilai per kolom */
  values?: (number | null)[];
  format?: "acct" | "pct" | "text";
  /** batas rasio: nilai di atasnya diwarnai peringatan */
  limit?: number;
  text?: string[];
}

const ROW_CLS: Record<RowStyle, string> = {
  h: "font-semibold text-parang-text bg-parang-bg",
  ind: "",
  sum: "font-semibold border-t border-parang-outline",
  grand: "font-bold border-t-2 border-parang-text bg-info-container/40",
  ratio: "text-xs text-parang-subtle italic",
  plain: "",
};

const fmt = (v: number | null | undefined, f: ReportRow["format"]) => (v == null ? "" : f === "pct" ? pct(v) : acct(v));

export function ReportTable({ columns, rows, firstHeader = "Keterangan" }: { columns: string[]; rows: ReportRow[]; firstHeader?: string }) {
  return (
    <div className="bg-white rounded-xl border border-parang-divider overflow-x-auto">
      <table className="w-full text-sm tnum">
        <thead className="text-xs text-parang-subtle bg-parang-bg">
          <tr>
            <th className="text-left px-3 py-2 sticky left-0 bg-parang-bg min-w-[220px]">{firstHeader}</th>
            {columns.map((c) => <th key={c} className="text-right px-3 whitespace-nowrap">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const style = r.style ?? "plain";
            return (
              <tr key={i} className={`${ROW_CLS[style]} ${style !== "h" ? "border-t border-parang-divider/60" : ""}`}>
                <td className={`px-3 py-1.5 sticky left-0 bg-inherit ${style === "ind" || style === "ratio" ? "pl-7" : ""}`} style={{ backgroundColor: "inherit" }}>
                  {r.label}
                  {r.limit != null && <span className="text-parang-subtle not-italic"> (batas {pct(r.limit, 0)})</span>}
                </td>
                {columns.map((_, j) => {
                  const v = r.values?.[j];
                  const over = r.limit != null && v != null && v > r.limit;
                  return (
                    <td key={j} className={`px-3 py-1.5 text-right whitespace-nowrap ${over ? "text-accent-danger font-semibold not-italic" : ""}`}>
                      {r.text ? r.text[j] : fmt(v, r.format)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Ubah definisi baris laporan menjadi kolom & baris ekspor. */
export function toExport(columns: string[], rows: ReportRow[], firstHeader = "Keterangan") {
  const cols: ExportColumn[] = [{ header: firstHeader, key: "label" }, ...columns.map((c, i) => ({ header: c, key: `c${i}`, numeric: true }))];
  const data = rows.map((r) => {
    const o: Record<string, unknown> = { label: (r.style === "ind" || r.style === "ratio" ? "   " : "") + r.label };
    columns.forEach((_, i) => (o[`c${i}`] = r.text ? r.text[i] : fmt(r.values?.[i], r.format)));
    return o;
  });
  return { columns: cols, rows: data };
}
