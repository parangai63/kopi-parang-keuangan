import { acct, BLN3, num, pct } from "../../utils/format";
import { Panel, Pill } from "../ui";
import type { OpsCheckMonth } from "../../types";

const dash = <span className="text-parang-subtle">–</span>;

/** Riwayat cek dengan Parang-ops per bulan (spesifikasi Logika 12). Tidak memblokir tutup buku. */
export default function OpsHistory({ rows, closedMonth, tolerances }: { rows: OpsCheckMonth[]; closedMonth: number; tolerances?: { purchase: number; sales: number } }) {
  const v = (x: number | null) => (x == null ? dash : num(x));
  const d = (x: number | null, flag: boolean) => (x == null ? dash : <span className={flag ? "text-accent-danger font-semibold" : ""}>{acct(x)}{flag && " !"}</span>);
  return (
    <Panel
      title="Riwayat cek dengan Parang-ops"
      hint={`Angka Parang-ops diinput manual saat tutup buku. Bulan sebelum go-live kosong. Tanda ! = melewati toleransi${tolerances ? ` (pembelian ${pct(tolerances.purchase, 0)}, omzet ${pct(tolerances.sales, 0)})` : ""}.`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm tnum">
          <thead className="text-xs text-parang-subtle">
            <tr className="text-right">
              <th className="text-left py-2">Bulan</th><th className="px-2">Nilai stok (Ops)</th><th className="px-2">Pembelian (Ops)</th>
              <th className="px-2">Pembelian (Keuangan)</th><th className="px-2">Selisih</th><th className="px-2">Penjualan (Ops)</th>
              <th className="px-2">Omzet tercatat</th><th className="px-2">Selisih</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.month} className="border-t border-parang-divider/60 text-right">
                <td className="text-left py-1.5 whitespace-nowrap">{BLN3[o.month - 1]} {o.month > closedMonth && <Pill tone="wait">berjalan</Pill>}</td>
                <td className="px-2">{v(o.stockValue)}</td><td className="px-2">{v(o.purchasesTotal)}</td><td className="px-2">{num(o.financePurchases)}</td>
                <td className="px-2">{d(o.purchaseDiff, o.purchaseFlag)}</td><td className="px-2">{v(o.salesTotal)}</td>
                <td className="px-2">{num(o.recordedRevenue)}</td><td className="px-2">{d(o.salesDiff, o.salesFlag)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
