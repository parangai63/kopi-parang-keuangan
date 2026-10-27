import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { reportApi } from "../api";
import { BLN3, BULAN, periodLabel } from "../utils/format";
import { PageHeader } from "../components/ui";
import { Built, monthCols, Statement } from "../components/reports/Statement";
import { EVENT_COLUMNS, eventRows, salesRecapRows, taxRows } from "../components/reports/buildRows";

type Tab = "omzet" | "pajak" | "event";
const TABS: [Tab, string][] = [["omzet", "Rekap Omzet"], ["pajak", "Pajak (PBJT)"], ["event", "Analisis Event"]];

// Loader stabil (di luar komponen) supaya useApi tidak memuat ulang terus.
const LOADERS: Record<Tab, [string, () => Promise<Built>]> = {
  omzet: ["Rekap Omzet", async () => {
    const r = await reportApi.salesRecap();
    const last = r.months[r.months.length - 1]?.month ?? 0;
    const running = last > r.closedMonth;
    return {
      year: r.year, closedMonth: r.closedMonth, rows: r.months.length ? salesRecapRows(r) : [],
      columns: [...r.months.map((m) => (m.month > r.closedMonth ? `${BLN3[m.month - 1]}*` : BLN3[m.month - 1])), "Total"],
      period: last ? `Periode 1 Januari – ${BULAN[last - 1]} ${r.year}` : "",
      note: running
        ? `* ${BULAN[last - 1]} masih berjalan (belum tutup buku). Data operasional dari Omzet Harian, termasuk bulan berjalan.`
        : "Data operasional dari Omzet Harian.",
    };
  }],
  pajak: ["Pajak PBJT", async () => {
    const r = await reportApi.tax();
    const months = r.months.filter((m) => m.month <= r.closedMonth);
    return {
      year: r.year, closedMonth: r.closedMonth, columns: monthCols(r.closedMonth), rows: months.length ? taxRows(months) : [],
      note:
        "PBJT terutang dihitung dari omzet asli dengan tarif & asumsi di Pengaturan, belum termasuk sanksi administratif. " +
        "Omzet dilaporkan dan PBJT dibayar diisi di Tutup Buku. Bila \"Akui estimasi PBJT kurang bayar\" aktif, kurang bayar otomatis " +
        "dijurnal: Pajak Restoran (D) / Utang Pajak Daerah (K). PPh atas usaha belum dicatat.",
    };
  }],
  event: ["Analisis Event", async () => {
    const r = await reportApi.events();
    return {
      year: r.year, closedMonth: r.closedMonth, columns: EVENT_COLUMNS, firstHeader: "Event",
      rows: r.events.length ? eventRows(r.events) : [],
      period: `Tahun ${r.year}, seluruh jurnal bertag event`,
      note:
        "Pendapatan = jurnal bertag event dengan akun kredit kelompok Pendapatan; biaya = jurnal bertag event dengan akun debet " +
        "kelompok Beban. Biaya tanpa tag tidak ikut terhitung. Biaya per Rp1 di atas 1 berarti event merugi.",
    };
  }],
};

/** Analisis pendukung: rekap omzet & KPI penjualan, rekonsiliasi PBJT, laba rugi per event. */
export default function AnalysisPage() {
  const [tab, setTab] = useState<Tab>("omzet");
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Analisis" subtitle={user ? periodLabel(user.fiscalYear, user.closedMonth) : ""} />
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <Statement key={tab} title={LOADERS[tab][0]} load={LOADERS[tab][1]} />
    </>
  );
}
