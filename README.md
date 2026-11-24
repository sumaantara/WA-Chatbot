# ONEderland Leads Dashboard

Dashboard internal untuk konsultan ONEderland Consulting:
- **Leads** — diambil LANGSUNG dari Insightly (CRM) tiap dashboard dibuka, otomatis difilter supaya hanya menampilkan leads yang datang dari **bot WhatsApp** (akun Insightly ini sudah berisi puluhan ribu leads lama dari sumber lain sejak 2021, jadi tidak ikut tampil di sini).
- **Meeting Summary** — dicatat MANUAL oleh konsultan setelah sesi konsultasi (via website/Acuity), disimpan di database dashboard ini sendiri.
- **LOA (Letter of Offer/Advice)** — untuk versi pertama ini ditempel MANUAL (teks langsung, atau link ke dokumen dari tool LOA generator tim lain, mis. hasil dari Claude). Bisa disambungkan otomatis nanti begitu tool itu punya API/export.

Login: 1 username+password bersama untuk semua konsultan (versi pertama — bisa di-upgrade ke akun per-konsultan nanti).

---

## 1. Status setup kamu saat ini

- ✅ **Database (Supabase)** — SUDAH BERES. Project Supabase **"Chatbot"** (organisasi **"Wanderlen"**) dibuat KHUSUS untuk dashboard ini (terpisah total dari project lain seperti HRM) — tabel `meeting_summaries` & `loa_documents` sudah dibuat di schema `public` project itu. Kamu tinggal ambil connection string-nya (lihat langkah 2 di bawah).
- ✅ **GitHub** — repo `WA-Chatbot` di akun `sumaantara` sudah kamu buat, dan kode dashboard ini sudah kamu upload ke situ.
- 🔲 **Render** — belum dibuat, ini yang perlu kamu bikin (langkah 4).
- **Kredensial Insightly**: `INSIGHTLY_API_KEY` dan `INSIGHTLY_POD` — SAMA dengan yang dipakai bot WhatsApp (yang sudah kamu isi sebelumnya).

Kamu TIDAK perlu kartu kredit untuk paket gratis Render.

---

## 2. Ambil connection string database (Supabase project "Chatbot")

1. Buka https://supabase.com/dashboard → pilih organisasi **"Wanderlen"** → project **"Chatbot"**.
2. **Project Settings (ikon gerigi) → Database → Connection string → tab "URI"**, mode **"Session"** (bukan "Transaction").
3. Copy connection string-nya (bentuknya `postgresql://postgres.xxxxx:[YOUR-PASSWORD]@...supabase.com:5432/postgres`) — ganti `[YOUR-PASSWORD]` dengan password database project "Chatbot" (kalau lupa, bisa di-reset di halaman yang sama).
4. Ini nanti jadi nilai `DATABASE_URL` di langkah 4.

Catatan: project ini KHUSUS untuk dashboard, jadi tabelnya langsung di schema `public` (tidak perlu schema terpisah seperti percobaan awal yang sempat numpang di project Supabase "HRM" milik aplikasi lain -- itu sudah dibatalkan/dibersihkan, tidak dipakai lagi).

---

## 3. Upload kode ke GitHub — ✅ SUDAH KAMU LAKUKAN

Kode dashboard sudah kamu upload ke repo `https://github.com/sumaantara/WA-Chatbot`. Langkah ini sudah selesai, tinggal lanjut ke deploy Render di bawah.

(Catatan untuk update kode di kemudian hari: saya tidak punya akses push GitHub langsung dari sesi Claude manapun, jadi tiap ada perubahan kode baru dari saya, kamu perlu upload ulang manual -- lihat bagian 5 di bawah.)

---

## 4. Deploy ke Render

1. Buka https://render.com → Sign up (bisa pakai akun GitHub langsung, supaya repo otomatis terhubung — pilih akun `sumaantara`).
2. Dashboard Render → **New → Web Service**.
3. Pilih repo `WA-Chatbot`.
4. Isi konfigurasi:
   - **Name**: `oneland-leads-dashboard` (bebas)
   - **Region**: Singapore (atau terdekat)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Scroll ke **Environment Variables**, tambahkan semua ini (isi sesuai kredensial kamu, lihat `.env.example` untuk penjelasan tiap nilai):
   - `INSIGHTLY_API_KEY`
   - `INSIGHTLY_POD`
   - `DATABASE_URL` (dari Supabase project "Chatbot", langkah 2 di atas)
   - `DASHBOARD_USERNAME`
   - `DASHBOARD_PASSWORD` (pakai password yang KUAT — ini pintu masuk satu-satunya ke data leads calon klien)
   - `SESSION_SECRET` (string acak panjang — generate dengan menjalankan `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` di komputer manapun yang ada Node, lalu copy hasilnya)
   - `BUSINESS_NAME` = `ONEderland Consulting`
6. Klik **Create Web Service**. Render akan build & jalankan otomatis (±2-3 menit untuk pertama kali).
7. Setelah statusnya "Live", Render kasih URL publik (bentuknya `https://oneland-leads-dashboard.onrender.com`) — ini yang dibuka konsultan.

### Migrasi database

Sudah TIDAK PERLU dijalankan manual — tabelnya sudah saya buat langsung di Supabase project "Chatbot" (schema `public`). `npm run db:migrate` tetap aman dijalankan kapan saja kalau perlu (semua perintahnya `IF NOT EXISTS`, tidak akan merusak data yang sudah ada).

### Catatan paket gratis Render
Paket Free Render akan "tidur" (sleep) kalau tidak ada yang akses selama ±15 menit, dan butuh beberapa detik untuk "bangun" lagi saat diakses pertama kali setelah tidur — wajar untuk alat internal, bukan bug. Kalau nanti dirasa mengganggu, tinggal upgrade ke paket berbayar termurah Render (~$7/bulan) supaya selalu online.

---

## 5. Update/redeploy di kemudian hari

Kalau saya (Claude) membuatkan perubahan kode lagi:
1. Saya kirim kamu file-file yang berubah / zip barunya (dan kalau ada perubahan skema database, saya terapkan langsung ke Supabase project "Chatbot" dari sisi saya, seperti yang sudah saya lakukan di langkah 2 di atas).
2. Upload ulang file yang berubah ke repo `https://github.com/sumaantara/WA-Chatbot` (lewat GitHub Desktop: replace file lokal → commit → push, atau upload ulang lewat browser di halaman repo).
3. Render otomatis mendeteksi push baru dan redeploy sendiri (±2-3 menit) — tidak perlu langkah manual lain.

---

## 6. Struktur proyek
```
oneland-dashboard/
├── src/
│   ├── server.js          # entry point Express, session login
│   ├── routes/leads.js    # semua route: daftar leads, detail, meeting summary, LOA
│   ├── lib/
│   │   ├── insightly.js   # fetch Leads dari Insightly API (filter by Lead Source "Chatbots" + tag "wachatbot")
│   │   ├── db.js          # koneksi Postgres (Supabase project "Chatbot", org "Wanderlen")
│   │   ├── schema.sql     # skema tabel di schema public (meeting_summaries & loa_documents)
│   │   ├── migrate.js     # jalankan schema.sql (npm run db:migrate)
│   │   └── auth.js        # cek login shared-password
│   ├── views/              # halaman EJS (login, leads-list, lead-detail, error)
│   └── public/style.css
├── .env.example
└── package.json
```

## 7. Rencana lanjutan (belum dikerjakan)
- Sambungkan tool LOA generator tim lain secara otomatis (begitu ada API/export dari tool itu) — saat ini LOA ditempel manual (teks/link).
- Akun login terpisah per konsultan (saat ini 1 password bersama untuk semua).
- Bisa ditambah: filter/statistik (jumlah leads per kategori visa per bulan, dll) kalau dibutuhkan.
