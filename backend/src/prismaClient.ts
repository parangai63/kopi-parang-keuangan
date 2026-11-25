import { PrismaClient } from "@prisma/client";

// Di Vercel (serverless) setiap request paralel bisa membuka instance baru, dan Prisma default membuka
// beberapa koneksi per instance. Pooler Supabase membatasi jumlah klien (session mode: 15), sehingga
// koneksi cepat habis ("EMAXCONNSESSION max clients reached") dan semua query gagal 500.
// Maka di Vercel: 1 koneksi per instance. Di mana pun: pgbouncer=true bila memakai Transaction pooler
// (port 6543) — tanpa itu Prisma error "prepared statement ... does not exist / already exists".
function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  const url = new URL(raw);
  let changed = false;
  if (process.env.VERCEL && !url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "1");
    changed = true;
  }
  if (url.port === "6543" && !url.searchParams.has("pgbouncer")) {
    url.searchParams.set("pgbouncer", "true");
    changed = true;
  }
  return changed ? url.toString() : undefined;
}

// Satu instance untuk seluruh aplikasi (hindari banyak koneksi saat hot-reload).
// Timeout transaksi dinaikkan seperti di Parang-ops: tutup buku menulis banyak baris
// dalam satu $transaction dan database produksi biasanya remote.
const prisma = new PrismaClient({
  datasourceUrl: datasourceUrl(),
  transactionOptions: {
    maxWait: 10000,
    timeout: 20000,
  },
});

export default prisma;
