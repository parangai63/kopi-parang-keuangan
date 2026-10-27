import { useApi } from "../../utils/useApi";
import { BLN3, periodLabel } from "../../utils/format";
import { ErrorBox, Loading } from "../ui";
import ExportMenu from "../ExportMenu";
import { ReportRow, ReportTable, toExport } from "./ReportTable";

export const monthCols = (closed: number) => [...Array.from({ length: closed }, (_, i) => BLN3[i]), `s.d. ${BLN3[closed - 1]}`];

export interface Built {
  year: number;
  closedMonth: number;
  columns: string[];
  rows: ReportRow[];
  firstHeader?: string;
  note?: string;
  /** label periode bila berbeda dari "s.d. bulan tutup buku" (mis. rekap yang ikut bulan berjalan) */
  period?: string;
}

/** Satu tab laporan: muat data → bangun baris → tabel + tombol ekspor. */
export function Statement({ title, load }: { title: string; load: () => Promise<Built> }) {
  const { data, loading, error, reload } = useApi(load, [load]);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} />;
  if ((!data.closedMonth && !data.period) || !data.rows.length) return <p className="note">Belum ada bulan yang ditutup.</p>;
  const period = data.period ?? periodLabel(data.year, data.closedMonth);
  return (
    <>
      <div className="rep-bar">
        <div className="rep-head">KOPI PARANG · {period} · dalam Rupiah</div>
        <ExportMenu build={() => ({ filename: title.toLowerCase().replace(/\s+/g, "-"), title, period, ...toExport(data.columns, data.rows, data.firstHeader) })} />
      </div>
      <ReportTable columns={data.columns} rows={data.rows} firstHeader={data.firstHeader} />
      {data.note && <p className="note" style={{ marginTop: 10 }}>{data.note}</p>}
    </>
  );
}
