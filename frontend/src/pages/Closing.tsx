import { FormEvent, ReactNode, useEffect, useState } from "react";
import { closingApi } from "../api";
import { useApi } from "../utils/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { acct, BULAN, num, tgl } from "../utils/format";
import { CalcList, CheckList, ErrorBox, Field, Loading, PageHeader, Panel, Pill, statusTone } from "../components/ui";
import MoneyInput from "../components/MoneyInput";
import OpsHistory from "../components/closing/OpsHistory";

/** Satu langkah wizard; nomornya dari counter CSS .steps/.step (rancangan original). */
function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="step">
      <div>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/** Wizard tutup buku bulanan (spesifikasi: Alur kerja, 6 langkah) — susunan vTutup() di rancangan original. */
export default function ClosingPage() {
  const { user, refresh } = useAuth();
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

  if (loading) return <><PageHeader title="Tutup buku" /><Loading /></>;
  if (error || !p) return <><PageHeader title="Tutup buku" /><ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} /></>;

  const run = async (fn: () => Promise<unknown>, ok: string, period = false) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      reload();
      if (period) {
        setAck({ days: false, recurring: false });
        await refresh();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal.", "error");
    } finally {
      setBusy(false);
    }
  };

  const reopen = p.closedMonth > 0 && isOwner && (
    <Panel title={`Buka kembali ${BULAN[p.closedMonth - 1]}`} hint="Dipakai jika ada koreksi di bulan yang sudah ditutup. Tercatat di riwayat perubahan.">
      {confirmReopen ? (
        <div className="btns">
          <span className="note">Yakin membuka kembali {BULAN[p.closedMonth - 1]} {p.year}?</span>
          <button className="btn danger" disabled={busy} onClick={() => run(closingApi.reopen, `${BULAN[p.closedMonth - 1]} ${p.year} dibuka kembali.`, true).then(() => setConfirmReopen(false))}>Ya, buka kembali</button>
          <button className="btn ghost" onClick={() => setConfirmReopen(false)}>Batal</button>
        </div>
      ) : (
        <button className="btn ghost" onClick={() => setConfirmReopen(true)}>Buka kembali {BULAN[p.closedMonth - 1]} {p.year}</button>
      )}
    </Panel>
  );

  if (!p.nextMonth) {
    return (
      <>
        <PageHeader title="Tutup buku" subtitle="Tahun buku sudah ditutup seluruhnya" />
        <div className="grid">
          <p className="note">Semua bulan sudah ditutup.</p>
          {reopen}
          <OpsHistory rows={p.history} closedMonth={p.closedMonth} tolerances={p.tolerances} />
        </div>
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
  const need = [!ack.recurring && "centang tagihan rutin", !ackDays && "konfirmasi hari yang belum OK", !opsSaved && "simpan nilai stok dan pembelian dari Parang-ops"].filter(Boolean);

  return (
    <>
      <PageHeader title="Tutup buku" subtitle={`Bulan berikutnya: ${nm} ${p.year}`} />
      <div className="two">
        <Panel>
          <div className="steps">
            <Step title="Periksa omzet harian">
              {days.length ? (
                <>
                  <p className="note">{days.length} hari di {nm} belum berstatus OK:</p>
                  <div className="daylist">{days.map((d) => <Pill key={d.date} tone={statusTone(d.status)}>{tgl(d.date)} · {d.status}</Pill>)}</div>
                  <label className="check" style={{ marginTop: 8 }}>
                    <input type="checkbox" checked={ack.days} onChange={(e) => setAck({ ...ack, days: e.target.checked })} /> Saya mengerti dan tetap ingin melanjutkan
                  </label>
                </>
              ) : <p className="note">Semua hari buka berstatus OK.</p>}
            </Step>
            <Step title="Pastikan tagihan rutin sudah dijurnal">
              <label className="check">
                <input type="checkbox" checked={ack.recurring} onChange={(e) => setAck({ ...ack, recurring: e.target.checked })} /> Gaji, sewa, listrik, air, dan internet bulan {nm} sudah dicatat
              </label>
            </Step>
            <Step title="Isi data setoran PBJT (SSPD)">
              <form className="f" onSubmit={(e: FormEvent) => { e.preventDefault(); run(() => closingApi.saveTax(m, tax), `Data SSPD ${nm} tersimpan.`); }}>
                <fieldset>
                  <Field label="Omzet dilaporkan"><MoneyInput value={tax.reportedRevenue} onChange={(v) => setTax({ ...tax, reportedRevenue: v })} /></Field>
                  <Field label="PBJT dibayar"><MoneyInput value={tax.pbjtPaid} onChange={(v) => setTax({ ...tax, pbjtPaid: v })} /></Field>
                </fieldset>
                <div className="btns"><button className="btn ghost" type="submit" disabled={busy}>Simpan data SSPD</button></div>
              </form>
            </Step>
            <Step title="Salin 3 angka dari Parang-ops">
              <p className="note">Ambil setelah stok opname dan adjustment di Parang-ops selesai. Aplikasi ini tidak terhubung ke Parang-ops, jadi angkanya diketik.</p>
              <form className="f" style={{ marginTop: 8 }} onSubmit={(e: FormEvent) => { e.preventDefault(); run(() => closingApi.saveOps(m, ops), `Angka Parang-ops ${nm} tersimpan.`); }}>
                <fieldset>
                  <Field label="Nilai stok akhir (wajib)"><MoneyInput value={ops.stockValue} onChange={(v) => setOps({ ...ops, stockValue: v })} /></Field>
                  <Field label="Total pembelian (wajib)"><MoneyInput value={ops.purchasesTotal} onChange={(v) => setOps({ ...ops, purchasesTotal: v })} /></Field>
                  <Field label="Total penjualan Majoo (opsional)"><MoneyInput value={ops.salesTotal} onChange={(v) => setOps({ ...ops, salesTotal: v })} /></Field>
                </fieldset>
                <div className="btns"><button className="btn ghost" type="submit" disabled={busy}>Simpan angka Parang-ops</button></div>
              </form>
              {opsSaved && (
                <>
                  <div style={{ marginTop: 10 }}>
                    <CalcList
                      rows={[
                        { label: "Pembelian Parang-ops", value: num(oc.purchasesTotal) },
                        { label: "Pembelian di jurnal Keuangan", value: num(oc.financePurchases) },
                        { label: "Selisih pembelian", value: acct(oc.purchaseDiff), big: true, cls: oc.purchaseFlag ? "neg" : "pos" },
                        ...(oc.salesTotal != null
                          ? [
                              { label: "Penjualan Parang-ops", value: num(oc.salesTotal) },
                              { label: "Omzet tercatat Keuangan", value: num(oc.recordedRevenue) },
                              { label: "Selisih omzet", value: acct(oc.salesDiff), big: true, cls: oc.salesFlag ? "neg" : "pos" },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                  <p className="note" style={{ marginTop: 6 }}>
                    {oc.purchaseFlag || oc.salesFlag ? "Selisih melewati toleransi. Cek nota yang hanya dicatat di satu aplikasi atau beda tanggal. Tutup buku tetap bisa dilanjutkan." : "Selisih masih dalam toleransi."}
                  </p>
                </>
              )}
            </Step>
            <Step title="Tutup buku">
              <p className="note">Sistem membuat jurnal otomatis (termasuk penyesuaian persediaan), menjalankan 4 cek kesehatan, lalu mengunci {nm}.</p>
              {isOwner ? (
                <div className="btns" style={{ marginTop: 8 }}>
                  <button className="btn" disabled={!ready || busy} onClick={() => run(() => closingApi.close({ ackRecurring: ack.recurring, ackNotOkDays: ack.days }), `${nm} ${p.year} ditutup.`, true)}>
                    Tutup buku {nm} {p.year}
                  </button>
                  {!ready && <span className="note">Belum bisa: {need.join(", ")}.</span>}
                </div>
              ) : (
                <p className="note" style={{ marginTop: 8 }}>Hanya owner yang bisa menutup buku. Admin cukup menyiapkan langkah 3 dan 4.</p>
              )}
            </Step>
          </div>
        </Panel>
        <div className="grid">
          <Panel title="Jurnal otomatis yang akan dibuat" hint={`Bertanggal ${p.lastDate ? tgl(p.lastDate) : ""}. Dihitung dari Omzet Harian, Aset Tetap, data SSPD, dan nilai stok Parang-ops.`}>
            <div className="tw">
              <table className="t">
                <thead><tr><th>Debet</th><th>Kredit</th><th className="r">Nominal</th></tr></thead>
                <tbody>
                  {(p.autoJournal ?? []).map((j) => (
                    <tr key={j.voucherNo}>
                      <td>{j.debit}{j.isInventoryAdjustment && <> <Pill tone="adj">persediaan</Pill></>}</td>
                      <td>{j.credit}</td>
                      <td className="r">{num(j.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!opsSaved && <p className="note" style={{ marginTop: 8 }}>Penyesuaian persediaan muncul setelah nilai stok Parang-ops disimpan.</p>}
            <div style={{ marginTop: 14 }}><CheckList checks={p.checks ?? []} /></div>
          </Panel>
          {reopen}
        </div>
      </div>
      <div style={{ marginTop: 16 }}><OpsHistory rows={p.history} closedMonth={p.closedMonth} tolerances={p.tolerances} /></div>
    </>
  );
}
