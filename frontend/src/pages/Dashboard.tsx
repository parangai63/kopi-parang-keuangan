import { reportApi } from "../api";
import { useApi } from "../utils/useApi";
import { acct, BLN3, BULAN, jt, num, pct, periodLabel, rp, tgl } from "../utils/format";
import { CheckList, ErrorBox, Kpi, Loading, PageHeader, Panel } from "../components/ui";
import MonthlyChart from "../components/MonthlyChart";
import type { PageId } from "../types/navigation";

export default function DashboardPage({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { data: d, loading, error, reload } = useApi(() => reportApi.dashboard(), []);
  if (loading) return <Loading />;
  if (error || !d) return <ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} />;

  const T = d.total;
  const B = d.closedMonth;
  const nm = T.netRevenue ? T.netProfit / T.netRevenue : null;
  const gm = T.netRevenue ? T.grossProfit / T.netRevenue : null;

  return (
    <>
      <PageHeader title="Ringkasan keuangan" subtitle={periodLabel(d.year, B)} />
      {!B ? (
        <Panel>Belum ada bulan yang ditutup.</Panel>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi label="Pendapatan bersih" value={rp(T.netRevenue)} sub={`rata-rata ${jt(T.netRevenue / B)} / bulan`} />
            <Kpi label="Laba kotor" value={rp(T.grossProfit)} sub={`margin ${pct(gm)}`} />
            <Kpi label="Laba bersih" value={rp(T.netProfit)} sub={`margin ${pct(nm)} · target ≥ ${pct(d.limits.netMargin, 0)}`} tone={T.netProfit < 0 ? "neg" : "pos"} />
            <Kpi label="Omzet bersih / hari" value={rp(d.netRevenuePerOpenDay)} sub="rata-rata hari buka" />
            <Kpi label="Rata-rata / transaksi" value={rp(d.avgTicket)} sub="avg ticket" />
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            <Panel title="Kinerja bulanan" hint="Pendapatan bersih dan laba bersih per bulan yang sudah ditutup." className="lg:col-span-3">
              <MonthlyChart data={d.monthly} />
            </Panel>
            <div className="lg:col-span-2 space-y-4">
              <Panel title="Struktur biaya" hint={`Persen dari pendapatan bersih s.d. ${BULAN[B - 1]}. Garis tipis = batas di Pengaturan.`}>
                <div className="space-y-2.5">
                  {d.costStructure.map((c) => {
                    const p = T.netRevenue ? c.amount / T.netRevenue : 0;
                    const over = c.limit != null && p > c.limit;
                    return (
                      <div key={c.label} className="grid grid-cols-[110px_1fr_52px] items-center gap-2 text-xs" title={rp(c.amount)}>
                        <span className="text-parang-neutral">{c.label}</span>
                        <div className="relative h-2 rounded-full bg-gray-100">
                          <span className={`absolute inset-y-0 left-0 rounded-full ${over ? "bg-accent-danger" : "bg-accent-primary"}`} style={{ width: `${Math.min(100, Math.max(0, (p * 100) / 0.6))}%` }} />
                          {c.limit != null && <em className="absolute -top-1 -bottom-1 w-px bg-parang-text" style={{ left: `${(c.limit * 100) / 0.6}%` }} />}
                        </div>
                        <span className={`text-right tnum ${over ? "text-accent-danger font-semibold" : ""}`}>{pct(p)}</span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
              <Panel title="Cek kesehatan data" hint="Harus semua hijau sebelum laporan dibagikan.">
                <CheckList checks={d.checks} />
                {d.running && (
                  <p className="text-sm mt-4 text-parang-neutral">
                    {BULAN[d.running.month - 1]} berjalan: {d.running.openDays} hari buka,{" "}
                    <button className={`font-semibold underline ${d.running.notOkDays ? "text-accent-danger" : ""}`} onClick={() => onNavigate("omzet")}>
                      {d.running.notOkDays} hari perlu dicek
                    </button>{" "}
                    sebelum tutup buku.
                  </p>
                )}
              </Panel>
            </div>
          </div>

          <Panel title="Hasil per event" hint="Dari jurnal yang diberi tag event. Biaya tanpa tag tidak ikut terhitung.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-parang-subtle text-left">
                  <tr>
                    <th className="py-2 pr-3">Event</th><th className="pr-3">Mulai</th>
                    <th className="text-right pr-3">Pendapatan</th><th className="text-right pr-3">Biaya</th><th className="text-right">Laba (rugi)</th>
                  </tr>
                </thead>
                <tbody className="tnum">
                  {d.events.map((e) => (
                    <tr key={e.name} className="border-t border-parang-divider">
                      <td className="py-2 pr-3">{e.name.replace(/^Event /, "")}</td>
                      <td className="pr-3 whitespace-nowrap">{tgl(e.firstDate)}</td>
                      <td className="text-right pr-3">{num(e.revenue)}</td>
                      <td className="text-right pr-3">{num(e.cost)}</td>
                      <td className={`text-right ${e.profit < 0 ? "text-accent-danger" : "text-accent-success"}`}>{acct(e.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <p className="text-xs text-parang-subtle">Bulan ditutup: {d.monthly.map((m) => BLN3[m.month - 1]).join(", ")}.</p>
        </div>
      )}
    </>
  );
}
