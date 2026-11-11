import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { journalApi, masterApi } from "../api";
import { useApi } from "../utils/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { BULAN, num, rp, tgl } from "../utils/format";
import { ErrorBox, Field, Loading, PageHeader, Pill } from "../components/ui";
import ExportMenu from "../components/ExportMenu";
import JournalForm from "../components/JournalForm";
import AccountSelect from "../components/AccountSelect";

const PAGE_SIZE = 60;

async function fetchAllRows(f: Parameters<typeof journalApi.list>[0]) {
  const rows = [];
  for (let page = 1; ; page++) {
    const r = await journalApi.list({ ...f, page, pageSize: 500 });
    rows.push(...r.rows.map((j) => ({ ...j, amount: num(j.amount) })));
    if (page * 500 >= r.total) return rows;
  }
}

/** Jurnal transaksi — susunan sama dengan vJurnal() di rancangan original. */
export default function JournalPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ q: "", month: "" as number | "", account: "", event: "", kind: "" });
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  // null = form tertutup, "new" = transaksi baru, angka = id jurnal yang diedit.
  const [form, setForm] = useState<null | "new" | number>(null);
  const accounts = useApi(() => masterApi.accounts(), []);
  const events = useApi(() => masterApi.events(), []);
  const parties = useApi(() => masterApi.parties(), []);
  const list = useApi(() => journalApi.list({ ...f, page, pageSize: PAGE_SIZE }), [f, page]);

  // Debounce pencarian teks.
  useEffect(() => {
    const t = setTimeout(() => { setF((s) => ({ ...s, q })); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const setFilter = (patch: Partial<typeof f>) => { setF((s) => ({ ...s, ...patch })); setPage(1); };

  async function voidEntry(id: number, voucherNo: string) {
    if (!window.confirm(`Batalkan jurnal ${voucherNo}? Data tidak dihapus permanen dan tercatat di riwayat.`)) return;
    try {
      await journalApi.void(id);
      toast(`${voucherNo} dibatalkan.`);
      list.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gagal membatalkan.", "error");
    }
  }

  const d = list.data;
  const pages = d ? Math.ceil(d.total / PAGE_SIZE) : 1;
  const isOwner = user?.role === "OWNER";
  const canEdit = isOwner || user?.role === "ADMIN";
  // Sama dengan assertDateOpen di server: hanya tahun buku aktif dan bulan yang belum ditutup.
  const editable = (j: { kind: string; id?: number; year: number; month: number }) =>
    j.kind === "UMUM" && !!j.id && j.year === user?.fiscalYear && j.month > (user?.closedMonth ?? 0);

  // Baris yang barusan disimpan: disorot sebentar dan digulir ke tengah layar setelah daftar dimuat ulang.
  const [savedId, setSavedId] = useState<number | null>(null);
  useEffect(() => {
    if (savedId === null) return;
    const row = document.querySelector(`tr[data-id="${savedId}"]`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    else toast("Transaksi tersimpan, tapi tidak tampil di halaman/filter ini (mungkin tanggalnya berubah).");
    const t = setTimeout(() => setSavedId(null), 3000);
    return () => clearTimeout(t);
  }, [savedId]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(id: number) {
    setForm(id);
    setSavedId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    // Batal edit: kembali ke baris asal agar tidak perlu mencarinya lagi.
    if (typeof form === "number") {
      document.querySelector(`tr[data-id="${form}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setForm(null);
  }

  return (
    <>
      <PageHeader
        title="Jurnal transaksi"
        subtitle={d ? `${num(d.total)} transaksi · total ${rp(d.totalAmount)}` : ""}
        actions={
          <>
            {form === null && <button className="btn" onClick={() => setForm("new")}>+ Transaksi baru</button>}
            <ExportMenu
              disabled={!d}
              build={async () => ({
                filename: "jurnal",
                title: "Jurnal transaksi",
                period: f.month ? BULAN[(f.month as number) - 1] : "Semua bulan",
                columns: [
                  { header: "No. bukti", key: "voucherNo" }, { header: "Tanggal", key: "date" },
                  { header: "Debet", key: "debit" }, { header: "Kredit", key: "credit" },
                  { header: "Nominal", key: "amount", numeric: true }, { header: "Keterangan", key: "description" },
                  { header: "Event", key: "event" }, { header: "Pihak", key: "party" }, { header: "No. nota", key: "receiptNo" },
                ],
                // Seluruh hasil filter (semua halaman), bukan hanya halaman yang tampil.
                rows: await fetchAllRows(f),
              })}
            />
          </>
        }
      />
      {form !== null && accounts.data && (
        <JournalForm
          key={String(form)}
          accounts={accounts.data}
          events={events.data ?? []}
          parties={parties.data ?? []}
          editId={form === "new" ? undefined : form}
          onCancel={closeForm}
          onSaved={async (no, id) => {
            toast(form === "new" ? `Tersimpan sebagai ${no}.` : `${no} diperbarui.`);
            setForm(null);
            // Tunggu daftar terbaru dulu (useApi menampilkan data lama selama memuat), baru sorot barisnya.
            await list.reload();
            setSavedId(id);
          }}
        />
      )}
      <div className="toolbar">
        <Field label="Cari" className="q">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="keterangan, no. bukti, pihak, nota" />
        </Field>
        <Field label="Bulan">
          <select value={f.month} onChange={(e) => setFilter({ month: Number(e.target.value) || "" })}>
            <option value="">Semua bulan</option>
            {BULAN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
          </select>
        </Field>
        <Field label="Akun">
          <AccountSelect accounts={accounts.data ?? []} value={f.account} byName blank="Semua akun" onChange={(v) => setFilter({ account: String(v) })} />
        </Field>
        <Field label="Event">
          <select value={f.event} onChange={(e) => setFilter({ event: e.target.value })}>
            <option value="">Semua</option>
            {(events.data ?? []).map((ev) => <option key={ev.id} value={ev.name}>{ev.name}</option>)}
          </select>
        </Field>
        <Field label="Jenis">
          <select value={f.kind} onChange={(e) => setFilter({ kind: e.target.value })}>
            <option value="">Semua</option>
            <option value="UMUM">Input manual</option>
            <option value="AUTO">Otomatis sistem</option>
          </select>
        </Field>
      </div>
      {list.loading ? (
        <Loading />
      ) : list.error || !d ? (
        <ErrorBox message={list.error ?? "Gagal memuat."} onRetry={list.reload} />
      ) : (
        <div className="tw">
          <table className="t">
            <thead>
              <tr>
                <th>No. bukti</th><th>Tanggal</th><th>Debet</th><th>Kredit</th><th className="r">Nominal</th><th>Keterangan</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {d.rows.map((j) => (
                <tr
                  key={j.voucherNo}
                  data-id={j.id}
                  className={j.id && j.id === form ? "editing" : j.id && j.id === savedId ? "just-saved" : undefined}
                  aria-current={j.id && j.id === form ? "true" : undefined}
                >
                  <td className="mono acc">
                    {j.kind === "UMUM" ? (
                      <>
                        {j.voucherNo}
                        {j.id === form && <> <Pill tone="auto">sedang diedit</Pill></>}
                      </>
                    ) : <Pill tone={j.kind === "OTOMATIS" ? "auto" : "adj"}>{j.kind === "OTOMATIS" ? "otomatis" : "penyesuaian"}</Pill>}
                  </td>
                  <td className="acc">{tgl(j.date)}</td>
                  <td className="acc">{j.debit}</td>
                  <td className="acc">{j.credit}</td>
                  <td className="r">{num(j.amount)}</td>
                  <td className="ket">
                    {j.description}
                    {j.event && <> <Pill tone="tag">{j.event}</Pill></>}
                    {j.party && <span className="note"> · {j.party}</span>}
                    {j.receiptNo && <span className="note"> · nota {j.receiptNo}</span>}
                  </td>
                  {canEdit && (
                    <td className="act">
                      {editable(j) && (
                        <>
                          <button className="iconbtn" title="Ubah" aria-label={`Ubah ${j.voucherNo}`} onClick={() => startEdit(j.id!)}>
                            <Pencil />
                          </button>
                          {isOwner && (
                            <button className="iconbtn" title="Batalkan (soft delete)" aria-label={`Batalkan ${j.voucherNo}`} onClick={() => voidEntry(j.id!, j.voucherNo)}>
                              <Trash2 />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!d.rows.length && <tr><td colSpan={canEdit ? 7 : 6} className="empty-row">Tidak ada transaksi yang cocok dengan filter.</td></tr>}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="pager">
              <span>Halaman {page} dari {pages}</span>
              <div className="btns">
                <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button>
                <button className="btn ghost sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Berikutnya</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
