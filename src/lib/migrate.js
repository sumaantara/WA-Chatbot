// Jalankan sekali setelah DATABASE_URL diisi (`npm run db:migrate`) untuk
// membuat tabel yang dibutuhkan dashboard. Aman dijalankan berkali-kali
// (semua statement pakai IF NOT EXISTS).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!pool) {
    console.error("DATABASE_URL belum diisi di .env -- tidak bisa migrate. Lihat .env.example.");
    process.exit(1);
  }
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query(sql);
  console.log("Migrasi database selesai -- tabel meeting_summaries & loa_documents siap dipakai.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migrasi gagal:", err.message);
  process.exit(1);
});
