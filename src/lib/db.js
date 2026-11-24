// Koneksi Postgres (Supabase atau Postgres lain apapun lewat DATABASE_URL).
// Dipakai HANYA untuk menyimpan data yang TIDAK ada di Insightly: Meeting
// Summary (input manual konsultan) dan LOA (teks/link, untuk versi pertama).
// Data Lead sendiri TIDAK disimpan di sini -- selalu diambil langsung dari
// Insightly API tiap dashboard dibuka (keputusan eksplisit pemilik bisnis,
// 2026-11-24: "langsung dari Insightly tiap kali dashboard dibuka").

import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db] PERINGATAN: DATABASE_URL belum diisi di .env -- dashboard akan error saat mencoba baca/tulis Meeting Summary atau LOA. Leads dari Insightly tetap bisa tampil."
  );
}

const isLocalDb =
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1"));

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Supabase & kebanyakan hosting Postgres gratis mewajibkan SSL, tapi
      // pakai sertifikat yang tidak selalu ada di root CA bawaan Node --
      // rejectUnauthorized:false aman di sini karena koneksi tetap terenkripsi
      // (cuma verifikasi rantai sertifikat yang dilonggarkan), pola umum untuk
      // koneksi ke Supabase/Render Postgres dari luar. Untuk Postgres LOKAL
      // (localhost/127.0.0.1, dipakai saat development) SSL dimatikan total
      // karena Postgres lokal biasanya tidak diset up dengan SSL sama sekali.
      ssl: isLocalDb ? false : { rejectUnauthorized: false },
    })
  : null;

export async function query(text, params) {
  if (!pool) {
    throw new Error("DATABASE_URL belum dikonfigurasi -- lihat .env.example");
  }
  return pool.query(text, params);
}
