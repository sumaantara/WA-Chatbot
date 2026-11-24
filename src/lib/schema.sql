-- Skema database dashboard ONEderland. Hanya menyimpan data yang TIDAK ada
-- di Insightly (Meeting Summary & LOA) -- data Lead sendiri selalu diambil
-- langsung dari Insightly API, tidak diduplikasi di sini.
--
-- SEMUA tabel di schema `oneland_dashboard` TERPISAH (BUKAN `public`) --
-- project Supabase ini (HRM) dipakai bersama aplikasi lain (ada schema
-- `hrm` sendiri di project yang sama), jadi schema terpisah ini supaya
-- tabel dashboard leads TIDAK bentrok/tercampur dengan data HRM.
--
-- Dikaitkan ke Lead Insightly lewat insightly_lead_id (angka LEAD_ID dari
-- Insightly). email ikut disimpan sebagai cadangan tampilan/pencarian kalau
-- suatu saat Lead itu sudah di-convert/dihapus dari Insightly.

CREATE SCHEMA IF NOT EXISTS oneland_dashboard;

CREATE TABLE IF NOT EXISTS oneland_dashboard.meeting_summaries (
  id SERIAL PRIMARY KEY,
  insightly_lead_id BIGINT NOT NULL,
  lead_name TEXT,
  lead_email TEXT,
  meeting_date DATE,
  consultant_name TEXT,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_summaries_lead_id
  ON oneland_dashboard.meeting_summaries (insightly_lead_id);

CREATE TABLE IF NOT EXISTS oneland_dashboard.loa_documents (
  id SERIAL PRIMARY KEY,
  insightly_lead_id BIGINT NOT NULL,
  lead_name TEXT,
  lead_email TEXT,
  -- "text": LOA ditempel langsung sebagai teks ke kolom content.
  -- "link": LOA berupa link eksternal (mis. Google Doc / Claude artifact /
  --   PDF yang di-share tim lain) disimpan di kolom link_url.
  kind TEXT NOT NULL CHECK (kind IN ('text', 'link')),
  content TEXT,
  link_url TEXT,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loa_documents_lead_id
  ON oneland_dashboard.loa_documents (insightly_lead_id);
