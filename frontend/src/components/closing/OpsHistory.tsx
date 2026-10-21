import { acct, BLN3, num, pct } from "../../utils/format";
import { Panel, Pill } from "../ui";
import type { OpsCheckMonth } from "../../types";

const dash = <span className="note">–</span>;

/** Riwayat cek dengan Parang-ops per bulan (spesifikasi Logika 12). Tidak memblokir tutup buku. */
export default function OpsHistory({ rows, closedMonth, tolerances }: { rows: OpsCheckMonth[]; closedMonth: number; tolerances?: { purchase: number; sales: number } }) {
  const v = (x: number | null) => (x == null ? dash : num(x));
  const d = (x: number | null, flag: boolean) => (x == null ? dash : <span className={flag ? "neg" : ""}>{acct(x)}{flag && " !"}</span>);
  return (
    <Panel
      title="Riwayat cek dengan Parang-ops"
      hint={`Angka Parang-ops diinput manual saat tutup buku. Bulan sebelum go-live kosong. Tanda ! = melewati toleransi${tolerances ? ` (pembelian ${pct(tolerances.purchase, 0)}, omzet ${pct(tolerances.sales, 0)})` : ""}.`}
    >
      <div className="tw">
        <table className="t rep">
          <thead>
            <tr>
              <th>Bulan</th><th className="r">Nilai stok (Ops)</th><th className="r">Pembelian (Ops)</th><th className="r">Pembelian (Keuangan)</th>
              <th className="r">Selisih</th><th className="r">Penjualan (Ops)</th><th className="r">Omzet tercatat</th><th className="r">Selisih</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.month}>
                <td>{BLN3[o.month - 1]} {o.month > closedMonth && <Pill tone="wait">berjalan</Pill>}</td>
                <td className="r">{v(o.stockValue)}</td><td className="r">{v(o.purchasesTotal)}</td><td className="r">{num(o.financePurchases)}</td>
                <td className="r">{d(o.purchaseDiff, o.purchaseFlag)}</td><td className="r">{v(o.salesTotal)}</td>
                <td className="r">{num(o.recordedRevenue)}</td><td className="r">{d(o.salesDiff, o.salesFlag)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
