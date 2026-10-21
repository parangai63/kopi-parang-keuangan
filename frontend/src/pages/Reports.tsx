import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { reportApi } from "../api";
import { useApi } from "../utils/useApi";
import { BLN3, lastDay, periodLabel, tgl } from "../utils/format";
import { ErrorBox, Loading, PageHeader } from "../components/ui";
import ExportMenu from "../components/ExportMenu";
import { ReportRow, ReportTable, toExport } from "../components/reports/ReportTable";
import { balanceSheetRows, cashFlowRows, equityRows, profitLossRows, trialBalanceRows } from "../components/reports/buildRows";
import GeneralLedger from "../components/reports/GeneralLedger";

type Tab = "lr" | "nr" | "ak" | "pe" | "ns" | "bb";
const TABS: [Tab, string][] = [
  ["lr", "Laba Rugi"], ["nr", "Neraca"], ["ak", "Arus Kas"], ["pe", "Perubahan Ekuitas"], ["ns", "Neraca Saldo"], ["bb", "Buku Besar"],
];

const monthCols = (closed: number) => [...Array.from({ length: closed }, (_, i) => BLN3[i]), `s.d. ${BLN3[closed - 1]}`];

interface Built {
  year: number;
  closedMonth: number;
  columns: string[];
  rows: ReportRow[];
  firstHeader?: string;
  note?: string;
}

/** Satu tab laporan: muat data → bangun baris → tabel + tombol ekspor. */
function Statement({ title, load }: { title: string; load: () => Promise<Built> }) {
  const { data, loading, error, reload } = useApi(load, [load]);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} />;
  if (!data.closedMonth) return <p className="note">Belum ada bulan yang ditutup.</p>;
  const period = periodLabel(data.year, data.closedMonth);
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

// Loader stabil (di luar komponen) supaya useApi tidak memuat ulang terus.
const LOADERS: Record<Exclude<Tab, "bb">, [string, () => Promise<Built>]> = {
  lr: ["Laba Rugi", async () => {
    const r = await reportApi.profitLoss();
    return { year: r.year, closedMonth: r.closedMonth, columns: monthCols(r.closedMonth), rows: r.closedMonth ? profitLossRows(r) : [] };
  }],
  nr: ["Neraca", async () => {
    const r = await reportApi.balanceSheet();
    return {
      year: r.year, closedMonth: r.closedMonth, rows: balanceSheetRows(r),
      columns: [`1 Jan ${r.year}`, r.closedMonth ? tgl(lastDay(r.year, r.closedMonth)) : "–"],
    };
  }],
  ak: ["Arus Kas", async () => {
    const r = await reportApi.cashFlow();
    return {
      year: r.year, closedMonth: r.closedMonth, columns: monthCols(r.closedMonth), rows: r.closedMonth ? cashFlowRows(r) : [],
      note: "Disusun dari setiap transaksi yang melibatkan tepat satu akun kas, dikelompokkan menurut akun lawannya. Pindah dana antar-kas tidak dihitung.",
    };
  }],
  pe: ["Perubahan Ekuitas", async () => {
    const r = await reportApi.equity();
    return { year: r.year, closedMonth: r.closedMonth, columns: monthCols(r.closedMonth), rows: r.closedMonth ? equityRows(r) : [] };
  }],
  ns: ["Neraca Saldo", async () => {
    const r = await reportApi.trialBalance();
    return {
      year: r.year, closedMonth: r.closedMonth, firstHeader: "Akun", rows: trialBalanceRows(r.rows),
      columns: ["Saldo awal", "Mutasi debet", "Mutasi kredit", "Saldo debet", "Saldo kredit"],
    };
  }],
};

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("lr");
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Laporan keuangan" subtitle={user ? periodLabel(user.fiscalYear, user.closedMonth) : ""} />
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === "bb" ? <GeneralLedger /> : <Statement key={tab} title={LOADERS[tab][0]} load={LOADERS[tab][1]} />}
    </>
  );
}
