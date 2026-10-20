import { FormEvent, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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

  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} />;
  const akumLabel = `Akum. s.d. ${BLN3[data.closedMonth - 1] ?? "–"}`;
  const okEquip = data.totals.cost === data.ledgerCheck.equipmentBalance;
  const okAkum = data.totals.accumulated === data.ledgerCheck.accumulatedBalance;

  return (
    <>
      <PageHeader
        title="Aset tetap"
        subtitle={`${data.assets.length} aset · garis lurus, mulai bulan setelah perolehan`}
        actions={
          <>
            {!form && <button className="btn" onClick={() => setForm({ name: "", acquiredOn: todayJakarta(), cost: null, usefulLifeYears: 4 })}><Plus className="w-4 h-4" /> Aset baru</button>}
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
          <form onSubmit={submit} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <Field label="Nama aset"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Tanggal perolehan"><input className="input" type="date" value={form.acquiredOn} onChange={(e) => setForm({ ...form, acquiredOn: e.target.value })} /></Field>
            <Field label="Harga perolehan"><MoneyInput value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} /></Field>
            <Field label="Masa manfaat (tahun)">
              <input className="input" type="number" min={1} max={50} value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: Number(e.target.value) })} />
            </Field>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <button className="btn" disabled={busy}>Simpan</button>
              <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Batal</button>
            </div>
          </form>
        </Panel>
      )}
      <div className="bg-white rounded-xl border border-parang-divider overflow-x-auto">
        <table className="w-full text-sm tnum">
          <thead className="text-xs text-parang-subtle bg-parang-bg">
            <tr className="text-right">
              <th className="text-left px-3 py-2">Nama aset</th><th className="text-left px-3">Diperoleh</th><th className="px-3">Harga</th>
              <th className="px-3">Masa</th><th className="text-left px-3">Mulai susut</th><th className="px-3">Per bulan</th>
              <th className="px-3">{akumLabel}</th><th className="px-3">Nilai buku</th><th />
            </tr>
          </thead>
          <tbody>
            {data.assets.map((a) => (
              <tr key={a.id ?? a.name} className="border-t border-parang-divider/60 text-right">
                <td className="text-left px-3 py-1.5 min-w-[220px]">{a.name}</td>
                <td className="text-left px-3 whitespace-nowrap">{tgl(a.acquiredOn)}</td>
                <td className="px-3">{num(a.cost)}</td><td className="px-3">{a.usefulLifeYears}</td>
                <td className="text-left px-3 whitespace-nowrap">{tgl(a.depreciationStart)}</td>
                <td className="px-3">{num(a.perMonth)}</td><td className="px-3">{num(a.accumulated)}</td><td className="px-3">{num(a.bookValue)}</td>
                <td className="px-2">
                  {user?.role === "OWNER" && a.id && Number(a.acquiredOn.slice(5, 7)) > data.closedMonth && (
                    <button className="text-parang-subtle hover:text-accent-danger" onClick={() => voidAsset(a.id!, a.name)} title="Batalkan"><Trash2 className="w-4 h-4" /></button>
                  )}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-parang-text font-bold text-right">
              <td className="text-left px-3 py-2">Total</td><td /><td className="px-3">{num(data.totals.cost)}</td><td /><td /><td />
              <td className="px-3">{num(data.totals.accumulated)}</td><td className="px-3">{num(data.totals.bookValue)}</td><td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className={`text-xs mt-3 ${okEquip && okAkum ? "text-parang-subtle" : "text-accent-danger"}`}>
        Cek ke buku besar: saldo Peralatan {num(data.ledgerCheck.equipmentBalance)} {okEquip ? "✓" : "≠ total harga"} · saldo Akumulasi Penyusutan{" "}
        {num(data.ledgerCheck.accumulatedBalance)} {okAkum ? "✓" : "≠ total akumulasi"}. Penyusutan per bulan masuk ke jurnal otomatis saat tutup buku.
      </p>
    </>
  );
}
