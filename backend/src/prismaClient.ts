import { PrismaClient } from "@prisma/client";

// Satu instance untuk seluruh aplikasi (hindari banyak koneksi saat hot-reload).
// Timeout transaksi dinaikkan seperti di Parang-ops: tutup buku menulis banyak baris
// dalam satu $transaction dan database produksi biasanya remote.
const prisma = new PrismaClient({
  transactionOptions: {
    maxWait: 10000,
    timeout: 20000,
  },
});

export default prisma;
