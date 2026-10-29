import { reportApi } from "../api";
import { useApi } from "../utils/useApi";
import { acct, BULAN, jt, num, pct, periodLabel, rp, tgl } from "../utils/format";
import { CheckList, ErrorBox, Kpi, Loading, PageHeader, Panel } from "../components/ui";
import MonthlyChart from "../components/MonthlyChart";
import type { PageId } from "../types/navigation";

/** Ringkasan keuangan — susunan sama dengan vDash() di rancangan original. */
export default function DashboardPage({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { data: d, loading, error, reload } = useApi(() => reportApi.dashboard(), []);
  if (loading) return <><PageHeader title="Ringkasan keuangan" /><Loading /></>;
  if (error || !d) return <><PageHeader title="Ringkasan keuangan" /><ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} /></>;

  const T = d.total;
  const B = d.closedMonth;
  const nm = T.netRevenue ? T.netProfit / T.netRevenue : null;
  const gm = T.netRevenue ? T.grossProfit / T.netRevenue : null;
  const L = d.limits;
  const share = (x: number, base: number) => (base ? x / base : null);
  const over = (r: number | null, limit: number) => r != null && r > limit;
  const payroll = T.opex["Beban Gaji"] ?? 0;
  const foodCost = share(T.cogs, T.netRevenue);
  const primeCost = share(T.cogs + payroll, T.netRevenue);
  const cash = d.cash.onHand + d.cash.bank + d.cash.petty;

  return (
    <>
      <PageHeader title="Ringkasan keuangan" subtitle={periodLabel(d.year, B)} />
      {!B ? (
        <Panel><p className="note">Belum ada bulan yang ditutup.</p></Panel>
      ) : (
        <div className="grid">
          <div className="kpis">
            <Kpi label="Pendapatan bersih" value={rp(T.netRevenue)} sub={`rata-rata ${jt(T.netRevenue / B)} / bulan`} />
            <Kpi label="Laba kotor" value={rp(T.grossProfit)} sub={`margin ${pct(gm)}`} />
            <Kpi label="Laba bersih" value={rp(T.netProfit)} sub={`margin ${pct(nm)} · target ≥ ${pct(d.limits.netMargin, 0)}`} tone={T.netProfit < 0 ? "neg" : "pos"} />
            <Kpi label="Omzet bersih / hari" value={rp(d.netRevenuePerOpenDay)} sub="rata-rata hari buka" />
            <Kpi label="Rata-rata / transaksi" value={rp(d.avgTicket)} sub="avg ticket" />
            <Kpi label="Total kas" value={rp(cash)} sub={`tunai ${jt(d.cash.onHand)} · bank ${jt(d.cash.bank)}`} tone={d.cash.bank < 0 ? "neg" : undefined} />
            <Kpi label="Food cost" value={pct(foodCost)} sub={`HPP, batas ${pct(L.foodCost, 0)}`} tone={over(foodCost, L.foodCost) ? "neg" : "pos"} />
            <Kpi label="Prime cost" value={pct(primeCost)} sub={`HPP + gaji, batas ${pct(L.primeCost, 0)}`} tone={over(primeCost, L.primeCost) ? "neg" : "pos"} />
          </div>

          <div className="two">
            <Panel title="Kinerja bulanan" hint="Pendapatan bersih dan laba bersih per bulan yang sudah ditutup." className="chart">
              <MonthlyChart data={d.monthly} />
            </Panel>
            <div className="grid">
              <Panel title="Struktur biaya" hint={`Persen dari pendapatan bersih s.d. ${BULAN[B - 1]}. Garis tipis = batas di Pengaturan.`}>
                <div className="costs">
                  {d.costStructure.map((c) => {
                    const p = T.netRevenue ? c.amount / T.netRevenue : 0;
                    const over = c.limit != null && p > c.limit;
                    return (
                      <div key={c.label} className="cost-row">
                        <span>{c.label}</span>
                        <div className="bar" title={rp(c.amount)}>
                          <span className={over ? "over" : ""} style={{ width: `${Math.min(100, Math.max(0, (p * 100) / 0.6))}%` }} />
                          {c.limit != null && <em style={{ left: `${(c.limit * 100) / 0.6}%` }} title={`batas ${pct(c.limit, 0)}`} />}
                        </div>
                        <span className={`p ${over ? "neg" : ""}`}>{pct(p)}</span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
              <Panel title="Cek kesehatan data" hint="Tanda merah harus nol sebelum laporan dibagikan; tanda kuning perlu ditindaklanjuti.">
                <CheckList checks={d.checks} />
                {d.running && (
                  <p className="note" style={{ marginTop: 14 }}>
                    {BULAN[d.running.month - 1]} berjalan: {d.running.openDays} hari buka,{" "}
                    <button className={`linkbtn ${d.running.notOkDays ? "neg" : ""}`} style={{ fontSize: "inherit", fontWeight: 700 }} onClick={() => onNavigate("omzet")}>
                      {d.running.notOkDays} hari perlu dicek
                    </button>{" "}
                    sebelum tutup buku.
                  </p>
                )}
              </Panel>
            </div>
          </div>

          <Panel title="Rincian per bulan" hint={`Food cost dan payroll terhadap pendapatan bersih; merah = melewati batas di Pengaturan (${pct(L.foodCost, 0)} / ${pct(L.payroll, 0)}).`}>
            <div className="tw">
              <table className="t">
                <thead>
                  <tr>
                    <th>Bulan</th><th className="r">Pendapatan bersih</th><th className="r">Laba kotor</th><th className="r">Laba bersih</th>
                    <th className="r">Food cost</th><th className="r">Payroll</th><th className="r">Kas akhir</th>
                  </tr>
                </thead>
                <tbody>
                  {d.monthly.map((m) => {
                    const fc = share(m.cogs, m.netRevenue);
                    const pr = share(m.payroll, m.netRevenue);
                    return (
                      <tr key={m.month}>
                        <td>{BULAN[m.month - 1]}</td>
                        <td className="r">{num(m.netRevenue)}</td>
                        <td className="r">{num(m.grossProfit)}</td>
                        <td className={`r ${m.netProfit < 0 ? "neg" : "pos"}`}>{acct(m.netProfit)}</td>
                        <td className={`r ${over(fc, L.foodCost) ? "neg" : ""}`}>{pct(fc)}</td>
                        <td className={`r ${over(pr, L.payroll) ? "neg" : ""}`}>{pct(pr)}</td>
                        <td className={`r ${m.cashClosing < 0 ? "neg" : ""}`}>{acct(m.cashClosing)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Hasil per event" hint="Dari jurnal yang diberi tag event. Biaya tanpa tag tidak ikut terhitung.">
            <div className="tw">
              <table className="t">
                <thead>
                  <tr><th>Event</th><th>Mulai</th><th className="r">Pendapatan</th><th className="r">Biaya</th><th className="r">Laba (rugi)</th></tr>
                </thead>
                <tbody>
                  {d.events.map((e) => (
                    <tr key={e.name}>
                      <td>{e.name.replace(/^Event /, "")}</td>
                      <td className="acc">{tgl(e.firstDate)}</td>
                      <td className="r">{num(e.revenue)}</td>
                      <td className="r">{num(e.cost)}</td>
                      <td className={`r ${e.profit < 0 ? "neg" : "pos"}`}>{acct(e.profit)}</td>
                    </tr>
                  ))}
                  {!d.events.length && <tr><td colSpan={5} className="empty-row">Belum ada jurnal bertag event.</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
