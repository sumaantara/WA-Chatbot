-- Skema database dashboard ONEderland. Hanya menyimpan data yang TIDAK ada
-- di Insightly (Meeting Summary & LOA) -- data Lead sendiri selalu diambil
-- langsung dari Insightly API, tidak diduplikasi di sini.
--
-- Project Supabase ini ("Chatbot", organisasi "Wanderlen") DIBUAT KHUSUS
-- untuk dashboard ini, tidak dipakai aplikasi lain -- jadi tabel langsung
-- di schema `public`, tidak perlu schema terpisah (beda dengan percobaan
-- awal yang sempat numpang di project Supabase "HRM" milik aplikasi lain).
--
-- Dikaitkan ke Lead Insightly lewat insightly_lead_id (angka LEAD_ID dari
-- Insightly). email ikut disimpan sebagai cadangan tampilan/pencarian kalau
-- suatu saat Lead itu sudah di-convert/dihapus dari Insightly.

CREATE TABLE IF NOT EXISTS meeting_summaries (
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
  ON meeting_summaries (insightly_lead_id);

CREATE TABLE IF NOT EXISTS loa_documents (
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
  ON loa_documents (insightly_lead_id);
