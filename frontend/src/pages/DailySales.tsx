import { useState } from "react";
import { dailyApi } from "../api";
import { useApi } from "../utils/useApi";
import { BLN3, BULAN, jt, pct, rp, tgl, todayJakarta } from "../utils/format";
import { ErrorBox, Loading, PageHeader, Panel, statusTone } from "../components/ui";
import DayForm from "../components/DayForm";
import { useAuth } from "../context/AuthContext";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/** Omzet harian untuk owner/admin: kalender bulanan dengan garis status + form per tanggal (vOmzet di rancangan original). */
export default function DailySalesPage() {
  const today = todayJakarta();
  const { user } = useAuth();
  const closed = user?.closedMonth ?? 0;
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [selected, setSelected] = useState<string | null>(null);
  const { data, loading, error, reload } = useApi(() => dailyApi.month(month), [month]);
  const staff = useApi(() => dailyApi.staff(), []);

  const pad = data ? (new Date(`${data.days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7 : 0;
  const sel = data?.days.find((d) => d.date === selected) ?? null;

  const pick = (date: string) => {
    setSelected(date);
    if (window.innerWidth < 900) requestAnimationFrame(() => document.getElementById("daypanel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <PageHeader
        title="Omzet harian"
        subtitle={data ? `${BULAN[month - 1]} ${data.year} · ${data.locked ? "bulan sudah ditutup, hanya bisa dilihat" : "bulan berjalan, bisa diisi"}` : BULAN[month - 1]}
      />
      <div className="months" role="group" aria-label="Bulan">
        {BLN3.map((b, i) => (
          <button
            key={b}
            aria-pressed={month === i + 1}
            className={i + 1 <= closed ? "locked" : ""}
            title={i + 1 <= closed ? "sudah ditutup" : ""}
            onClick={() => { setMonth(i + 1); setSelected(null); }}
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
          <div className="sumstrip">
            <span>Omzet tercatat (POS)<b>{rp(data.summary.totalPos)}</b></span>
            <span>Omzet bersih<b>{rp(data.summary.netRevenue)}</b></span>
            <span>Hari buka<b>{data.summary.openDays}</b></span>
            <span>Rata-rata / hari<b>{data.summary.avgPerDay ? rp(data.summary.avgPerDay) : "–"}</b></span>
            <span>Pencapaian target<b>{data.summary.netRevenue ? pct(data.summary.targetAchievement) : "–"}</b></span>
            <span>Perlu dicek<b className={data.summary.notOkDays ? "neg" : ""}>{data.summary.notOkDays} hari</b></span>
          </div>
          <div className="two">
            <Panel>
              <div className="cal">
                {WEEKDAYS.map((w) => <div key={w} className="wd">{w}</div>)}
                {Array.from({ length: pad }, (_, i) => <div key={`p${i}`} />)}
                {data.days.map((d) => {
                  const has = d.calc.totalPos > 0;
                  const cls = has ? `s-${statusTone(d.calc.status)}` : "empty";
                  return (
                    <button
                      key={d.date}
                      className={`day ${cls} ${selected === d.date ? "sel" : ""} ${d.date === today ? "today" : ""}`}
                      onClick={() => pick(d.date)}
                      aria-label={`${tgl(d.date)} ${d.calc.status || "kosong"}`}
                    >
                      <span className="n">{Number(d.date.slice(8))}</span>
                      {has && <span className="a">{jt(d.calc.netRevenue)}</span>}
                    </button>
                  );
                })}
              </div>
              <div className="cal-legend">
                <span><i style={{ background: "var(--good)" }} />OK</span>
                <span><i style={{ background: "var(--warn)" }} />Belum direalisasi / EDC belum settle</span>
                <span><i style={{ background: "var(--crit)" }} />Cek selisih tunai (&gt; {rp(data.cashDiffThreshold)})</span>
              </div>
            </Panel>
            <Panel id="daypanel">
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
                  <h2>Pilih tanggal</h2>
                  <p className="hint">Klik satu tanggal di kalender untuk melihat atau mengisi angka POS, setoran, dan penjelasan selisih.</p>
                </>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
