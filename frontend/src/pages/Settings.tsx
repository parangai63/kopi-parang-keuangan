import { FormEvent, useEffect, useState } from "react";
import { masterApi } from "../api";
import { useApi } from "../utils/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { BULAN, num } from "../utils/format";
import { ErrorBox, Field, Loading, PageHeader, Panel, Pill } from "../components/ui";
import MoneyInput from "../components/MoneyInput";
import type { Settings } from "../types";

const PCT_FIELDS: [keyof Settings, string][] = [
  ["pbjtRate", "Tarif PBJT"],
  ["foodCostLimit", "Batas food cost"],
  ["payrollLimit", "Batas payroll"],
  ["occupancyLimit", "Batas sewa (occupancy)"],
  ["primeCostLimit", "Batas prime cost"],
  ["netMarginTarget", "Target net margin minimal"],
  ["opsPurchaseTolerancePct", "Toleransi cek pembelian Parang-ops"],
  ["opsSalesTolerancePct", "Toleransi cek omzet Parang-ops"],
];

/** Pengaturan (owner ubah, admin lihat) + Daftar Akun & saldo awal. */
export default function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = user?.role === "OWNER";
  const settings = useApi(() => masterApi.settings(), []);
  const accounts = useApi(() => masterApi.accounts(), []);
  const [s, setS] = useState<Settings | null>(null);

  useEffect(() => setS(settings.data), [settings.data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!s) return;
    try {
      const { closedMonth: _c, fiscalYear: _f, ...body } = s;
      setS(await masterApi.saveSettings(body));
      toast("Pengaturan tersimpan.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal.", "error");
    }
  }

  return (
    <>
      <PageHeader title="Akun & pengaturan" subtitle={canEdit ? "Owner dapat mengubah." : "Hanya owner yang dapat mengubah; admin melihat."} />
      <div className="grid">
        {settings.loading || !s ? (
          settings.error ? <ErrorBox message={settings.error} onRetry={settings.reload} /> : <Loading />
        ) : (
          <Panel title="Pengaturan" hint={`Tahun buku ${s.fiscalYear} · tutup buku s.d. ${s.closedMonth ? BULAN[s.closedMonth - 1] : "–"} (diubah lewat wizard Tutup Buku).`}>
            <form className="f" onSubmit={save}>
              <fieldset disabled={!canEdit}>
                <Field label="Nama usaha"><input value={s.businessName} onChange={(e) => setS({ ...s, businessName: e.target.value })} /></Field>
                <Field label="Target omzet bulanan"><MoneyInput value={s.revenueTarget} disabled={!canEdit} onChange={(v) => setS({ ...s, revenueTarget: v ?? 0 })} /></Field>
                <Field label="Batas selisih tunai per hari"><MoneyInput value={s.cashDiffThreshold} disabled={!canEdit} onChange={(v) => setS({ ...s, cashDiffThreshold: v ?? 0 })} /></Field>
                {PCT_FIELDS.map(([k, label]) => (
                  <Field key={k} label={`${label} (%)`}>
                    <input
                      className="money"
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={Math.round((s[k] as number) * 1000) / 10}
                      onChange={(e) => setS({ ...s, [k]: Number(e.target.value) / 100 })}
                    />
                  </Field>
                ))}
                <div className="checkrow">
                  <label className="check"><input type="checkbox" checked={s.priceIncludesTax} onChange={(e) => setS({ ...s, priceIncludesTax: e.target.checked })} /> Harga menu sudah termasuk PBJT</label>
                  <label className="check"><input type="checkbox" checked={s.accruePbjt} onChange={(e) => setS({ ...s, accruePbjt: e.target.checked })} /> Akui estimasi PBJT kurang bayar</label>
                </div>
              </fieldset>
              {canEdit && <div className="btns"><button className="btn" type="submit">Simpan pengaturan</button></div>}
            </form>
          </Panel>
        )}

        <Panel title="Daftar akun" hint="Akun yang sudah dipakai tidak bisa dihapus, hanya dinonaktifkan. Saldo awal Ekuitas Kopi Parang dihitung otomatis.">
          {accounts.loading ? <Loading /> : accounts.error || !accounts.data ? <ErrorBox message={accounts.error ?? ""} onRetry={accounts.reload} /> : (
            <div className="tw">
              <table className="t">
                <thead>
                  <tr><th>Kode</th><th>Nama akun</th><th>Kelompok</th><th>Normal</th><th>Kategori kas</th><th>Baris arus kas</th><th className="r">Saldo awal 1 Jan</th><th /></tr>
                </thead>
                <tbody>
                  {accounts.data.map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{a.code}</td>
                      <td className="acc">{a.name}</td>
                      <td>{a.group}</td>
                      <td>{a.normalSide}</td>
                      <td>{a.cashCategory}</td>
                      <td>{a.cashFlowLine ?? "—"}</td>
                      <td className="r">{a.code === "3101" ? <span className="note">otomatis</span> : num(a.openingBalance)}</td>
                      <td>{!a.isActive && <Pill>nonaktif</Pill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
