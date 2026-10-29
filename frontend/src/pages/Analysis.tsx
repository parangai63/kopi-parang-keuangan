import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { masterApi, reportApi } from "../api";
import { BLN3, BULAN, periodLabel } from "../utils/format";
import { ErrorBox, Field, Loading, PageHeader, Panel } from "../components/ui";
import ExportMenu from "../components/ExportMenu";
import { ReportTable, toExport } from "../components/reports/ReportTable";
import { useApi } from "../utils/useApi";
import { useToast } from "../context/ToastContext";
import { Built, monthCols, Statement } from "../components/reports/Statement";
import { EVENT_COLUMNS, eventRows, salesRecapRows, taxRows } from "../components/reports/buildRows";

type Tab = "omzet" | "pajak" | "event";
const TABS: [Tab, string][] = [["omzet", "Rekap Omzet"], ["pajak", "Pajak (PBJT)"], ["event", "Analisis Event"]];

// Loader stabil (di luar komponen) supaya useApi tidak memuat ulang terus.
const LOADERS: Record<Exclude<Tab, "event">, [string, () => Promise<Built>]> = {
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
};

/** Sheet ANALISIS EVENT + keterangan manual per event (tabel event_notes). */
function EventAnalysis() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => reportApi.events(), []);
  const [pick, setPick] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} />;
  if (!data.events.length) return <p className="note">Belum ada jurnal bertag event.</p>;
  const rows = eventRows(data.events);
  const period = `Tahun ${data.year}, seluruh jurnal bertag event`;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (pick === "") return;
    setBusy(true);
    try {
      await masterApi.saveEventNote(pick, note);
      toast("Keterangan event tersimpan.");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menyimpan.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <div>
        <div className="rep-bar">
          <div className="rep-head">KOPI PARANG · {period} · dalam Rupiah</div>
          <ExportMenu build={() => ({ filename: "analisis-event", title: "Analisis Event", period, ...toExport(EVENT_COLUMNS, rows, "Event") })} />
        </div>
        <ReportTable columns={EVENT_COLUMNS} rows={rows} firstHeader="Event" />
        <p className="note" style={{ marginTop: 10 }}>
          Pendapatan = jurnal bertag event dengan akun kredit kelompok Pendapatan; biaya = jurnal bertag event dengan akun debet kelompok Beban.
          Biaya tanpa tag tidak ikut terhitung. Biaya per Rp1 di atas 1 berarti event merugi. Saran dari Excel: buat anggaran per event sebelum
          jalan (target tiket/sponsor ≥ biaya), dan evaluasi dampak event ke omzet cafe di hari-hari setelahnya.
        </p>
      </div>
      <Panel title="Keterangan event" hint="Catatan evaluasi, misalnya penyebab rugi atau pelajaran untuk event berikutnya. Riwayat tersimpan.">
        <form className="toolbar" style={{ marginBottom: 0 }} onSubmit={save}>
          <Field label="Event">
            <select
              value={pick}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : "";
                setPick(id);
                setNote(data.events.find((x) => x.id === id)?.note ?? "");
              }}
            >
              <option value="">— pilih event —</option>
              {data.events.filter((x) => x.id).map((x) => <option key={x.id!} value={x.id!}>{x.name}</option>)}
            </select>
          </Field>
          <Field label="Keterangan" className="q"><input value={note} disabled={pick === ""} onChange={(e) => setNote(e.target.value)} /></Field>
          <button className="btn" type="submit" disabled={busy || pick === ""}>Simpan</button>
        </form>
      </Panel>
    </div>
  );
}

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
      {tab === "event" ? <EventAnalysis /> : <Statement key={tab} title={LOADERS[tab][0]} load={LOADERS[tab][1]} />}
    </>
  );
}
