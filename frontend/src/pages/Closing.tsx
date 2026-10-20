import { FormEvent, ReactNode, useEffect, useState } from "react";
import { closingApi } from "../api";
import { useApi } from "../utils/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { acct, BULAN, num, tgl } from "../utils/format";
import { CheckList, ErrorBox, Field, Loading, PageHeader, Panel, Pill, statusTone } from "../components/ui";
import MoneyInput from "../components/MoneyInput";
import OpsHistory from "../components/closing/OpsHistory";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="w-6 h-6 rounded-full bg-parang-text text-white text-xs font-bold grid place-items-center shrink-0">{n}</span>
      <div className="flex-1 pb-5 border-b border-parang-divider last:border-0">
        <h3 className="font-semibold text-sm mb-2">{title}</h3>
        {children}
      </div>
    </li>
  );
}

/** Wizard tutup buku bulanan (spesifikasi: Alur kerja, 6 langkah). */
export default function ClosingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isOwner = user?.role === "OWNER";
  const { data: p, loading, error, reload } = useApi(() => closingApi.preview(), []);
  const [ack, setAck] = useState({ days: false, recurring: false });
  const [tax, setTax] = useState<{ reportedRevenue: number | null; pbjtPaid: number | null }>({ reportedRevenue: null, pbjtPaid: null });
  const [ops, setOps] = useState<{ stockValue: number | null; purchasesTotal: number | null; salesTotal: number | null }>({ stockValue: null, purchasesTotal: null, salesTotal: null });
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!p) return;
    setTax({ reportedRevenue: p.taxFiling?.reportedRevenue ?? null, pbjtPaid: p.taxFiling?.pbjtPaid ?? null });
    setOps({ stockValue: p.opsFigures?.stockValue ?? null, purchasesTotal: p.opsFigures?.purchasesTotal ?? null, salesTotal: p.opsFigures?.salesTotal ?? null });
  }, [p]);

  if (loading) return <Loading />;
  if (error || !p) return <ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} />;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal.", "error");
    } finally {
      setBusy(false);
    }
  };

  const reopen = p.closedMonth > 0 && isOwner && (
    <Panel title={`Buka kembali ${BULAN[p.closedMonth - 1]}`} hint="Dipakai jika ada koreksi di bulan yang sudah ditutup. Tercatat di riwayat perubahan.">
      {confirmReopen ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Yakin membuka kembali {BULAN[p.closedMonth - 1]} {p.year}?</span>
          <button className="btn-danger" disabled={busy} onClick={() => run(closingApi.reopen, `${BULAN[p.closedMonth - 1]} dibuka kembali.`).then(() => setConfirmReopen(false))}>Ya, buka kembali</button>
          <button className="btn-ghost" onClick={() => setConfirmReopen(false)}>Batal</button>
        </div>
      ) : (
        <button className="btn-ghost" onClick={() => setConfirmReopen(true)}>Buka kembali {BULAN[p.closedMonth - 1]} {p.year}</button>
      )}
    </Panel>
  );

  if (!p.nextMonth) {
    return (
      <>
        <PageHeader title="Tutup buku" subtitle="Semua bulan di tahun buku ini sudah ditutup." />
        <div className="space-y-4">{reopen}<OpsHistory rows={p.history} closedMonth={p.closedMonth} /></div>
      </>
    );
  }

  const m = p.nextMonth;
  const nm = BULAN[m - 1];
  const days = p.notOkDays ?? [];
  const oc = p.opsCheck!;
  const opsSaved = p.opsFigures != null;
  const ackDays = !days.length || ack.days;
  const ready = ack.recurring && ackDays && opsSaved;
  const need = [!ack.recurring && "centang tagihan rutin", !ackDays && "konfirmasi hari yang belum OK", !opsSaved && "simpan nilai stok & pembelian dari Parang-ops"].filter(Boolean);

  return (
    <>
      <PageHeader title="Tutup buku" subtitle={`Bulan berikutnya: ${nm} ${p.year}`} />
      <div className="grid lg:grid-cols-5 gap-4">
        <Panel className="lg:col-span-3">
          <ol className="space-y-5">
            <Step n={1} title="Periksa omzet harian">
              {days.length ? (
                <>
                  <p className="text-sm text-parang-neutral">{days.length} hari di {nm} belum berstatus OK:</p>
                  <div className="flex flex-wrap gap-1 mt-2">{days.map((d) => <Pill key={d.date} tone={statusTone(d.status)}>{tgl(d.date)} · {d.status}</Pill>)}</div>
                  <label className="flex items-center gap-2 text-sm mt-2"><input type="checkbox" checked={ack.days} onChange={(e) => setAck({ ...ack, days: e.target.checked })} /> Saya mengerti dan tetap ingin melanjutkan</label>
                </>
              ) : <p className="text-sm text-parang-subtle">Semua hari buka berstatus OK.</p>}
            </Step>
            <Step n={2} title="Pastikan tagihan rutin sudah dijurnal">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ack.recurring} onChange={(e) => setAck({ ...ack, recurring: e.target.checked })} /> Gaji, sewa, listrik, air, dan internet bulan {nm} sudah dicatat</label>
            </Step>
            <Step n={3} title="Isi data setoran PBJT (SSPD)">
              <form onSubmit={(e: FormEvent) => { e.preventDefault(); run(() => closingApi.saveTax(m, tax), `Data SSPD ${nm} tersimpan.`); }} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <Field label="Omzet dilaporkan"><MoneyInput value={tax.reportedRevenue} onChange={(v) => setTax({ ...tax, reportedRevenue: v })} /></Field>
                <Field label="PBJT dibayar"><MoneyInput value={tax.pbjtPaid} onChange={(v) => setTax({ ...tax, pbjtPaid: v })} /></Field>
                <button className="btn-ghost" disabled={busy}>Simpan SSPD</button>
              </form>
            </Step>
            <Step n={4} title="Salin 3 angka dari Parang-ops">
              <p className="text-xs text-parang-subtle mb-2">Ambil setelah stok opname dan adjustment di Parang-ops selesai. Aplikasi ini tidak terhubung ke Parang-ops, jadi angkanya diketik.</p>
              <form onSubmit={(e: FormEvent) => { e.preventDefault(); run(() => closingApi.saveOps(m, ops), `Angka Parang-ops ${nm} tersimpan.`); }} className="grid sm:grid-cols-3 gap-2 items-end">
                <Field label="Nilai stok akhir (wajib)"><MoneyInput value={ops.stockValue} onChange={(v) => setOps({ ...ops, stockValue: v })} /></Field>
                <Field label="Total pembelian (wajib)"><MoneyInput value={ops.purchasesTotal} onChange={(v) => setOps({ ...ops, purchasesTotal: v })} /></Field>
                <Field label="Total penjualan Majoo (opsional)"><MoneyInput value={ops.salesTotal} onChange={(v) => setOps({ ...ops, salesTotal: v })} /></Field>
                <button className="btn-ghost sm:col-span-3 justify-self-start" disabled={busy}>Simpan angka Parang-ops</button>
              </form>
              {opsSaved && (
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm bg-parang-bg rounded-lg p-3 mt-3 tnum">
                  <dt>Pembelian Parang-ops</dt><dd className="text-right">{num(oc.purchasesTotal)}</dd>
                  <dt>Pembelian di jurnal Keuangan</dt><dd className="text-right">{num(oc.financePurchases)}</dd>
                  <dt className="font-semibold">Selisih pembelian</dt><dd className={`text-right font-semibold ${oc.purchaseFlag ? "text-accent-danger" : "text-accent-success"}`}>{acct(oc.purchaseDiff)}</dd>
                  {oc.salesTotal != null && (
                    <>
                      <dt>Penjualan Parang-ops</dt><dd className="text-right">{num(oc.salesTotal)}</dd>
                      <dt>Omzet tercatat Keuangan</dt><dd className="text-right">{num(oc.recordedRevenue)}</dd>
                      <dt className="font-semibold">Selisih omzet</dt><dd className={`text-right font-semibold ${oc.salesFlag ? "text-accent-danger" : "text-accent-success"}`}>{acct(oc.salesDiff)}</dd>
                    </>
                  )}
                  <dd className="col-span-2 text-xs text-parang-subtle mt-1">
                    {oc.purchaseFlag || oc.salesFlag ? "Selisih melewati toleransi. Cek nota yang hanya dicatat di satu aplikasi atau beda tanggal. Tutup buku tetap bisa dilanjutkan." : "Selisih masih dalam toleransi."}
                  </dd>
                </dl>
              )}
            </Step>
            <Step n={5} title="Tutup buku">
              <p className="text-xs text-parang-subtle mb-2">Sistem membuat jurnal otomatis (termasuk penyesuaian persediaan), menjalankan 4 cek kesehatan, lalu mengunci {nm}.</p>
              {isOwner ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn" disabled={!ready || busy} onClick={() => run(() => closingApi.close({ ackRecurring: ack.recurring, ackNotOkDays: ack.days }), `${nm} ${p.year} ditutup.`)}>
                    Tutup buku {nm} {p.year}
                  </button>
                  {!ready && <span className="text-xs text-parang-subtle">Belum bisa: {need.join(", ")}.</span>}
                </div>
              ) : (
                <p className="text-sm text-parang-neutral">Hanya owner yang bisa menutup buku. Admin cukup menyiapkan langkah 3 dan 4.</p>
              )}
            </Step>
          </ol>
        </Panel>
        <div className="lg:col-span-2 space-y-4">
          <Panel title="Jurnal otomatis yang akan dibuat" hint={`Bertanggal ${p.lastDate ? tgl(p.lastDate) : ""}. Dari Omzet Harian, Aset Tetap, SSPD, dan nilai stok Parang-ops.`}>
            <table className="w-full text-sm tnum">
              <thead className="text-xs text-parang-subtle text-left"><tr><th className="py-1">Debet</th><th>Kredit</th><th className="text-right">Nominal</th></tr></thead>
              <tbody>
                {(p.autoJournal ?? []).map((j) => (
                  <tr key={j.voucherNo} className="border-t border-parang-divider/60">
                    <td className="py-1.5 pr-2">{j.debit}{j.isInventoryAdjustment && <> <Pill tone="wait">persediaan</Pill></>}</td>
                    <td className="pr-2">{j.credit}</td>
                    <td className="text-right">{num(j.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!opsSaved && <p className="text-xs text-parang-subtle mt-2">Penyesuaian persediaan muncul setelah nilai stok Parang-ops disimpan.</p>}
            <div className="mt-4"><CheckList checks={p.checks ?? []} /></div>
          </Panel>
          {reopen}
        </div>
      </div>
      <div className="mt-4"><OpsHistory rows={p.history} closedMonth={p.closedMonth} tolerances={p.tolerances} /></div>
    </>
  );
}
