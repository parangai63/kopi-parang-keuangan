import { PrismaClient } from "@prisma/client";

// Di Vercel (serverless) setiap request paralel bisa membuka instance baru, dan Prisma default membuka
// beberapa koneksi per instance. Pooler Supabase membatasi jumlah klien (session mode: 15), sehingga
// koneksi cepat habis ("EMAXCONNSESSION max clients reached") dan semua query gagal 500.
// Maka di Vercel: 1 koneksi per instance, dan pgbouncer=true bila memakai Transaction pooler (port 6543).
function serverlessUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw || !process.env.VERCEL) return undefined;
  const url = new URL(raw);
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
  if (url.port === "6543" && !url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
  return url.toString();
}

// Satu instance untuk seluruh aplikasi (hindari banyak koneksi saat hot-reload).
// Timeout transaksi dinaikkan seperti di Parang-ops: tutup buku menulis banyak baris
// dalam satu $transaction dan database produksi biasanya remote.
const prisma = new PrismaClient({
  datasourceUrl: serverlessUrl(),
  transactionOptions: {
    maxWait: 10000,
    timeout: 20000,
  },
});

export default prisma;
