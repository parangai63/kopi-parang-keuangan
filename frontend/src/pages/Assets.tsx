import { FormEvent, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { assetApi } from "../api";
import { useApi } from "../utils/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { BLN3, num, periodLabel, tgl, todayJakarta } from "../utils/format";
import { ErrorBox, Field, Loading, PageHeader, Panel } from "../components/ui";
import MoneyInput from "../components/MoneyInput";
import ExportMenu from "../components/ExportMenu";

export default function AssetsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => assetApi.list(), []);
  const [form, setForm] = useState<{ id?: number; name: string; acquiredOn: string; cost: number | null; usefulLifeYears: number } | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const { id, ...body } = form;
      if (id) {
        await assetApi.update(id, body);
        toast(`Aset "${form.name}" diperbarui.`);
      } else {
        await assetApi.create(body);
        toast(`Aset "${form.name}" tersimpan. Ingat jurnal pembeliannya (Dr Peralatan).`);
      }
      setForm(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menyimpan.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function voidAsset(id: number, name: string) {
    if (!window.confirm(`Batalkan aset "${name}"?`)) return;
    try {
      await assetApi.void(id);
      toast("Aset dibatalkan.");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal.", "error");
    }
  }

  if (loading) return <><PageHeader title="Aset tetap" /><Loading /></>;
  if (error || !data) return <><PageHeader title="Aset tetap" /><ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} /></>;
  const akumLabel = `Akum. s.d. ${BLN3[data.closedMonth - 1] ?? "–"}`;
  const okEquip = data.totals.cost === data.ledgerCheck.equipmentBalance;
  const okAkum = data.totals.accumulated === data.ledgerCheck.accumulatedBalance;
  const isOwner = user?.role === "OWNER";
  // Aset hanya bisa diubah/dibatalkan bila diperoleh di bulan yang belum ditutup.
  const editable = (acquiredOn: string) => Number(acquiredOn.slice(0, 4)) === data.year && Number(acquiredOn.slice(5, 7)) > data.closedMonth;
  const months = BLN3.map((label, i) => ({ label, m: i + 1 }));

  return (
    <>
      <PageHeader
        title="Aset tetap"
        subtitle={`${data.assets.length} aset · garis lurus, mulai bulan setelah perolehan`}
        actions={
          <>
            <button className="btn ghost" onClick={() => setShowSchedule(!showSchedule)}>
              {showSchedule ? "Tampilan ringkas" : "Jadwal per bulan"}
            </button>
            {!form && <button className="btn" onClick={() => setForm({ name: "", acquiredOn: todayJakarta(), cost: null, usefulLifeYears: 4 })}>+ Aset baru</button>}
            <ExportMenu
              build={() => ({
                filename: "aset-tetap", title: "Aset Tetap & Penyusutan", period: periodLabel(data.year, data.closedMonth),
                columns: [
                  { header: "Nama aset", key: "name" }, { header: "Diperoleh", key: "acquiredOn" }, { header: "Harga", key: "cost", numeric: true },
                  { header: "Masa (thn)", key: "usefulLifeYears", numeric: true }, { header: "Mulai susut", key: "depreciationStart" },
                  { header: "Per bulan", key: "perMonth", numeric: true },
                  ...(showSchedule ? months.map(({ label, m }) => ({ header: label, key: `m${m}`, numeric: true })) : []),
                  { header: akumLabel, key: "accumulated", numeric: true }, { header: "Nilai buku", key: "bookValue", numeric: true },
                ],
                rows: data.assets.map((a) => ({
                  ...a, acquiredOn: tgl(a.acquiredOn), depreciationStart: tgl(a.depreciationStart),
                  cost: num(a.cost), perMonth: num(a.perMonth), accumulated: num(a.accumulated), bookValue: num(a.bookValue),
                  ...Object.fromEntries(months.map(({ m }) => [`m${m}`, num(a.schedule[m])])),
                })),
              })}
            />
          </>
        }
      />
      {form && (
        <Panel title={form.id ? "Ubah aset" : "Aset baru"} hint="Untuk pembelian peralatan ≥ Rp1 juta. Tanggal perolehan harus di bulan yang belum ditutup." className="mb-4">
          <form className="f" onSubmit={submit}>
            <fieldset>
              <Field label="Nama aset"><input autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Tanggal perolehan"><input type="date" value={form.acquiredOn} onChange={(e) => setForm({ ...form, acquiredOn: e.target.value })} /></Field>
              <Field label="Harga perolehan"><MoneyInput value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} /></Field>
              <Field label="Masa manfaat (tahun)">
                <input type="number" min={1} max={50} value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: Number(e.target.value) })} />
              </Field>
            </fieldset>
            {form.cost != null && form.cost > 0 && form.cost < 1_000_000 && (
              <p className="note warn-text">
                Harga di bawah Rp1 juta. Sesuai kebijakan di Excel, barang seperti ini sebaiknya langsung dibebankan lewat Jurnal
                (Beban Perlengkapan), bukan dicatat sebagai aset tetap.
              </p>
            )}
            <div className="btns">
              <button className="btn" type="submit" disabled={busy}>Simpan</button>
              <button type="button" className="btn ghost" onClick={() => setForm(null)}>Batal</button>
            </div>
          </form>
        </Panel>
      )}
      <div className="tw">
        <table className="t rep">
          <thead>
            <tr>
              <th>Nama aset</th>
              {showSchedule ? (
                <>
                  <th className="r">Harga</th>
                  {months.map(({ label, m }) => <th key={m} className="r">{label}</th>)}
                </>
              ) : (
                <><th>Diperoleh</th><th className="r">Harga</th><th className="r">Masa (thn)</th><th>Mulai susut</th><th className="r">Per bulan</th></>
              )}
              <th className="r">{akumLabel}</th><th className="r">Nilai buku</th><th />
            </tr>
          </thead>
          <tbody>
            {data.assets.map((a) => (
              <tr key={a.id ?? a.name}>
                <td>{a.name}</td>
                {showSchedule ? (
                  <>
                    <td className="r">{num(a.cost)}</td>
                    {months.map(({ m }) => <td key={m} className="r">{a.schedule[m] ? num(a.schedule[m]) : ""}</td>)}
                  </>
                ) : (
                  <>
                    <td className="acc">{tgl(a.acquiredOn)}</td>
                    <td className="r">{num(a.cost)}</td><td className="r">{a.usefulLifeYears}</td>
                    <td className="acc">{tgl(a.depreciationStart)}</td>
                    <td className="r">{num(a.perMonth)}</td>
                  </>
                )}
                <td className="r">{num(a.accumulated)}</td><td className="r">{num(a.bookValue)}</td>
                <td className="act">
                  {a.id && editable(a.acquiredOn) && (
                    <>
                      <button
                        className="iconbtn" title="Ubah" aria-label={`Ubah ${a.name}`}
                        onClick={() => setForm({ id: a.id, name: a.name, acquiredOn: a.acquiredOn, cost: a.cost, usefulLifeYears: a.usefulLifeYears })}
                      >
                        <Pencil />
                      </button>
                      {isOwner && (
                        <button className="iconbtn" onClick={() => voidAsset(a.id!, a.name)} title="Batalkan" aria-label={`Batalkan ${a.name}`}><Trash2 /></button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
            <tr className="grand">
              <td>Total</td>
              {showSchedule ? (
                <>
                  <td className="r">{num(data.totals.cost)}</td>
                  {months.map(({ m }) => <td key={m} className="r">{num(data.assets.reduce((s, a) => s + a.schedule[m], 0))}</td>)}
                </>
              ) : (
                <><td /><td className="r">{num(data.totals.cost)}</td><td /><td /><td /></>
              )}
              <td className="r">{num(data.totals.accumulated)}</td><td className="r">{num(data.totals.bookValue)}</td><td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className={`note ${okEquip && okAkum ? "" : "neg"}`} style={{ marginTop: 10 }}>
        Cek ke buku besar: saldo Peralatan {num(data.ledgerCheck.equipmentBalance)} {okEquip ? "✓" : "≠ total harga"} · saldo Akumulasi Penyusutan{" "}
        {num(data.ledgerCheck.accumulatedBalance)} {okAkum ? "✓" : "≠ total akumulasi"}. Penyusutan per bulan masuk ke jurnal otomatis saat tutup buku.
      </p>
    </>
  );
}
