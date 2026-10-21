import { useState } from "react";
import { masterApi, reportApi } from "../../api";
import { useApi } from "../../utils/useApi";
import { acct, num, periodLabel, tgl } from "../../utils/format";
import { ErrorBox, Field, Loading } from "../ui";
import AccountSelect from "../AccountSelect";
import ExportMenu from "../ExportMenu";

/** Buku besar: semua transaksi satu akun s.d. bulan tutup buku, dengan saldo berjalan (repBB di rancangan original). */
export default function GeneralLedger() {
  const [account, setAccount] = useState("Kas Bank");
  const accounts = useApi(() => masterApi.accounts(), []);
  const { data, loading, error, reload } = useApi(() => reportApi.generalLedger(account), [account]);

  return (
    <>
      <div className="toolbar">
        <Field label="Akun" className="q">
          <AccountSelect accounts={accounts.data ?? []} value={account} byName onChange={(v) => setAccount(String(v))} />
        </Field>
        {data && (
          <div className="sumstrip" style={{ margin: 0 }}>
            <span>Saldo normal<b>{data.account.normal === "D" ? "Debet" : "Kredit"}</b></span>
            <span>Total debet<b>{num(data.totalDebit)}</b></span>
            <span>Total kredit<b>{num(data.totalCredit)}</b></span>
            <span>Saldo akhir<b>{acct(data.closingBalance)}</b></span>
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
        <div className="tw">
          <table className="t rep">
            <thead>
              <tr>
                <th>Tanggal</th><th>No. bukti</th><th>Keterangan</th><th>Akun lawan</th>
                <th className="r">Debet</th><th className="r">Kredit</th><th className="r">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="h">
                <td>1 Jan</td><td /><td>Saldo awal</td><td /><td /><td />
                <td className="r">{acct(data.openingBalance)}</td>
              </tr>
              {data.lines.map((l, i) => (
                <tr key={i}>
                  <td className="acc">{tgl(l.date)}</td>
                  <td className="mono acc">{l.kind === "UMUM" ? l.voucherNo : "otomatis"}</td>
                  <td className="ket">{l.description}</td>
                  <td className="acc">{l.counterAccount}</td>
                  <td className="r">{l.debit ? num(l.debit) : ""}</td>
                  <td className="r">{l.credit ? num(l.credit) : ""}</td>
                  <td className="r">{acct(l.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
