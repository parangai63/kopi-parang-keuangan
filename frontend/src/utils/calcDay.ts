// Pratinjau hitungan omzet harian di browser selagi admin mengetik.
// HARUS sama dengan backend/src/engine/engine.ts → calcDay (spesifikasi Logika 1).
// Angka resmi tetap dihitung server; ini hanya pratinjau.
import type { DayCalc, DayStatus } from "../types";

interface Input {
  cashPos: number | null;
  edcPos: number | null;
  cashShift1: number | null;
  cashShift2: number | null;
  edcSettled: number | null;
  compliment: number | null;
  ownerBill: number | null;
  transactions: number | null;
  bonTotal: number;
}

const N = (v: number | null | undefined) => (typeof v === "number" && isFinite(v) ? v : 0);

export function calcDay(r: Input, threshold: number): DayCalc {
  const totalPos = N(r.cashPos) + N(r.edcPos);
  const noShift = r.cashShift1 == null && r.cashShift2 == null;
  const cashDiff = noShift ? 0 : N(r.cashPos) - N(r.cashShift1) - N(r.cashShift2);
  const edcDiff = r.edcSettled == null ? 0 : N(r.edcPos) - N(r.edcSettled);
  const unexplainedCash = noShift ? 0 : cashDiff - r.bonTotal - N(r.compliment) - N(r.ownerBill);
  const diffCost = edcDiff + unexplainedCash;
  const netRevenue = totalPos - diffCost;
  let status: DayStatus;
  if (totalPos === 0) status = "";
  else if (N(r.cashPos) > 0 && noShift) status = "Belum direalisasi";
  else if (N(r.edcPos) > 0 && r.edcSettled == null) status = "EDC belum settle";
  else if (Math.abs(unexplainedCash) > threshold) status = "Cek selisih tunai";
  else status = "OK";
  return {
    staffBon: r.bonTotal, totalPos, totalRealized: N(r.cashShift1) + N(r.cashShift2) + N(r.edcSettled),
    cashDiff, edcDiff, unexplainedCash, diffCost, netRevenue, status,
    avgTicket: N(r.transactions) ? netRevenue / N(r.transactions) : null,
  };
}
