import { useState } from "react";
import { masterApi, reportApi } from "../../api";
import { useApi } from "../../utils/useApi";
import { acct, num, periodLabel, tgl } from "../../utils/format";
import { ErrorBox, Field, Loading } from "../ui";
import AccountSelect from "../AccountSelect";
import ExportMenu from "../ExportMenu";

/** Buku besar: semua transaksi satu akun s.d. bulan tutup buku, dengan saldo berjalan. */
export default function GeneralLedger() {
  const [account, setAccount] = useState("Kas Bank");
  const accounts = useApi(() => masterApi.accounts(), []);
  const { data, loading, error, reload } = useApi(() => reportApi.generalLedger(account), [account]);

  return (
    <>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <Field label="Akun" className="w-full sm:w-80">
          <AccountSelect accounts={accounts.data ?? []} value={account} byName onChange={(v) => setAccount(String(v))} />
        </Field>
        {data && (
          <div className="flex flex-wrap gap-4 text-xs flex-1">
            <span>Saldo normal <b>{data.account.normal === "D" ? "Debet" : "Kredit"}</b></span>
            <span>Total debet <b className="tnum">{num(data.totalDebit)}</b></span>
            <span>Total kredit <b className="tnum">{num(data.totalCredit)}</b></span>
            <span>Saldo akhir <b className="tnum">{acct(data.closingBalance)}</b></span>
          </div>
        )}
        {data && (
          <ExportMenu
            build={() => ({
              filename: `buku-besar-${data.account.code}`,
              title: `Buku Besar ${data.account.code} ${data.account.name}`,
              period: periodLabel(data.year, data.closedMonth),
              columns: [
                { header: "Tanggal", key: "date" }, { header: "No. bukti", key: "voucherNo" }, { header: "Keterangan", key: "description" },
                { header: "Akun lawan", key: "counterAccount" }, { header: "Debet", key: "debit", numeric: true },
                { header: "Kredit", key: "credit", numeric: true }, { header: "Saldo", key: "balance", numeric: true },
              ],
              rows: [
                { date: "1 Jan", description: "Saldo awal", balance: acct(data.openingBalance) },
                ...data.lines.map((l) => ({
                  ...l, date: tgl(l.date), voucherNo: l.kind === "UMUM" ? l.voucherNo : "otomatis",
                  debit: l.debit ? num(l.debit) : "", credit: l.credit ? num(l.credit) : "", balance: acct(l.balance),
                })),
              ],
            })}
          />
        )}
      </div>
      {loading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} />
      ) : (
        <div className="bg-white rounded-xl border border-parang-divider overflow-x-auto">
          <table className="w-full text-sm tnum">
            <thead className="text-xs text-parang-subtle bg-parang-bg text-left">
              <tr>
                <th className="px-3 py-2">Tanggal</th><th className="px-3">No. bukti</th><th className="px-3">Keterangan</th>
                <th className="px-3">Akun lawan</th><th className="px-3 text-right">Debet</th><th className="px-3 text-right">Kredit</th><th className="px-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-parang-bg/60 font-semibold">
                <td className="px-3 py-1.5">1 Jan</td><td /><td className="px-3">Saldo awal</td><td /><td /><td />
                <td className="px-3 text-right">{acct(data.openingBalance)}</td>
              </tr>
              {data.lines.map((l, i) => (
                <tr key={i} className="border-t border-parang-divider/60">
                  <td className="px-3 py-1.5 whitespace-nowrap">{tgl(l.date)}</td>
                  <td className="px-3 font-mono text-xs">{l.kind === "UMUM" ? l.voucherNo : "otomatis"}</td>
                  <td className="px-3 min-w-[220px]">{l.description}</td>
                  <td className="px-3">{l.counterAccount}</td>
                  <td className="px-3 text-right">{l.debit ? num(l.debit) : ""}</td>
                  <td className="px-3 text-right">{l.credit ? num(l.credit) : ""}</td>
                  <td className="px-3 text-right">{acct(l.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
