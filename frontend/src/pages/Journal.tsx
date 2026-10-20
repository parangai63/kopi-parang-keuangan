import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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

  return (
    <>
      <PageHeader
        title="Jurnal transaksi"
        subtitle={d ? `${num(d.total)} transaksi · total ${rp(d.totalAmount)}` : ""}
        actions={
          <>
            {!showForm && <button className="btn" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Transaksi baru</button>}
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
      {showForm && accounts.data && (
        <JournalForm
          accounts={accounts.data}
          events={events.data ?? []}
          parties={parties.data ?? []}
          onCancel={() => setShowForm(false)}
          onSaved={(no) => { toast(`Tersimpan sebagai ${no}.`); setShowForm(false); list.reload(); }}
        />
      )}
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <Field label="Cari" className="flex-1 min-w-[200px]">
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="keterangan, no. bukti, pihak, nota" />
        </Field>
        <Field label="Bulan">
          <select className="input" value={f.month} onChange={(e) => setFilter({ month: Number(e.target.value) || "" })}>
            <option value="">Semua bulan</option>
            {BULAN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
          </select>
        </Field>
        <Field label="Akun" className="min-w-[220px]">
          <AccountSelect accounts={accounts.data ?? []} value={f.account} byName blank="Semua akun" onChange={(v) => setFilter({ account: String(v) })} />
        </Field>
        <Field label="Event">
          <select className="input" value={f.event} onChange={(e) => setFilter({ event: e.target.value })}>
            <option value="">Semua</option>
            {(events.data ?? []).map((ev) => <option key={ev.id} value={ev.name}>{ev.name}</option>)}
          </select>
        </Field>
        <Field label="Jenis">
          <select className="input" value={f.kind} onChange={(e) => setFilter({ kind: e.target.value })}>
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
        <div className="bg-white rounded-xl border border-parang-divider overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-parang-subtle text-left bg-parang-bg">
              <tr>
                <th className="px-3 py-2">No. bukti</th><th className="px-3">Tanggal</th><th className="px-3">Debet</th>
                <th className="px-3">Kredit</th><th className="px-3 text-right">Nominal</th><th className="px-3">Keterangan</th><th />
              </tr>
            </thead>
            <tbody>
              {d.rows.map((j) => (
                <tr key={j.voucherNo} className="border-t border-parang-divider align-top">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                    {j.kind === "UMUM" ? j.voucherNo : <Pill tone={j.kind === "OTOMATIS" ? "info" : "wait"}>{j.kind === "OTOMATIS" ? "otomatis" : "penyesuaian"}</Pill>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{tgl(j.date)}</td>
                  <td className="px-3 py-2">{j.debit}</td>
                  <td className="px-3 py-2">{j.credit}</td>
                  <td className="px-3 py-2 text-right tnum">{num(j.amount)}</td>
                  <td className="px-3 py-2 min-w-[240px]">
                    {j.description}
                    {j.event && <> <Pill tone="info">{j.event}</Pill></>}
                    {j.party && <span className="text-xs text-parang-subtle"> · {j.party}</span>}
                    {j.receiptNo && <span className="text-xs text-parang-subtle"> · nota {j.receiptNo}</span>}
                  </td>
                  <td className="px-2 py-2">
                    {user?.role === "OWNER" && j.kind === "UMUM" && j.id && (
                      <button className="text-parang-subtle hover:text-accent-danger" title="Batalkan (soft delete)" onClick={() => voidEntry(j.id!, j.voucherNo)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!d.rows.length && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-parang-subtle">Tidak ada transaksi yang cocok dengan filter.</td></tr>
              )}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-parang-divider text-sm">
              <span className="text-parang-subtle">Halaman {page} dari {pages}</span>
              <div className="flex gap-2">
                <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button>
                <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Berikutnya</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
