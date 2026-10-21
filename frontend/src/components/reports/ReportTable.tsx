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

const fmt = (v: number | null | undefined, f: ReportRow["format"]) => (v == null ? "" : f === "pct" ? pct(v) : acct(v));

/** Tabel laporan dengan kelas .t.rep rancangan original: tr.h (judul kelompok), td.ind (menjorok),
 * tr.sum (subtotal), tr.grand (total), tr.ratio (rasio; td.over bila melewati batas). */
export function ReportTable({ columns, rows, firstHeader = "Keterangan" }: { columns: string[]; rows: ReportRow[]; firstHeader?: string }) {
  return (
    <div className="tw">
      <table className="t rep">
        <thead>
          <tr>
            <th>{firstHeader}</th>
            {columns.map((c) => <th key={c} className="r">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const style = r.style ?? "plain";
            return (
              <tr key={i} className={style === "plain" || style === "ind" ? "" : style}>
                <td className={style === "ind" || style === "ratio" ? "ind" : ""}>
                  {r.label}
                  {r.limit != null && <span className="note"> (batas {pct(r.limit, 0)})</span>}
                </td>
                {columns.map((_, j) => {
                  const v = r.values?.[j];
                  const over = r.limit != null && v != null && v > r.limit;
                  return (
                    <td key={j} className={`r ${over ? "over" : ""}`}>
                      {r.text ? r.text[j] : style === "h" ? "" : fmt(v, r.format)}
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
