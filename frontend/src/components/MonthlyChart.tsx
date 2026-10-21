import { BLN3, BULAN, rp } from "../utils/format";

/** Grafik batang pendapatan bersih vs laba bersih per bulan (SVG, tanpa library) — sama dengan chart() di prototipe. */
export default function MonthlyChart({ data }: { data: { month: number; netRevenue: number; netProfit: number }[] }) {
  const W = 720, H = 300, L = 56, R = 12, T = 14, Bt = 30;
  const step = 20e6;
  const max = Math.ceil(Math.max(...data.map((d) => d.netRevenue), 0) / step) * step || step;
  const min = Math.floor(Math.min(...data.map((d) => d.netProfit), 0) / step) * step;
  const y = (v: number) => T + ((max - v) / (max - min)) * (H - T - Bt);
  const bw = (W - L - R) / Math.max(data.length, 1);
  const bar = Math.min(18, bw * 0.3);
  const grid: number[] = [];
  for (let v = min; v <= max; v += step) grid.push(v);

  return (
    <>
      <div className="legend">
        <span><i style={{ background: "var(--accent)" }} />Pendapatan bersih</span>
        <span><i style={{ background: "var(--good)" }} />Laba bersih</span>
        <span><i style={{ background: "var(--crit)" }} />Rugi bersih</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pendapatan bersih dan laba bersih per bulan">
        {grid.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--faint)" : "var(--line)"} strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{v === 0 ? "0" : `${v / 1e6} jt`}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = L + bw * i + bw / 2;
          const y0 = y(0), yn = y(d.netRevenue), yp = y(d.netProfit);
          return (
            <g key={d.month}>
              <rect x={cx - bar - 1} y={yn} width={bar} height={Math.max(0, y0 - yn)} rx={2} fill="var(--accent)">
                <title>{`${BULAN[d.month - 1]}: pendapatan bersih ${rp(d.netRevenue)}`}</title>
              </rect>
              <rect x={cx + 1} y={Math.min(yp, y0)} width={bar} height={Math.abs(y0 - yp) || 1} rx={2} fill={d.netProfit < 0 ? "var(--crit)" : "var(--good)"}>
                <title>{`${BULAN[d.month - 1]}: laba bersih ${rp(d.netProfit)}`}</title>
              </rect>
              <text x={cx} y={H - 10} textAnchor="middle" fontSize="11.5" fill="var(--muted)">{BLN3[d.month - 1]}</text>
            </g>
          );
        })}
      </svg>
    </>
  );
}
