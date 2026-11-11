import { useState } from "react";
import { closingApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { BULAN } from "../../utils/format";
import { Panel } from "../ui";
import type { ClosingYears } from "../../types";

/** Buat tahun buku berikutnya (rollover). Hanya owner; tampil saat melihat tahun buku terbaru. */
export default function NewYearPanel({ info }: { info: NonNullable<ClosingYears["newYear"]> }) {
  const { user, switchYear } = useAuth();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const isOwner = user?.role === "OWNER";
  const { latestYear: Y, nextYear: N } = info;
  const decOpen = info.latestClosedMonth < 12;

  async function start() {
    setBusy(true);
    try {
      const r = await closingApi.newYear();
      toast(`Tahun buku ${r.year} dibuat.`);
      await switchYear(r.year);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal membuat tahun buku.", "error");
      setBusy(false);
    }
  }

  return (
    <Panel title={`Tahun buku ${N}`} hint="Saldo awal dihitung otomatis dari saldo akhir 31 Desember; tidak perlu diketik ulang.">
      <ul className="note" style={{ margin: "0 0 12px", paddingLeft: 18, lineHeight: 1.6 }}>
        <li>Aset, utang, dan piutang terbawa sebagai saldo awal 1 Januari {N}. Pendapatan, beban, dan prive mulai dari 0; laba {Y} masuk ke ekuitas.</li>
        <li>Pengaturan (tarif PBJT, target, batas) dan teks CALK disalin dari {Y}.</li>
        <li>Data {Y} tetap bisa dilihat dan dikoreksi lewat pemilih tahun di kanan atas.</li>
        {decOpen && (
          <li>
            {Y} baru ditutup s.d. {info.latestClosedMonth ? BULAN[info.latestClosedMonth - 1] : "—"}. Input harian {N} bisa langsung jalan, tapi bulan di {N} baru bisa
            ditutup setelah Desember {Y} ditutup. Sampai saat itu saldo awal {N} masih sementara.
          </li>
        )}
      </ul>
      {!isOwner ? (
        <p className="note">Hanya owner yang bisa membuat tahun buku baru.</p>
      ) : !info.canStart ? (
        <p className="note">{info.reason}</p>
      ) : confirm ? (
        <div className="btns">
          <span className="note">Buat tahun buku {N} sekarang?</span>
          <button className="btn" disabled={busy} onClick={start}>{busy ? "Membuat…" : `Ya, buat tahun buku ${N}`}</button>
          <button className="btn ghost" disabled={busy} onClick={() => setConfirm(false)}>Batal</button>
        </div>
      ) : (
        <button className="btn" onClick={() => setConfirm(true)}>Buat tahun buku {N}</button>
      )}
    </Panel>
  );
}
