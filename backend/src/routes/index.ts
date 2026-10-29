// Semua route API + hak akses per peran (tabel "Pengguna & hak akses" di spesifikasi).
// Hak akses dicek DI SERVER untuk setiap permintaan.
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler as h } from "../utils/httpError";
import * as admin from "../controllers/adminController";
import * as ops from "../controllers/operationsController";
import * as report from "../controllers/reportController";
import { listParties } from "../services/masterDataService";

const OWNER = "OWNER" as const;
const ADMIN = "ADMIN" as const;
const KASIR = "KASIR" as const;
const staff = requireRole(OWNER, ADMIN);
const ownerOnly = requireRole(OWNER);

// ---------- auth (publik kecuali /me & 2FA) ----------
export const authRoutes = Router();
authRoutes.post("/login", h(admin.postLogin));
authRoutes.post("/pin", h(admin.postPinLogin));
authRoutes.post("/logout", h(admin.postLogout));
authRoutes.get("/me", requireAuth, h(admin.getMe));
authRoutes.post("/totp/setup", requireAuth, staff, h(admin.postTotpSetup));
authRoutes.post("/totp/confirm", requireAuth, staff, h(admin.postTotpConfirm));

// ---------- semua route di bawah wajib login ----------
export const apiRoutes = Router();
apiRoutes.use(requireAuth);

// Omzet harian: kasir boleh (aturan per field ada di dailySalesService).
apiRoutes.get("/daily-sales/kasir", requireRole(KASIR, ADMIN, OWNER), h(ops.getKasirOverview));
apiRoutes.get(
  "/daily-sales/staff",
  requireRole(KASIR, ADMIN, OWNER),
  h(async (_req, res) => {
    // Nama karyawan untuk input bon (kasir tidak punya akses ke modul Pihak).
    const rows = await listParties({ type: "KARYAWAN", activeOnly: true });
    res.json(rows.map((p) => ({ id: p.id, name: p.name })));
  }),
);
apiRoutes.get("/daily-sales", staff, h(ops.getDailyMonth));
apiRoutes.put("/daily-sales/:date", requireRole(KASIR, ADMIN, OWNER), h(ops.putDaily));
apiRoutes.post("/daily-sales/:date/verify", staff, h(ops.postDailyVerify));

// Jurnal: owner & admin input/ubah, hanya owner yang membatalkan.
apiRoutes.get("/journal", staff, h(ops.getJournal));
apiRoutes.get("/journal/:id", staff, h(ops.getJournalById));
apiRoutes.post("/journal", staff, h(ops.postJournal));
apiRoutes.put("/journal/:id", staff, h(ops.putJournal));
apiRoutes.post("/journal/:id/void", ownerOnly, h(ops.postJournalVoid));

// Aset tetap
apiRoutes.get("/assets", staff, h(ops.getAssets));
apiRoutes.post("/assets", staff, h(ops.postAsset));
apiRoutes.put("/assets/:id", staff, h(ops.putAsset));
apiRoutes.post("/assets/:id/void", ownerOnly, h(ops.postAssetVoid));

// Pihak & event
apiRoutes.get("/parties", staff, h(admin.getParties));
apiRoutes.post("/parties", staff, h(admin.postParty));
apiRoutes.put("/parties/:id", staff, h(admin.putParty));
apiRoutes.get("/events", staff, h(admin.getEventList));
apiRoutes.post("/events", staff, h(admin.postEvent));
apiRoutes.put("/events/:id/note", staff, h(admin.putEventNote));

// Daftar akun & pengaturan: admin lihat, owner ubah.
apiRoutes.get("/accounts", staff, h(admin.getAccounts));
apiRoutes.post("/accounts", ownerOnly, h(admin.postAccount));
apiRoutes.put("/accounts/:id", ownerOnly, h(admin.putAccount));
apiRoutes.get("/opening-details", staff, h(admin.getOpeningDetails));
apiRoutes.put("/accounts/:id/opening-details", ownerOnly, h(admin.putOpeningDetails));
apiRoutes.get("/settings", staff, h(admin.getSettings));
apiRoutes.put("/settings", ownerOnly, h(admin.putSettings));

// Tutup buku: admin input angka, hanya owner yang menutup & membuka kembali.
apiRoutes.get("/closing/preview", staff, h(ops.getClosingPreview));
apiRoutes.get("/closing/history", staff, h(ops.getClosingHistory));
apiRoutes.put("/closing/tax-filing/:month", staff, h(ops.putTaxFiling));
apiRoutes.put("/closing/ops-figures/:month", staff, h(ops.putOpsFigures));
apiRoutes.post("/closing/close", ownerOnly, h(ops.postClose));
apiRoutes.post("/closing/reopen", ownerOnly, h(ops.postReopen));

// Laporan (hanya baca)
apiRoutes.get("/reports/dashboard", staff, h(report.getDashboard));
apiRoutes.get("/reports/profit-loss", staff, h(report.getProfitLoss));
apiRoutes.get("/reports/balance-sheet", staff, h(report.getBalanceSheet));
apiRoutes.get("/reports/cash-flow", staff, h(report.getCashFlow));
apiRoutes.get("/reports/equity-changes", staff, h(report.getEquityChanges));
apiRoutes.get("/reports/trial-balance", staff, h(report.getTrialBalance));
apiRoutes.get("/reports/general-ledger", staff, h(report.getGeneralLedger));
apiRoutes.get("/reports/events", staff, h(report.getEvents));
apiRoutes.get("/reports/sales-recap", staff, h(report.getSalesRecap));
apiRoutes.get("/reports/tax", staff, h(report.getTax));
apiRoutes.get("/reports/notes", staff, h(report.getNotes));
apiRoutes.put("/reports/notes", ownerOnly, h(report.putNotes));

// Pengguna & riwayat perubahan: owner saja.
apiRoutes.get("/users", ownerOnly, h(admin.getUsers));
apiRoutes.post("/users", ownerOnly, h(admin.postUser));
apiRoutes.put("/users/:id", ownerOnly, h(admin.putUser));
apiRoutes.get("/audit-logs", ownerOnly, h(admin.getAuditLogs));
