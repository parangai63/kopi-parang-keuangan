import { AuditAction, Prisma } from "@prisma/client";
import prisma from "../prismaClient";
import { jsonSafe } from "../utils/money";

type Db = Prisma.TransactionClient | typeof prisma;

export interface AuditParams {
  userId?: number;
  tableName: string;
  recordId: string | number;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
}

/** Tulis satu baris audit_logs. Panggil dengan `tx` dari dalam $transaction agar atomik
 * dengan perubahan datanya. Tidak ada endpoint untuk mengubah/menghapus audit log. */
export async function logAudit(db: Db, p: AuditParams) {
  await db.auditLog.create({
    data: {
      userId: p.userId,
      tableName: p.tableName,
      recordId: String(p.recordId),
      action: p.action,
      before: p.before === undefined ? Prisma.JsonNull : (jsonSafe(p.before) as Prisma.InputJsonValue),
      after: p.after === undefined ? Prisma.JsonNull : (jsonSafe(p.after) as Prisma.InputJsonValue),
    },
  });
}
