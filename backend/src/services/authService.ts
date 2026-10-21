// Login & pengguna. Owner/admin: email + kata sandi + 2FA (TOTP). Kasir: pilih nama + PIN 6 digit.
// Tabel pengguna & PIN SENDIRI — tidak disinkronkan dengan PIN staf Parang-ops.
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { Role, User } from "@prisma/client";
import prisma from "../prismaClient";
import { SessionUser } from "../middleware/auth";
import { HttpError, badRequest, notFound } from "../utils/httpError";
import { logAudit } from "./auditService";
import { getActiveSettings } from "./settingsService";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const ROLES = Object.values(Role) as string[];

const toSession = (u: User): SessionUser => ({ id: u.id, name: u.name, role: u.role });

async function assertNotLocked(u: User) {
  if (u.lockedUntil && u.lockedUntil > new Date()) {
    const mins = Math.ceil((u.lockedUntil.getTime() - Date.now()) / 60000);
    throw new HttpError(423, `Terlalu banyak percobaan salah. Coba lagi dalam ${mins} menit.`);
  }
}

async function registerFailure(u: User) {
  const failed = u.failedLoginCount + 1;
  await prisma.user.update({
    where: { id: u.id },
    data: failed >= MAX_FAILED
      ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) }
      : { failedLoginCount: failed },
  });
}

async function registerSuccess(u: User) {
  if (u.failedLoginCount || u.lockedUntil) {
    await prisma.user.update({ where: { id: u.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }
}

export async function loginWithPassword(email: string, password: string, totp?: string) {
  const u = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!u || !u.isActive || u.role === "KASIR" || !u.passwordHash) throw new HttpError(401, "Email atau kata sandi salah.");
  await assertNotLocked(u);
  if (!(await bcrypt.compare(password, u.passwordHash))) {
    await registerFailure(u);
    throw new HttpError(401, "Email atau kata sandi salah.");
  }
  if (u.totpEnabled && u.totpSecret) {
    if (!totp) return { needTotp: true as const };
    if (!authenticator.check(totp.replace(/\s/g, ""), u.totpSecret)) {
      await registerFailure(u);
      throw new HttpError(401, "Kode verifikasi salah.");
    }
  }
  await registerSuccess(u);
  return { user: toSession(u), totpEnabled: u.totpEnabled };
}

/** Daftar pengguna aktif untuk layar PIN (hanya id, nama, peran) — pola sama dengan PIN gate Parang-ops. */
export async function listLoginUsers() {
  const rows = await prisma.user.findMany({ where: { isActive: true, pinHash: { not: null } }, orderBy: [{ role: "asc" }, { name: "asc" }] });
  return rows.map((u) => ({ id: u.id, name: u.name, role: u.role }));
}

/** Login sementara untuk semua peran (owner, admin, kasir) memakai PIN 6 digit.
 * Login email + kata sandi + 2FA (loginWithPassword) tetap ada di kode untuk diaktifkan kembali. */
export async function loginWithPin(userId: number, pin: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || !u.isActive || !u.pinHash) throw new HttpError(401, "PIN salah.");
  await assertNotLocked(u);
  if (!/^\d{6}$/.test(pin) || !(await bcrypt.compare(pin, u.pinHash))) {
    await registerFailure(u);
    throw new HttpError(401, "PIN salah.");
  }
  await registerSuccess(u);
  return toSession(u);
}

export async function getMe(id: number) {
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) throw notFound("Pengguna tidak ditemukan.");
  // Tahun buku & bulan tutup buku ikut dikirim untuk chip "Tutup buku s.d." di header (semua peran).
  const s = await getActiveSettings();
  return { id: u.id, name: u.name, email: u.email, role: u.role, totpEnabled: u.totpEnabled, fiscalYear: s.fiscalYear, closedMonth: s.closedMonth };
}

/** Langkah 1 aktivasi 2FA: buat secret, tampilkan sebagai QR/otpauth URL di aplikasi authenticator. */
export async function startTotpSetup(user: SessionUser) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const secret = authenticator.generateSecret();
  await prisma.user.update({ where: { id: u.id }, data: { totpSecret: secret, totpEnabled: false } });
  return { secret, otpauthUrl: authenticator.keyuri(u.email ?? u.name, "Kopi Parang Keuangan", secret) };
}

/** Langkah 2: verifikasi kode pertama, lalu 2FA aktif. */
export async function confirmTotpSetup(user: SessionUser, code: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!u.totpSecret || !authenticator.check(code.replace(/\s/g, ""), u.totpSecret)) {
    throw badRequest("Kode verifikasi salah.");
  }
  await prisma.user.update({ where: { id: u.id }, data: { totpEnabled: true } });
  await logAudit(prisma, { userId: user.id, tableName: "users", recordId: u.id, action: "UPDATE", after: { totpEnabled: true } });
}

// ---------- kelola pengguna (owner) ----------
export async function listUsers() {
  const rows = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });
  return rows.map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, totpEnabled: u.totpEnabled,
    hasPin: Boolean(u.pinHash),
  }));
}

interface UserInput {
  name?: string;
  email?: string | null;
  role?: string;
  password?: string;
  pin?: string;
  isActive?: boolean;
}

export async function saveUser(actor: SessionUser, id: number | null, i: UserInput) {
  const before = id ? await prisma.user.findUnique({ where: { id } }) : null;
  if (id && !before) throw notFound("Pengguna tidak ditemukan.");
  const role = (i.role ?? before?.role) as Role;
  if (!ROLES.includes(role)) throw badRequest("Peran harus OWNER, ADMIN, atau KASIR.");
  const name = (i.name ?? before?.name ?? "").trim();
  if (!name) throw badRequest("Nama wajib diisi.");
  const email = i.email !== undefined ? i.email?.trim().toLowerCase() || null : before?.email ?? null;

  const data: Record<string, unknown> = { name, role, email };
  if (i.isActive !== undefined) {
    if (id === actor.id && !i.isActive) throw badRequest("Tidak bisa menonaktifkan akun sendiri.");
    data.isActive = Boolean(i.isActive);
  }
  // Sementara semua peran masuk dengan PIN 6 digit. Email & kata sandi opsional (untuk login 2FA nanti).
  if (i.pin !== undefined) {
    if (!/^\d{6}$/.test(i.pin)) throw badRequest("PIN harus 6 digit angka.");
    data.pinHash = await bcrypt.hash(i.pin, 10);
  } else if (!before?.pinHash) throw badRequest("PIN wajib diisi (6 digit angka).");
  if (i.password !== undefined && i.password !== "") {
    if (i.password.length < 10) throw badRequest("Kata sandi minimal 10 karakter.");
    if (!email) throw badRequest("Isi email jika memakai kata sandi.");
    data.passwordHash = await bcrypt.hash(i.password, 12);
  }

  // Selalu sisakan minimal satu owner aktif.
  if (before?.role === "OWNER" && (role !== "OWNER" || data.isActive === false)) {
    const others = await prisma.user.count({ where: { role: "OWNER", isActive: true, id: { not: before.id } } });
    if (!others) throw badRequest("Harus ada minimal satu owner aktif.");
  }

  const row = id
    ? await prisma.user.update({ where: { id }, data })
    : await prisma.user.create({ data: data as never });
  const strip = (u: User | null) => u && { id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive };
  await logAudit(prisma, {
    userId: actor.id, tableName: "users", recordId: row.id, action: id ? "UPDATE" : "CREATE",
    before: strip(before) ?? undefined, after: strip(row),
  });
  return row.id;
}

export async function listAuditLogs(opts: { table?: string; page?: number; pageSize?: number }) {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 50, 1), 200);
  const page = Math.max(opts.page ?? 1, 1);
  const where = opts.table ? { tableName: opts.table } : {};
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where, include: { user: { select: { name: true } } }, orderBy: { at: "desc" },
      skip: (page - 1) * pageSize, take: pageSize,
    }),
  ]);
  return {
    total, page, pageSize,
    rows: rows.map((r) => ({
      id: r.id, at: r.at, user: r.user?.name ?? null, tableName: r.tableName, recordId: r.recordId,
      action: r.action, before: r.before, after: r.after,
    })),
  };
}
