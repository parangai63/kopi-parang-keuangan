// Bagian yang dipakai bersama oleh seed.ts (data dummy) dan seed-legacy.ts (data asli Excel).
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

/** Hapus SEMUA data (urutan mengikuti foreign key). Hanya untuk dev/staging, lewat SEED_RESET=1. */
export async function wipe(prisma: PrismaClient) {
  console.log("SEED_RESET=1 → menghapus semua data…");
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.journalLine.deleteMany(),
    prisma.journalEntry.deleteMany(),
    prisma.dailyStaffBon.deleteMany(),
    prisma.dailySale.deleteMany(),
    prisma.openingBalanceDetail.deleteMany(),
    prisma.fixedAsset.deleteMany(),
    prisma.eventNote.deleteMany(),
    prisma.event.deleteMany(),
    prisma.party.deleteMany(),
    prisma.account.deleteMany(),
    prisma.taxFiling.deleteMany(),
    prisma.opsMonthlyFigure.deleteMany(),
    prisma.periodClosing.deleteMany(),
    prisma.setting.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export interface SeedUser {
  name: string;
  role: Role;
  pin: string;
}

/** Login sementara memakai PIN 6 digit untuk semua peran. Mengembalikan id per peran. */
export async function createUsers(prisma: PrismaClient, users: SeedUser[]): Promise<Record<Role, number>> {
  const ids = {} as Record<Role, number>;
  for (const u of users) {
    const row = await prisma.user.create({
      data: { name: u.name, role: u.role, pinHash: await bcrypt.hash(u.pin, 10) },
    });
    ids[u.role] = row.id;
  }
  return ids;
}
