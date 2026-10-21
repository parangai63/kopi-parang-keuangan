import { FormEvent, useState } from "react";
import { Trash2 } from "lucide-react";
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
  const [form, setForm] = useState<{ name: string; acquiredOn: string; cost: number | null; usefulLifeYears: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      await assetApi.create(form);
      toast(`Aset "${form.name}" tersimpan. Ingat jurnal pembeliannya (Dr Peralatan).`);
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

  return (
    <>
      <PageHeader
        title="Aset tetap"
        subtitle={`${data.assets.length} aset · garis lurus, mulai bulan setelah perolehan`}
        actions={
          <>
            {!form && <button className="btn" onClick={() => setForm({ name: "", acquiredOn: todayJakarta(), cost: null, usefulLifeYears: 4 })}>+ Aset baru</button>}
            <ExportMenu
              build={() => ({
                filename: "aset-tetap", title: "Aset Tetap & Penyusutan", period: periodLabel(data.year, data.closedMonth),
                columns: [
                  { header: "Nama aset", key: "name" }, { header: "Diperoleh", key: "acquiredOn" }, { header: "Harga", key: "cost", numeric: true },
                  { header: "Masa (thn)", key: "usefulLifeYears", numeric: true }, { header: "Mulai susut", key: "depreciationStart" },
                  { header: "Per bulan", key: "perMonth", numeric: true }, { header: akumLabel, key: "accumulated", numeric: true },
                  { header: "Nilai buku", key: "bookValue", numeric: true },
                ],
                rows: data.assets.map((a) => ({
                  ...a, acquiredOn: tgl(a.acquiredOn), depreciationStart: tgl(a.depreciationStart),
                  cost: num(a.cost), perMonth: num(a.perMonth), accumulated: num(a.accumulated), bookValue: num(a.bookValue),
                })),
              })}
            />
          </>
        }
      />
      {form && (
        <Panel title="Aset baru" hint="Untuk pembelian peralatan ≥ Rp1 juta. Tanggal perolehan harus di bulan yang belum ditutup." className="mb-4">
          <form className="f" onSubmit={submit}>
            <fieldset>
              <Field label="Nama aset"><input autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Tanggal perolehan"><input type="date" value={form.acquiredOn} onChange={(e) => setForm({ ...form, acquiredOn: e.target.value })} /></Field>
              <Field label="Harga perolehan"><MoneyInput value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} /></Field>
              <Field label="Masa manfaat (tahun)">
                <input type="number" min={1} max={50} value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: Number(e.target.value) })} />
              </Field>
            </fieldset>
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
              <th>Nama aset</th><th>Diperoleh</th><th className="r">Harga</th><th className="r">Masa (thn)</th><th>Mulai susut</th>
              <th className="r">Per bulan</th><th className="r">{akumLabel}</th><th className="r">Nilai buku</th>{isOwner && <th />}
            </tr>
          </thead>
          <tbody>
            {data.assets.map((a) => (
              <tr key={a.id ?? a.name}>
                <td>{a.name}</td>
                <td className="acc">{tgl(a.acquiredOn)}</td>
                <td className="r">{num(a.cost)}</td><td className="r">{a.usefulLifeYears}</td>
                <td className="acc">{tgl(a.depreciationStart)}</td>
                <td className="r">{num(a.perMonth)}</td><td className="r">{num(a.accumulated)}</td><td className="r">{num(a.bookValue)}</td>
                {isOwner && (
                  <td className="act">
                    {a.id && Number(a.acquiredOn.slice(5, 7)) > data.closedMonth && (
                      <button className="iconbtn" onClick={() => voidAsset(a.id!, a.name)} title="Batalkan" aria-label={`Batalkan ${a.name}`}><Trash2 /></button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            <tr className="grand">
              <td>Total</td><td /><td className="r">{num(data.totals.cost)}</td><td /><td /><td />
              <td className="r">{num(data.totals.accumulated)}</td><td className="r">{num(data.totals.bookValue)}</td>{isOwner && <td />}
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
