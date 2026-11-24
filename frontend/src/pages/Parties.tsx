import { FormEvent, useState } from "react";
import { masterApi } from "../api";
import { useApi } from "../utils/useApi";
import { useToast } from "../context/ToastContext";
import { ErrorBox, Field, Loading, PageHeader, Panel, Pill } from "../components/ui";
import type { Party, PartyType } from "../types";
import Select from "../components/Select";
import { PARTY_TYPE_OPTIONS, PARTY_TYPES } from "../utils/options";

const TYPES = PARTY_TYPES;

/** Karyawan & supplier. Ejaan nama HARUS sama dengan master Staff/Suppliers di Parang-ops
 * (tidak ada ID bersama — yang disamakan hanya nama). */
export default function PartiesPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => masterApi.parties(), []);
  const [name, setName] = useState("");
  const [type, setType] = useState<PartyType>("KARYAWAN");
  const [filter, setFilter] = useState<PartyType | "">("");

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await masterApi.createParty({ name, type });
      toast(`"${name}" ditambahkan.`);
      setName("");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal.", "error");
    }
  }

  async function update(p: Party, patch: Partial<Party>) {
    try {
      await masterApi.updateParty(p.id, patch);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal.", "error");
    }
  }

  const rows = (data ?? []).filter((p) => !filter || p.type === filter);

  return (
    <>
      <PageHeader title="Pihak" subtitle="Karyawan dan supplier, dipakai untuk bon karyawan, utang/piutang, dan pihak di jurnal." />
      <div className="grid">
        <Panel title="Tambah pihak" hint="Salin ejaan nama persis dari master Staff / Suppliers di Parang-ops. Tidak ada ID bersama, yang disamakan hanya nama.">
          <form className="toolbar" style={{ marginBottom: 0 }} onSubmit={add}>
            <Field label="Nama" className="q"><input autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Jenis">
              <Select value={type} options={PARTY_TYPE_OPTIONS} onChange={(v) => v && setType(v)} ariaLabel="Jenis pihak" />
            </Field>
            <button className="btn" type="submit" disabled={!name.trim()}>Tambah</button>
          </form>
        </Panel>
        <div>
          <div className="chips" role="group" aria-label="Jenis pihak">
            {[["", "Semua"] as const, ...TYPES].map(([k, l]) => (
              <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          {loading ? (
            <Loading />
          ) : error || !data ? (
            <ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} />
          ) : (
            <div className="tw">
              <table className="t">
                <thead><tr><th>Nama</th><th>Jenis</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>
                        <Select size="mini" value={p.type} options={PARTY_TYPE_OPTIONS} onChange={(v) => v && update(p, { type: v })} ariaLabel={`Jenis ${p.name}`} />
                      </td>
                      <td>{p.isActive ? <Pill tone="ok">aktif</Pill> : <Pill>nonaktif</Pill>}</td>
                      <td className="act">
                        <button className="linkbtn" onClick={() => update(p, { isActive: !p.isActive })}>{p.isActive ? "Nonaktifkan" : "Aktifkan"}</button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={4} className="empty-row">Belum ada pihak.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
