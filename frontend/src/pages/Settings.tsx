import { FormEvent, useEffect, useState } from "react";
import { masterApi } from "../api";
import { useApi } from "../utils/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { BULAN } from "../utils/format";
import { ErrorBox, Field, Loading, PageHeader, Panel } from "../components/ui";
import AccountsPanel from "../components/AccountsPanel";
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

/** Pengaturan (owner ubah, admin lihat) + Daftar Akun & saldo awal (AccountsPanel). */
export default function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = user?.role === "OWNER";
  const settings = useApi(() => masterApi.settings(), []);
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

        <AccountsPanel />
      </div>
    </>
  );
}
