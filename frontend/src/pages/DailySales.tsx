import { useState } from "react";
import { dailyApi } from "../api";
import { useApi } from "../utils/useApi";
import { BLN3, BULAN, jt, pct, rp, todayJakarta } from "../utils/format";
import { ErrorBox, Loading, PageHeader, Panel, statusTone } from "../components/ui";
import DayForm from "../components/DayForm";
import { useAuth } from "../context/AuthContext";

const TONE_BG: Record<string, string> = {
  ok: "bg-accent-successBg border-accent-success/30",
  bad: "bg-accent-dangerBg border-accent-danger/30",
  wait: "bg-accent-warningBg border-accent-warning/30",
  none: "bg-white border-parang-divider",
};

/** Omzet harian untuk owner/admin: kalender bulanan dengan warna status + form per tanggal. */
export default function DailySalesPage() {
  const today = todayJakarta();
  const { user } = useAuth();
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [selected, setSelected] = useState<string | null>(null);
  const { data, loading, error, reload } = useApi(() => dailyApi.month(month), [month]);
  const staff = useApi(() => dailyApi.staff(), []);

  const pad = data ? (new Date(`${data.days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7 : 0;
  const sel = data?.days.find((d) => d.date === selected) ?? null;

  return (
    <>
      <PageHeader
        title="Omzet harian"
        subtitle={data ? `${BULAN[month - 1]} ${data.year} · ${data.locked ? "bulan sudah ditutup, hanya bisa dilihat" : "bulan berjalan, bisa diisi"}` : ""}
      />
      <div className="flex gap-1 overflow-x-auto mb-4" role="group" aria-label="Bulan">
        {BLN3.map((b, i) => (
          <button
            key={b}
            aria-pressed={month === i + 1}
            onClick={() => { setMonth(i + 1); setSelected(null); }}
            className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${month === i + 1 ? "bg-parang-text text-white" : "bg-white border border-parang-divider text-parang-neutral"}`}
          >
            {b}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorBox message={error ?? "Gagal memuat."} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4 text-xs">
            {[
              ["Omzet tercatat (POS)", rp(data.summary.totalPos)],
              ["Omzet bersih", rp(data.summary.netRevenue)],
              ["Hari buka", String(data.summary.openDays)],
              ["Rata-rata / hari", data.summary.avgPerDay ? rp(data.summary.avgPerDay) : "–"],
              ["Pencapaian target", pct(data.summary.targetAchievement)],
              ["Perlu dicek", `${data.summary.notOkDays} hari`],
            ].map(([l, v]) => (
              <div key={l} className="bg-white border border-parang-divider rounded-lg px-3 py-2">
                <div className="text-parang-subtle">{l}</div>
                <b className={`text-sm tnum ${l === "Perlu dicek" && data.summary.notOkDays ? "text-accent-danger" : "text-parang-text"}`}>{v}</b>
              </div>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Panel>
              <div className="grid grid-cols-7 gap-1 text-center">
                {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((w) => (
                  <div key={w} className="text-[11px] text-parang-subtle py-1">{w}</div>
                ))}
                {Array.from({ length: pad }, (_, i) => <div key={`p${i}`} />)}
                {data.days.map((d) => {
                  const tone = d.calc.totalPos ? statusTone(d.calc.status) : "none";
                  return (
                    <button
                      key={d.date}
                      onClick={() => setSelected(d.date)}
                      aria-label={`${d.date} ${d.calc.status || "kosong"}`}
                      className={`rounded-md border min-h-[52px] p-1 text-left ${TONE_BG[tone]} ${selected === d.date ? "ring-2 ring-accent-primary" : ""} ${d.date === today ? "outline outline-1 outline-parang-text" : ""}`}
                    >
                      <span className="block text-xs font-semibold">{Number(d.date.slice(8))}</span>
                      {d.calc.totalPos > 0 && <span className="block text-[10px] tnum text-parang-neutral">{jt(d.calc.netRevenue)}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-parang-subtle">
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-accent-success" />OK</span>
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-accent-warning" />Belum direalisasi / EDC belum settle</span>
                <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-accent-danger" />Cek selisih tunai (&gt; {rp(data.cashDiffThreshold)})</span>
              </div>
            </Panel>
            <Panel>
              {sel ? (
                <DayForm
                  key={sel.date}
                  day={sel}
                  locked={data.locked || sel.date > today}
                  threshold={data.cashDiffThreshold}
                  staff={staff.data ?? []}
                  canVerify={user?.role !== "KASIR"}
                  onSaved={reload}
                  onClose={() => setSelected(null)}
                />
              ) : (
                <>
                  <h2 className="font-semibold">Pilih tanggal</h2>
                  <p className="text-sm text-parang-subtle mt-1">Klik satu tanggal di kalender untuk melihat atau mengisi angka POS, setoran, dan penjelasan selisih.</p>
                </>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
