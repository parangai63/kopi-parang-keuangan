// Seed DATA ASLI: memindahkan data keuangan asli Excel v2 (via prototype/data.js) ke database.
// Untuk data dummy pakai `npm run seed` (seed.ts). Jalankan ini hanya di database yang aman untuk data asli.
//
//   npm run seed:legacy               # menolak jika database sudah berisi
//   SEED_RESET=1 npm run seed:legacy  # HAPUS semua data lalu isi ulang (hanya dev/staging!)
//
// Hanya jurnal UMUM yang diimpor. Jurnal OTOMATIS/PENYESUAIAN dibuat ulang oleh mesin.
// PIN owner/admin/kasir dibuat ACAK dan ditampilkan sekali di akhir — catat, lalu ganti di menu Pengguna.
import "dotenv/config";
import { randomInt } from "crypto";
import { PrismaClient, PartyType } from "@prisma/client";
import { legacyEngineInput, readRawData, LEGACY_BON_PARTY } from "./legacyData";
import { createUsers, wipe } from "./seedShared";

const prisma = new PrismaClient();
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const big = (n: number | null) => (n == null ? null : BigInt(n));

async function main() {
  if (process.env.SEED_RESET === "1") await wipe(prisma);
  if ((await prisma.account.count()) > 0) {
    console.log("Database sudah berisi data. Seed dibatalkan (pakai SEED_RESET=1 untuk mengisi ulang di dev).");
    return;
  }

  const raw = readRawData();
  const input = legacyEngineInput();
  const S = input.settings;

  // ---------- pengaturan ----------
  await prisma.setting.create({
    data: {
      fiscalYear: S.year, closedMonth: S.closedMonth, pbjtRate: S.pbjtRate, priceIncludesTax: S.priceIncludesTax,
      accruePbjt: S.accruePbjt, revenueTarget: BigInt(raw.settings.target), cashDiffThreshold: BigInt(S.cashDiffThreshold),
      opsPurchaseTolerancePct: S.opsPurchaseTolerancePct, opsSalesTolerancePct: S.opsSalesTolerancePct,
    },
  });

  // ---------- akun ----------
  await prisma.account.createMany({
    data: input.accounts.map((a) => ({
      code: a.code, name: a.name, group: a.group, normalSide: a.normal, cashCategory: a.cashCategory,
      cashFlowLine: a.cashFlowLine, openingBalance: BigInt(a.openingBalance),
      description: a.code === "3101" ? "Saldo awal dihitung otomatis dari aset − liabilitas per 1 Januari." : null,
    })),
  });
  const accountId = new Map((await prisma.account.findMany()).map((a) => [a.name, a.id]));

  // ---------- pihak & event (dari teks bebas di Excel) ----------
  const partyNames = [...new Set(input.journal.map((j) => j.party).filter(Boolean))].sort();
  await prisma.party.createMany({
    data: [
      ...partyNames.map((name) => ({ name, type: PartyType.LAINNYA })),
      { name: LEGACY_BON_PARTY, type: PartyType.KARYAWAN },
    ],
  });
  const partyId = new Map((await prisma.party.findMany()).map((p) => [p.name, p.id]));

  const eventFirst = new Map<string, string>();
  for (const j of input.journal) {
    if (j.event && (!eventFirst.has(j.event) || j.date < eventFirst.get(j.event)!)) eventFirst.set(j.event, j.date);
  }
  await prisma.event.createMany({ data: [...eventFirst].map(([name, first]) => ({ name, startDate: d(first) })) });
  const eventId = new Map((await prisma.event.findMany()).map((e) => [e.name, e.id]));

  // ---------- jurnal UMUM ----------
  await prisma.journalEntry.createMany({
    data: input.journal.map((j) => ({
      voucherNo: j.voucherNo, date: d(j.date), description: j.description, receiptNo: j.receiptNo || null,
      kind: "UMUM" as const, eventId: j.event ? eventId.get(j.event) : null, partyId: j.party ? partyId.get(j.party) : null,
    })),
  });
  const entryId = new Map((await prisma.journalEntry.findMany({ select: { id: true, voucherNo: true } })).map((e) => [e.voucherNo, e.id]));
  await prisma.journalLine.createMany({
    data: input.journal.flatMap((j) => {
      const deb = accountId.get(j.debit);
      const kre = accountId.get(j.credit);
      if (!deb || !kre) throw new Error(`Akun tidak dikenal di ${j.voucherNo}: ${j.debit} / ${j.credit}`);
      return [
        { entryId: entryId.get(j.voucherNo)!, accountId: deb, debit: BigInt(j.amount), credit: 0n },
        { entryId: entryId.get(j.voucherNo)!, accountId: kre, debit: 0n, credit: BigInt(j.amount) },
      ];
    }),
  });

  // ---------- omzet harian (hanya tanggal yang terisi) ----------
  const filled = input.daily.filter(
    (r) => [r.cashPos, r.edcPos, r.cashShift1, r.cashShift2, r.edcSettled, r.compliment, r.ownerBill, r.itemsSold, r.transactions].some((v) => v != null) || r.bons.length,
  );
  await prisma.dailySale.createMany({
    data: filled.map((r) => ({
      date: d(r.date), cashPos: big(r.cashPos), edcPos: big(r.edcPos), cashShift1: big(r.cashShift1),
      cashShift2: big(r.cashShift2), edcSettled: big(r.edcSettled), compliment: big(r.compliment),
      ownerBill: big(r.ownerBill), itemsSold: r.itemsSold, transactions: r.transactions,
    })),
  });
  const dayId = new Map((await prisma.dailySale.findMany({ select: { id: true, date: true } })).map((x) => [x.date.toISOString().slice(0, 10), x.id]));
  await prisma.dailyStaffBon.createMany({
    data: filled.flatMap((r) =>
      r.bons.map((b) => ({ dailySaleId: dayId.get(r.date)!, partyId: partyId.get(b.party)!, amount: BigInt(b.amount) })),
    ),
  });

  // ---------- aset tetap & SSPD ----------
  await prisma.fixedAsset.createMany({
    data: input.assets.map((a) => ({
      name: a.name, acquiredOn: d(a.acquiredOn), cost: BigInt(a.cost), usefulLifeYears: a.usefulLifeYears,
      accountId: accountId.get("Peralatan"),
    })),
  });
  await prisma.taxFiling.createMany({
    data: Object.entries(input.taxFilings).map(([m, f]) => ({ year: S.year, month: Number(m), pbjtPaid: big(f.pbjtPaid) })),
  });
  await prisma.periodClosing.createMany({
    data: Array.from({ length: S.closedMonth }, (_, i) => ({ year: S.year, month: i + 1, closedAt: new Date() })),
  });

  // ---------- pengguna awal (PIN acak) ----------
  const pin = () => String(randomInt(100000, 1000000));
  const users = [
    { name: "Owner", role: "OWNER" as const, pin: pin() },
    { name: "Admin Keuangan", role: "ADMIN" as const, pin: pin() },
    { name: "Kasir", role: "KASIR" as const, pin: pin() },
  ];
  await createUsers(prisma, users);
  console.log("\nAkun awal — PIN hanya ditampilkan sekali:");
  for (const u of users) console.log(`  ${u.name.padEnd(16)} (${u.role.padEnd(5)}) PIN ${u.pin}`);

  console.log(
    `Seed selesai: ${input.accounts.length} akun, ${input.journal.length} jurnal, ${filled.length} hari omzet, ` +
      `${input.assets.length} aset, ${partyNames.length + 1} pihak, ${eventFirst.size} event. Tutup buku s.d. bulan ${S.closedMonth}.`,
  );
  console.log("\nPihak dari kolom Sub Akun/Pihak Excel — samakan ejaannya dengan master Staff/Suppliers Parang-ops dan ganti jenisnya:");
  for (const n of partyNames) console.log(`  - ${n}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
