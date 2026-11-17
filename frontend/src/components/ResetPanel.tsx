import { useState } from "react";
import { resetApi, ResetCounts } from "../api";
import { useToast } from "../context/ToastContext";
import { BULAN, num } from "../utils/format";
import { ErrorBox, Field, Loading, Panel } from "./ui";

type Preview = ResetCounts & { empty: boolean };

function items(c: Preview): string[] {
  const rows: [string, number][] = [
    ["hari omzet harian", c.dailySales],
    ["bon karyawan", c.staffBons],
    ["jurnal manual", c.manualJournals],
    ["arsip jurnal sistem (tutup buku)", c.systemJournals],
    ["aset tetap", c.assets],
    ["data SSPD", c.taxFilings],
    ["angka Parang-ops", c.opsFigures],
    ["riwayat tutup buku", c.closings],
    ["rincian saldo awal per pihak", c.openingDetails],
    ["pihak (karyawan, supplier, dll.)", c.parties],
    ["event", c.events],
    ["catatan event", c.eventNotes],
  ];
  const out = rows.filter(([, n]) => n > 0).map(([l, n]) => `${num(n)} ${l}`);
  if (c.openingBalances) out.push(`saldo awal ${num(c.openingBalances)} akun dijadikan 0`);
  if (c.closedMonth) out.push(`tutup buku ${c.firstYear} (s.d. ${BULAN[c.closedMonth - 1]}) kembali ke "belum ada bulan ditutup"`);
  if (c.extraYears.length) out.push(`tahun buku ${c.extraYears.join(", ")} dihapus`);
  return out;
}

const backupName = () => `cadangan-reset-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;

/**
 * Reset data (owner): kosongkan semua data transaksi, mis. data dummy/percobaan, supaya bisa mulai dengan data asli.
 * Alur: pratinjau → unduh cadangan → ketik RESET + PIN → hapus.
 */
export default function ResetPanel() {
  const toast = useToast();
  const [p, setP] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backedUp, setBackedUp] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setP(await resetApi.preview());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat pratinjau.");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setP(null);
    setError("");
    setBackedUp(false);
    setConfirm("");
    setPin("");
  }

  async function download() {
    setBusy(true);
    try {
      const data = await resetApi.backup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = backupName();
      a.click();
      URL.revokeObjectURL(a.href);
      setBackedUp(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal mengunduh cadangan.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    setBusy(true);
    try {
      await resetApi.run({ confirm, pin });
      toast("Semua data sudah dikosongkan. Halaman dimuat ulang…");
      // Bulan tutup buku, tahun buku, dan cache semua halaman berubah: muat ulang aplikasi.
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reset gagal.", "error");
      setBusy(false);
    }
  }

  const canRun = !!p && !p.empty && backedUp && confirm === "RESET" && /^\d{6}$/.test(pin) && !busy;

  return (
    <Panel
      title="Reset data"
      hint="Mengosongkan SEMUA data transaksi secara permanen, misalnya data dummy atau uji coba, supaya bisa mulai dengan data asli. Daftar akun, pengguna & PIN, pengaturan, dan jejak audit tetap ada."
      className="danger-zone"
    >
      {!p && !loading && !error ? (
        <button className="btn ghost" onClick={load}>Siapkan reset…</button>
      ) : loading ? (
        <Loading label="Menghitung data…" />
      ) : error || !p ? (
        <ErrorBox message={error || "Gagal memuat."} onRetry={load} />
      ) : p.empty ? (
        <div className="btns">
          <span className="note">Data sudah kosong; tidak ada yang perlu direset.</span>
          <button className="btn ghost" onClick={close}>Tutup</button>
        </div>
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          <div>
            <p className="note" style={{ marginBottom: 6 }}><b>1. Yang akan dihapus</b></p>
            <ul className="note" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              {items(p).map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
          <div>
            <p className="note" style={{ marginBottom: 6 }}><b>2. Unduh cadangan</b>: simpan file ini; berisi semua data sebelum dikosongkan.</p>
            <button className="btn ghost" disabled={busy} onClick={download}>{backedUp ? "Cadangan sudah diunduh ✓ (unduh lagi)" : "Unduh cadangan (.json)"}</button>
          </div>
          <div>
            <p className="note" style={{ marginBottom: 6 }}><b>3. Konfirmasi</b>: penghapusan tidak bisa dibatalkan.</p>
            <form className="f" onSubmit={(e) => { e.preventDefault(); if (canRun) run(); }}>
              <fieldset>
                <Field label='Ketik "RESET"'>
                  <input autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={!backedUp} />
                </Field>
                <Field label="PIN owner">
                  <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} disabled={!backedUp} />
                </Field>
              </fieldset>
              <div className="btns">
                <button className="btn danger" type="submit" disabled={!canRun}>{busy ? "Menghapus…" : "Kosongkan semua data"}</button>
                <button type="button" className="btn ghost" disabled={busy} onClick={close}>Batal</button>
                {!backedUp && <span className="note">Unduh cadangan dulu.</span>}
              </div>
            </form>
          </div>
        </div>
      )}
    </Panel>
  );
}
