import { BLN3, BULAN, rp } from "../utils/format";

/** Grafik batang pendapatan bersih vs laba bersih per bulan (SVG, tanpa library). */
export default function MonthlyChart({ data }: { data: { month: number; netRevenue: number; netProfit: number }[] }) {
  const W = 720, H = 280, L = 56, R = 12, T = 14, Bt = 30;
  const step = 20e6;
  const max = Math.ceil(Math.max(...data.map((d) => d.netRevenue), 0) / step) * step || step;
  const min = Math.floor(Math.min(...data.map((d) => d.netProfit), 0) / step) * step;
  const y = (v: number) => T + ((max - v) / (max - min)) * (H - T - Bt);
  const bw = (W - L - R) / Math.max(data.length, 1);
  const bar = Math.min(18, bw * 0.3);
  const grid: number[] = [];
  for (let v = min; v <= max; v += step) grid.push(v);

  return (
    <div>
      <div className="flex flex-wrap gap-4 text-xs text-parang-subtle mb-2">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-accent-primary" />Pendapatan bersih</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-accent-success" />Laba bersih</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-accent-danger" />Rugi bersih</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pendapatan bersih dan laba bersih per bulan" className="w-full h-auto">
        {grid.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? "#9CA3AF" : "#E5E7EB"} strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#6B7280">{v === 0 ? "0" : `${v / 1e6} jt`}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = L + bw * i + bw / 2;
          const y0 = y(0), yn = y(d.netRevenue), yp = y(d.netProfit);
          return (
            <g key={d.month}>
              <rect x={cx - bar - 1} y={yn} width={bar} height={Math.max(0, y0 - yn)} rx={2} fill="#2563EB">
                <title>{`${BULAN[d.month - 1]}: pendapatan bersih ${rp(d.netRevenue)}`}</title>
              </rect>
              <rect x={cx + 1} y={Math.min(yp, y0)} width={bar} height={Math.abs(y0 - yp) || 1} rx={2} fill={d.netProfit < 0 ? "#DC2626" : "#15803D"}>
                <title>{`${BULAN[d.month - 1]}: laba bersih ${rp(d.netProfit)}`}</title>
              </rect>
              <text x={cx} y={H - 10} textAnchor="middle" fontSize="11.5" fill="#6B7280">{BLN3[d.month - 1]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
