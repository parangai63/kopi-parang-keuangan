import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
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
  const [showForm, setShowForm] = useState(false);
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

  return (
    <>
      <PageHeader title="Jurnal transaksi" subtitle={d ? `${num(d.total)} transaksi · total ${rp(d.totalAmount)}` : ""} />
      {showForm && accounts.data && (
        <JournalForm
          accounts={accounts.data}
          events={events.data ?? []}
          parties={parties.data ?? []}
          onCancel={() => setShowForm(false)}
          onSaved={(no) => { toast(`Tersimpan sebagai ${no}.`); setShowForm(false); list.reload(); }}
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
        {!showForm && <button className="btn" onClick={() => setShowForm(true)}>+ Transaksi baru</button>}
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
                {isOwner && <th />}
              </tr>
            </thead>
            <tbody>
              {d.rows.map((j) => (
                <tr key={j.voucherNo}>
                  <td className="mono acc">
                    {j.kind === "UMUM" ? j.voucherNo : <Pill tone={j.kind === "OTOMATIS" ? "auto" : "adj"}>{j.kind === "OTOMATIS" ? "otomatis" : "penyesuaian"}</Pill>}
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
                  {isOwner && (
                    <td className="act">
                      {j.kind === "UMUM" && j.id && (
                        <button className="iconbtn" title="Batalkan (soft delete)" aria-label={`Batalkan ${j.voucherNo}`} onClick={() => voidEntry(j.id!, j.voucherNo)}>
                          <Trash2 />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!d.rows.length && <tr><td colSpan={isOwner ? 7 : 6} className="empty-row">Tidak ada transaksi yang cocok dengan filter.</td></tr>}
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
