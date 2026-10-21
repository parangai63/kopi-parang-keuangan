// Seed DATA DUMMY agar aplikasi bisa langsung dijalankan dan dicoba. Semua angka & nama fiktif.
//
//   npm run seed               # menolak jika database sudah berisi
//   SEED_RESET=1 npm run seed  # HAPUS semua data lalu isi ulang (hanya dev/staging!)
//
// Data dibuat deterministik (hasil sama tiap kali) dari 1 Jan 2026 sampai kemarin. Semua bulan sebelum
// bulan berjalan sudah "ditutup". Bulan berjalan sengaja dibuat belum rapi (setoran belum diisi, selisih
// tunai, EDC belum settle) supaya kalender omzet, tampilan kasir, dan wizard Tutup Buku ada isinya.
//
// Sebelum menulis ke database, data diuji dengan mesin hitung: 4 cek kesehatan harus hijau dan saldo kas
// tidak boleh negatif. Untuk data asli dari Excel pakai `npm run seed:legacy`.
import "dotenv/config";
import { PrismaClient, PartyType } from "@prisma/client";
import { compute } from "../src/engine/engine";
import type { EngineAsset, EngineDay, EngineInput, EngineJournal } from "../src/engine/types";
import { CHART_OF_ACCOUNTS } from "./chartOfAccounts";
import { createUsers, wipe } from "./seedShared";

const prisma = new PrismaClient();
const YEAR = 2026;
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const big = (n: number | null) => (n == null ? null : BigInt(n));
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (m: number, day: number) => `${YEAR}-${pad(m)}-${pad(day)}`;
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// PIN dummy — hanya untuk mencoba aplikasi. Ganti di menu Pengguna sebelum dipakai sungguhan.
const DEMO_USERS = [
  { name: "Owner", role: "OWNER" as const, pin: "111111" },
  { name: "Admin Keuangan", role: "ADMIN" as const, pin: "222222" },
  { name: "Kasir", role: "KASIR" as const, pin: "333333" },
];

const STAFF = ["Andi Pratama", "Siti Rahma", "Budi Santoso"];
const YANTOS = "Yantos Roastery";
const SUSU = "Toko Susu Makmur";
const KEMASAN = "UD Kemasan Jaya";
const EVENTS = [
  { name: "Event Festival Kopi Solo", month: 3, day: 14, revenue: 6_500_000, cost: 2_000_000 },
  { name: "Event Bazar Kampus", month: 6, day: 20, revenue: 4_200_000, cost: 1_500_000 },
  { name: "Event Live Music Malam Minggu", month: 9, day: 5, revenue: 2_800_000, cost: 900_000 },
];
const ASSETS: (EngineAsset & { month: number; day: number })[] = [
  { name: "Mesin espresso 2 group", acquiredOn: iso(2, 10), cost: 18_000_000, usefulLifeYears: 5, month: 2, day: 10 },
  { name: "Grinder kopi", acquiredOn: iso(3, 3), cost: 6_500_000, usefulLifeYears: 4, month: 3, day: 3 },
  { name: "Showcase kulkas", acquiredOn: iso(5, 15), cost: 5_200_000, usefulLifeYears: 4, month: 5, day: 15 },
];

// PRNG deterministik (mulberry32) supaya data dummy selalu sama.
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(2026);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const chance = (p: number) => rand() < p;

function yesterdayJakarta(): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  return new Date(new Date(`${today}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
}

interface DayRow extends EngineDay {
  verified: boolean;
}

function buildDays(end: string, closedMonth: number): DayRow[] {
  const base = [3.2, 2.4, 2.5, 2.6, 2.7, 3.3, 4.2].map((x) => x * 1e6); // Min..Sab
  const days: DayRow[] = [];
  const endDate = new Date(`${end}T00:00:00Z`);
  const dayBeforeLast = new Date(endDate.getTime() - 86400000).toISOString().slice(0, 10);
  for (let t = new Date(Date.UTC(YEAR, 0, 1)); t <= endDate; t = new Date(t.getTime() + 86400000)) {
    const date = t.toISOString().slice(0, 10);
    const m = Number(date.slice(5, 7));
    if (chance(0.02)) continue; // beberapa hari tidak ada data (libur / belum diisi)
    const total = roundTo(base[t.getUTCDay()] * (1 + 0.012 * (m - 1)) * between(0.82, 1.18), 50);
    const cashPos = roundTo(total * between(0.32, 0.44), 50);
    const edcPos = total - cashPos;
    const transactions = Math.round(total / between(38000, 46000));
    const itemsSold = Math.round(transactions * between(1.6, 1.9));
    const compliment = chance(0.12) ? roundTo(between(10000, 35000), 5000) : 0;
    const ownerBill = chance(0.04) ? roundTo(between(50000, 120000), 5000) : 0;
    const bons = chance(0.1) ? [{ party: STAFF[Math.floor(rand() * STAFF.length)], amount: roundTo(between(20000, 80000), 5000) }] : [];
    const bonTotal = bons.reduce((s, b) => s + b.amount, 0);

    const row: DayRow = {
      date, cashPos, edcPos, cashShift1: null, cashShift2: null, edcSettled: null,
      compliment, ownerBill, itemsSold, transactions, bons, verified: m <= closedMonth,
    };
    // Dua hari terakhir: baru ada angka POS (setoran H+1 & settlement EDC belum diisi).
    if (date !== end && date !== dayBeforeLast) {
      let unexplained = roundTo(between(-20000, 20000), 500);
      if (date === iso(10, 7)) unexplained = -85000; // contoh "Cek selisih tunai" di bulan berjalan
      const deposit = Math.max(0, cashPos - bonTotal - compliment - ownerBill - unexplained);
      const s1 = roundTo(deposit * 0.55, 1000);
      row.cashShift1 = s1;
      row.cashShift2 = deposit - s1;
      row.edcSettled = date === iso(10, 12) ? null : edcPos - Math.round(edcPos * 0.007); // MDR ±0,7%
    }
    days.push(row);
  }
  return days;
}

function buildJournal(days: DayRow[], end: string, closedMonth: number) {
  const out: (Omit<EngineJournal, "voucherNo"> & { eventName: string })[] = [];
  const endMonth = Number(end.slice(5, 7));
  let nota = 0;
  const add = (
    month: number, day: number, debit: string, credit: string, amount: number, description: string,
    o: { event?: string; party?: string; receipt?: boolean } = {},
  ) => {
    const date = iso(month, day);
    if (date > end || amount <= 0) return;
    out.push({
      date, debit, credit, amount, description, event: o.event ?? "", eventName: o.event ?? "", party: o.party ?? "",
      receiptNo: o.receipt ? `NB-${String(++nota).padStart(4, "0")}` : "",
    });
  };

  const pos = (m: number) => days.filter((x) => +x.date.slice(5, 7) === m).reduce((s, x) => s + (x.cashPos ?? 0) + (x.edcPos ?? 0), 0);
  const bonOf = (m: number) => days.filter((x) => +x.date.slice(5, 7) === m).reduce((s, x) => s + x.bons.reduce((a, b) => a + b.amount, 0), 0);
  const dataDays = (m: number) => days.filter((x) => +x.date.slice(5, 7) === m).length || 1;
  const dim = (m: number) => new Date(Date.UTC(YEAR, m, 0)).getUTCDate();

  for (let m = 1; m <= endMonth; m++) {
    const nm = BULAN[m - 1];
    const expected = (pos(m) / dataDays(m)) * dim(m); // omzet sebulan penuh (untuk bulan berjalan: proyeksi)
    const perBuy = (0.31 * expected) / 4;

    add(m, 1, "Biaya Sewa Tempat", "Kas Bank", 6_000_000, `Sewa tempat bulan ${nm}`);
    add(m, 3, "Kas Warung", "Kas Tunai", 1_000_000, "Isi ulang kas warung", {});
    add(m, 5, "Biaya Tagihan Bulanan", "Kas Bank", roundTo(between(2_300_000, 2_900_000), 1000), `Listrik, air, dan internet bulan ${nm}`);
    add(m, 10, "Biaya Marketing & Promosi", "Kas Bank", 1_200_000, `Iklan & promosi media sosial bulan ${nm}`);
    add(m, 11, "Biaya Penyajian", "Kas Tunai", roundTo(between(1_400_000, 1_800_000), 1000), "Cup, tutup, sedotan, kantong", { party: KEMASAN, receipt: true });
    add(m, 15, "Biaya Operasional Harian", "Kas Warung", 950_000, `Operasional harian bulan ${nm} (gas, es, kebersihan)`);
    add(m, 25, "Beban Gaji", "Kas Bank", 21_000_000, `Gaji karyawan bulan ${nm}`);
    add(m, 27, "Biaya Lainnya", "Kas Bank", 25_000, "Biaya administrasi bank");
    add(m, 28, "Prive", "Kas Bank", 5_000_000, `Setoran kepada owner bulan ${nm}`);
    if (m % 2 === 1) add(m, 12, "Beban Perlengkapan", "Kas Tunai", 450_000, "Perlengkapan kebersihan & ATK", { receipt: true });
    if ([2, 5, 8].includes(m)) add(m, 20, "Biaya Pemeliharaan", "Kas Tunai", 600_000, "Servis rutin mesin kopi", { receipt: true });
    if ([4, 8].includes(m)) add(m, 22, "Kas Bank", "Pendapatan Lainnya", 350_000, "Penjualan kardus & botol bekas");
    if (bonOf(m)) add(m, 26, "Kas Tunai", "Piutang Lainnya", bonOf(m), `Potong gaji untuk bon karyawan bulan ${nm}`);

    // Bahan baku: 4 pembelian per bulan. Yang ke-4 hutang ke Yantos, dibayar tanggal 8 bulan berikutnya.
    const buy = () => roundTo(perBuy * between(0.9, 1.1), 10000);
    add(m, 2, "Biaya Bahan Baku", "Kas Bank", buy(), "Biji kopi arabika & robusta", { party: YANTOS, receipt: true });
    add(m, 9, "Biaya Bahan Baku", "Kas Tunai", buy(), "Susu fresh milk, sirup, bahan makanan", { party: SUSU, receipt: true });
    add(m, 16, "Biaya Bahan Baku", "Kas Tunai", buy(), "Belanja pasar: es batu, buah, roti", { receipt: true });
    const credit = buy();
    add(m, 23, "Biaya Bahan Baku", "Utang Usaha Lancar", credit, "Biji kopi (hutang, jatuh tempo tgl 8)", { party: YANTOS, receipt: true });
    if (m > 1) {
      const prevCredit = out.filter((j) => j.credit === "Utang Usaha Lancar" && +j.date.slice(5, 7) === m - 1).reduce((s, j) => s + j.amount, 0);
      add(m, 8, "Utang Usaha Lancar", "Kas Bank", prevCredit, `Pelunasan hutang biji kopi bulan ${BULAN[m - 2]}`, { party: YANTOS });
    }

    // Setor tunai ke bank (pindah dana kas ke kas — tidak masuk arus kas).
    add(m, 14, "Kas Bank", "Kas Tunai", 7_000_000, "Setor tunai ke bank");
    add(m, 28, "Kas Bank", "Kas Tunai", 7_000_000, "Setor tunai ke bank");

    // PBJT bulan yang sudah ditutup dibayar tanggal 28 bulan yang sama (sama dengan data SSPD).
    if (m <= closedMonth) {
      const due = Math.round((pos(m) / 1.1) * 0.1);
      add(m, 28, "Pajak Restoran", "Kas Bank", due, `Setor PBJT bulan ${nm} (SSPD)`);
    }
  }
  for (const a of ASSETS) add(a.month, a.day, "Peralatan", "Kas Bank", a.cost, `Pembelian ${a.name}`, { receipt: true });
  for (const e of EVENTS) {
    add(e.month, e.day, "Kas Bank", "Pendapatan non Cafe", e.revenue, `Pendapatan ${e.name}`, { event: e.name });
    add(e.month, e.day, "Biaya Marketing & Promosi", "Kas Tunai", e.cost, `Biaya ${e.name}`, { event: e.name });
  }
  // Nomor bukti JU-0001 dst berurutan menurut tanggal.
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out.map((j, i) => ({ ...j, voucherNo: `JU-${String(i + 1).padStart(4, "0")}` }));
}

async function main() {
  if (process.env.SEED_RESET === "1") await wipe(prisma);
  if ((await prisma.account.count()) > 0) {
    console.log("Database sudah berisi data. Seed dibatalkan (pakai SEED_RESET=1 untuk mengisi ulang di dev).");
    return;
  }

  const end = yesterdayJakarta() < `${YEAR}-12-31` ? yesterdayJakarta() : `${YEAR}-12-31`;
  if (end < `${YEAR}-02-01`) throw new Error("Tanggal sistem tidak valid untuk membuat data dummy tahun 2026.");
  const closedMonth = Number(end.slice(5, 7)) - 1; // semua bulan sebelum bulan berjalan sudah ditutup

  // ---------- bangun data di memori & uji dengan mesin hitung SEBELUM menulis ke database ----------
  const days = buildDays(end, closedMonth);
  const journal = buildJournal(days, end, closedMonth);
  const pos = (m: number) => days.filter((x) => +x.date.slice(5, 7) === m).reduce((s, x) => s + (x.cashPos ?? 0) + (x.edcPos ?? 0), 0);
  const taxFilings = Object.fromEntries(
    Array.from({ length: closedMonth }, (_, i) => i + 1).map((m) => {
      const due = Math.round((pos(m) / 1.1) * 0.1);
      return [m, { reportedRevenue: pos(m), pbjtPaid: due }];
    }),
  );
  // Angka Parang-ops contoh untuk bulan terakhir yang ditutup (pembelian ±1% dari jurnal, stok akhir fiktif).
  const lastClosed = closedMonth;
  const financePurchases = journal
    .filter((j) => +j.date.slice(5, 7) === lastClosed && (j.debit === "Biaya Bahan Baku" || j.debit === "Biaya Penyajian"))
    .reduce((s, j) => s + j.amount, 0);
  const ops: EngineInput["ops"] = lastClosed >= 1
    ? { [lastClosed]: { stockValue: 9_400_000, purchasesTotal: roundTo(financePurchases * 1.012, 1000), salesTotal: Math.round(pos(lastClosed) * 0.995) } }
    : {};

  const input: EngineInput = {
    settings: {
      year: YEAR, closedMonth, pbjtRate: 0.1, priceIncludesTax: true, accruePbjt: true, cashDiffThreshold: 50000,
      opsPurchaseTolerancePct: 0.05, opsSalesTolerancePct: 0.02,
    },
    accounts: CHART_OF_ACCOUNTS.map((x) => ({ ...x, cashFlowLine: x.cashFlowLine })),
    daily: days,
    journal: journal.map(({ eventName: _e, ...j }) => j),
    assets: ASSETS.map(({ month: _m, day: _d, ...x }) => x),
    taxFilings: taxFilings as EngineInput["taxFilings"],
    ops,
  };
  const R = compute(input);
  const bad = R.checks.filter((c) => !c.ok);
  const cashMonths = R.cashFlow.slice(1).map((c) => c.closing);
  const negCash = (["Kas Tunai", "Kas Bank", "Kas Warung"] as const).filter((n) => R.closingBalance[n] < 0);
  if (bad.length || negCash.length || cashMonths.some((c) => c < 0)) {
    throw new Error(`Data dummy tidak lolos uji: ${JSON.stringify({ bad, negCash, cashMonths })}`);
  }

  // ---------- tulis ke database ----------
  const userIds = await createUsers(prisma, DEMO_USERS);

  await prisma.setting.create({ data: { fiscalYear: YEAR, closedMonth, businessName: "Kopi Parang" } });
  await prisma.account.createMany({
    data: CHART_OF_ACCOUNTS.map((x) => ({
      code: x.code, name: x.name, group: x.group, normalSide: x.normal, cashCategory: x.cashCategory,
      cashFlowLine: x.cashFlowLine, openingBalance: BigInt(x.openingBalance),
      description: x.code === "3101" ? "Saldo awal dihitung otomatis dari aset − liabilitas per 1 Januari." : null,
    })),
  });
  const accountId = new Map((await prisma.account.findMany()).map((x) => [x.name, x.id]));

  await prisma.party.createMany({
    data: [
      ...STAFF.map((name) => ({ name, type: PartyType.KARYAWAN })),
      ...[YANTOS, SUSU, KEMASAN].map((name) => ({ name, type: PartyType.SUPPLIER })),
    ],
  });
  const partyId = new Map((await prisma.party.findMany()).map((p) => [p.name, p.id]));

  await prisma.event.createMany({ data: EVENTS.map((e) => ({ name: e.name, startDate: d(iso(e.month, e.day)) })) });
  const eventId = new Map((await prisma.event.findMany()).map((e) => [e.name, e.id]));

  await prisma.journalEntry.createMany({
    data: journal.map((j) => ({
      voucherNo: j.voucherNo, date: d(j.date), description: j.description, receiptNo: j.receiptNo || null, kind: "UMUM" as const,
      eventId: j.eventName ? eventId.get(j.eventName) : null, partyId: j.party ? partyId.get(j.party) : null,
      createdById: userIds.ADMIN,
    })),
  });
  const entryId = new Map((await prisma.journalEntry.findMany({ select: { id: true, voucherNo: true } })).map((e) => [e.voucherNo, e.id]));
  await prisma.journalLine.createMany({
    data: journal.flatMap((j) => [
      { entryId: entryId.get(j.voucherNo)!, accountId: accountId.get(j.debit)!, debit: BigInt(j.amount), credit: 0n },
      { entryId: entryId.get(j.voucherNo)!, accountId: accountId.get(j.credit)!, debit: 0n, credit: BigInt(j.amount) },
    ]),
  });

  await prisma.dailySale.createMany({
    data: days.map((x) => ({
      date: d(x.date), cashPos: big(x.cashPos), edcPos: big(x.edcPos), cashShift1: big(x.cashShift1), cashShift2: big(x.cashShift2),
      edcSettled: big(x.edcSettled), compliment: big(x.compliment || null), ownerBill: big(x.ownerBill || null),
      itemsSold: x.itemsSold, transactions: x.transactions, createdById: userIds.KASIR,
      verifiedById: x.verified ? userIds.ADMIN : null, verifiedAt: x.verified ? d(x.date) : null,
    })),
  });
  const dayId = new Map((await prisma.dailySale.findMany({ select: { id: true, date: true } })).map((x) => [x.date.toISOString().slice(0, 10), x.id]));
  await prisma.dailyStaffBon.createMany({
    data: days.flatMap((x) => x.bons.map((b) => ({ dailySaleId: dayId.get(x.date)!, partyId: partyId.get(b.party)!, amount: BigInt(b.amount) }))),
  });

  await prisma.fixedAsset.createMany({
    data: ASSETS.map((x) => ({
      name: x.name, acquiredOn: d(x.acquiredOn), cost: BigInt(x.cost), usefulLifeYears: x.usefulLifeYears, accountId: accountId.get("Peralatan"),
      createdById: userIds.ADMIN,
    })),
  });
  await prisma.taxFiling.createMany({
    data: Object.entries(taxFilings).map(([m, f]) => ({
      year: YEAR, month: Number(m), reportedRevenue: BigInt(f.reportedRevenue), pbjtPaid: BigInt(f.pbjtPaid),
      sspdNo: `SSPD-${YEAR}-${pad(Number(m))}`, filedOn: d(iso(Number(m), 28)),
    })),
  });
  const o = ops[lastClosed];
  if (o) {
    await prisma.opsMonthlyFigure.create({
      data: {
        year: YEAR, month: lastClosed, stockValue: BigInt(o.stockValue!), purchasesTotal: BigInt(o.purchasesTotal!),
        salesTotal: BigInt(o.salesTotal!), note: "Angka contoh (dummy)", enteredById: userIds.ADMIN,
      },
    });
  }
  await prisma.periodClosing.createMany({
    data: Array.from({ length: closedMonth }, (_, i) => ({ year: YEAR, month: i + 1, closedById: userIds.OWNER, closedAt: d(iso(i + 1, 28)) })),
  });

  const T = R.profitLossTotal;
  console.log(
    `Seed dummy selesai: ${CHART_OF_ACCOUNTS.length} akun, ${journal.length} jurnal, ${days.length} hari omzet, ${ASSETS.length} aset, ` +
      `${STAFF.length + 3} pihak, ${EVENTS.length} event. Data s.d. ${end}, tutup buku s.d. bulan ${closedMonth}.`,
  );
  console.log(`Uji mesin: 4 cek kesehatan hijau · pendapatan bersih Rp${Math.round(T.netRevenue).toLocaleString("id-ID")} · laba bersih Rp${Math.round(T.netProfit).toLocaleString("id-ID")}`);
  console.log("\nAkun dummy (login pakai PIN):");
  for (const u of DEMO_USERS) console.log(`  ${u.name.padEnd(16)} ${u.role.padEnd(6)} PIN ${u.pin}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
