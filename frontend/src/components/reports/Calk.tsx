import { useState } from "react";
import { Trash2 } from "lucide-react";
import { reportApi } from "../../api";
import { useApi } from "../../utils/useApi";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { periodLabel } from "../../utils/format";
import { ErrorBox, Field, Loading } from "../ui";
import ExportMenu from "../ExportMenu";
import type { ExportSpec } from "../../utils/exportTable";
import type { NoteSection, NotesReport } from "../../types";

/** CALK sebagai spesifikasi ekspor: judul bagian (tebal) lalu paragraf-paragrafnya. Dipakai juga oleh paket laporan. */
export function calkExport(n: NotesReport): ExportSpec {
  const rows: Record<string, unknown>[] = [];
  n.sections.forEach((s, i) => {
    rows.push({ no: String(i + 1), text: s.title, __style: "h" });
    for (const p of s.rendered.split("\n").filter(Boolean)) rows.push({ no: "", text: p });
  });
  return {
    filename: "calk", title: "Catatan atas Laporan Keuangan", period: periodLabel(n.year, n.closedMonth),
    columns: [{ header: "No", key: "no" }, { header: "Catatan", key: "text" }], rows,
  };
}

/** Sheet CALK: teks per bagian, angka terisi otomatis dari laporan. Owner bisa mengubah teks & placeholder. */
export default function Calk() {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = user?.role === "OWNER";
  const { data, loading, error, reload } = useApi(() => reportApi.notes(), []);
  const [draft, setDraft] = useState<NoteSection[] | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} />;

  async function save(sections: NoteSection[] | null) {
    if (sections === null && !window.confirm("Kembalikan CALK ke teks bawaan (sama dengan Excel v2)? Teks yang sudah diubah akan hilang.")) return;
    setBusy(true);
    try {
      await reportApi.saveNotes(sections);
      toast(sections ? "CALK tersimpan." : "CALK kembali ke teks bawaan.");
      setDraft(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal menyimpan.", "error");
    } finally {
      setBusy(false);
    }
  }

  const copy = (key: string) => {
    navigator.clipboard?.writeText(`{${key}}`).then(() => toast(`{${key}} disalin — tempel di teks.`)).catch(() => undefined);
  };

  if (draft) {
    const set = (i: number, patch: Partial<NoteSection>) => setDraft(draft.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    return (
      <div className="two">
        <div className="grid">
          {draft.map((s, i) => (
            <div key={i}>
              <div className="toolbar" style={{ marginBottom: 6 }}>
                <Field label={`Bagian ${i + 1}`} className="q">
                  <input value={s.title} onChange={(e) => set(i, { title: e.target.value })} />
                </Field>
                <button type="button" className="iconbtn" title="Hapus bagian" aria-label={`Hapus bagian ${i + 1}`} onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                  <Trash2 />
                </button>
              </div>
              <Field label="Isi">
                <textarea rows={Math.max(3, s.body.split("\n").length + 1)} value={s.body} onChange={(e) => set(i, { body: e.target.value })} />
              </Field>
            </div>
          ))}
          <div className="btns">
            <button type="button" className="linkbtn" onClick={() => setDraft([...draft, { title: "", body: "" }])}>+ Tambah bagian</button>
          </div>
          <div className="btns">
            <button className="btn" disabled={busy} onClick={() => save(draft)}>Simpan CALK</button>
            <button className="btn ghost" onClick={() => setDraft(null)}>Batal</button>
          </div>
        </div>
        <div>
          <p className="note">
            Angka diisi otomatis dari laporan. Klik nama di bawah untuk menyalin, lalu tempel di teks (misal <span className="mono">{"{kas_total}"}</span>).
            Satu baris = satu paragraf.
          </p>
          <div className="tw">
            <table className="t">
              <thead><tr><th>Isian</th><th className="r">Nilai sekarang</th></tr></thead>
              <tbody>
                {data.variables.map((v) => (
                  <tr key={v.key}>
                    <td>
                      <button className="linkbtn mono" onClick={() => copy(v.key)}>{`{${v.key}}`}</button>
                      <div className="note">{v.label}</div>
                    </td>
                    <td className="r">{v.value || <span className="note">(kosong)</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rep-bar">
        <div className="rep-head">KOPI PARANG · {periodLabel(data.year, data.closedMonth)}</div>
        <div className="btns" style={{ margin: 0 }}>
          {canEdit && <button className="btn ghost" onClick={() => setDraft(data.sections.map(({ title, body }) => ({ title, body })))}>Ubah teks</button>}
          {canEdit && !data.isDefault && <button className="btn ghost" disabled={busy} onClick={() => save(null)}>Teks bawaan</button>}
          <ExportMenu build={() => calkExport(data)} />
        </div>
      </div>
      <ol className="calk">
        {data.sections.map((s, i) => (
          <li key={i}>
            <b>{s.title}</b>
            {s.rendered.split("\n").filter(Boolean).map((p, j) => <p key={j}>{p}</p>)}
          </li>
        ))}
      </ol>
      {!data.closedMonth && <p className="note">Belum ada bulan yang ditutup; angka di atas belum final.</p>}
    </>
  );
}
