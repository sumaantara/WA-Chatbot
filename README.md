# ONEderland Leads Dashboard

Dashboard internal untuk konsultan ONEderland Consulting:
- **Leads** — diambil LANGSUNG dari Insightly (CRM) tiap dashboard dibuka, otomatis difilter supaya hanya menampilkan leads yang datang dari **bot WhatsApp** (akun Insightly ini sudah berisi puluhan ribu leads lama dari sumber lain sejak 2021, jadi tidak ikut tampil di sini).
- **Meeting Summary** — dicatat MANUAL oleh konsultan setelah sesi konsultasi (via website/Acuity), disimpan di database dashboard ini sendiri.
- **LOA (Letter of Offer/Advice)** — untuk versi pertama ini ditempel MANUAL (teks langsung, atau link ke dokumen dari tool LOA generator tim lain, mis. hasil dari Claude). Bisa disambungkan otomatis nanti begitu tool itu punya API/export.

Login: 1 username+password bersama untuk semua konsultan (versi pertama — bisa di-upgrade ke akun per-konsultan nanti).

---

## 1. Status setup kamu saat ini

- ✅ **Database (Supabase)** — SUDAH BERES. Dipakai project Supabase **"HRM"** yang sudah ada (bukan project baru) — tabel dashboard ini sudah dibuat di schema **TERPISAH** bernama `oneland_dashboard` di project itu (tidak campur dengan data HRM). Kamu tinggal ambil connection string-nya (lihat langkah 2 di bawah).
- ✅ **GitHub** — repo `WA-Chatbot` di akun `sumaantara` sudah kamu buat. Kode dashboard ini perlu di-upload ke situ (lihat langkah 3 — saya tidak punya akses push langsung ke GitHub-mu dari sini, jadi ini langkah manual).
- 🔲 **Render** — belum dibuat, ini yang perlu kamu bikin (langkah 4).
- **Kredensial Insightly**: `INSIGHTLY_API_KEY` dan `INSIGHTLY_POD` — SAMA dengan yang dipakai bot WhatsApp (yang sudah kamu isi sebelumnya).

Kamu TIDAK perlu kartu kredit untuk paket gratis Render.

---

## 2. Ambil connection string database (Supabase project "HRM")

1. Buka https://supabase.com/dashboard → pilih project **"HRM"**.
2. **Project Settings (ikon gerigi) → Database → Connection string → tab "URI"**, mode **"Session"** (bukan "Transaction").
3. Copy connection string-nya (bentuknya `postgresql://postgres.xxxxx:[YOUR-PASSWORD]@...supabase.com:5432/postgres`) — ganti `[YOUR-PASSWORD]` dengan password database project "HRM" (kalau lupa, bisa di-reset di halaman yang sama).
4. Ini nanti jadi nilai `DATABASE_URL` di langkah 4.

Catatan: tabel dashboard ini (`meeting_summaries`, `loa_documents`) ada di schema `oneland_dashboard` di project yang SAMA dengan HRM — connection string di atas otomatis bisa baca schema manapun di project itu, tidak perlu setting tambahan.

⚠️ **Satu hal yang perlu kamu tahu** (bukan soal dashboard ini, tapi soal project Supabase "HRM" itu sendiri): saat saya cek, 5 tabel HRM (`hrm.settings`, `hrm.members`, `hrm.leases`, `hrm.snapshots`, `hrm.changelog`) **tidak punya Row Level Security (RLS) aktif** — artinya kalau aplikasi HRM-mu memberi akses publik lewat anon key Supabase, siapapun yang punya anon key itu bisa baca/ubah semua data di tabel-tabel itu. Ini di luar scope dashboard leads ini, saya tidak mengubah apapun di sana, tapi worth ditinjau. Saya tidak jalankan perbaikannya karena bisa memblokir akses kalau policy-nya belum diatur dengan benar — tanya saya kalau mau dibantu tinjau itu secara terpisah.

---

## 3. Upload kode ini ke repo GitHub `WA-Chatbot` (akun `sumaantara`)

Saya tidak punya koneksi GitHub di sesi ini, jadi ini perlu kamu lakukan manual. Cara paling gampang:

**Opsi A — GitHub Desktop (paling gampang kalau belum pernah pakai git):**
1. Clone dulu repo `WA-Chatbot` yang sudah kamu buat (GitHub Desktop → File → Clone repository → pilih `sumaantara/WA-Chatbot`).
2. Extract isi zip dashboard ini (folder `oneland-dashboard`) LANGSUNG ke dalam folder hasil clone tadi (timpa/gabung, bukan bikin subfolder baru).
3. Di GitHub Desktop: akan muncul semua file baru → tulis commit message (mis. "Dashboard leads v1") → **Commit to main** → **Push origin**.

**Opsi B — upload lewat browser (tanpa install apapun):**
1. Buka halaman repo `https://github.com/sumaantara/WA-Chatbot`.
2. Klik **Add file → Upload files**.
3. Drag semua file & folder dari dalam zip dashboard ini (JANGAN upload folder `node_modules` kalau ada, dan jangan upload file `.env` kalau kamu sempat buat).
4. Scroll bawah → **Commit changes**.

Setelah ini selesai, kode dashboard ada di repo `WA-Chatbot`, siap dipakai Render di langkah berikutnya.

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
   - `DATABASE_URL` (dari Supabase project "HRM", langkah 2 di atas)
   - `DASHBOARD_USERNAME`
   - `DASHBOARD_PASSWORD` (pakai password yang KUAT — ini pintu masuk satu-satunya ke data leads calon klien)
   - `SESSION_SECRET` (string acak panjang — generate dengan menjalankan `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` di komputer manapun yang ada Node, lalu copy hasilnya)
   - `BUSINESS_NAME` = `ONEderland Consulting`
6. Klik **Create Web Service**. Render akan build & jalankan otomatis (±2-3 menit untuk pertama kali).
7. Setelah statusnya "Live", Render kasih URL publik (bentuknya `https://oneland-leads-dashboard.onrender.com`) — ini yang dibuka konsultan.

### Migrasi database

Sudah TIDAK PERLU dijalankan manual — tabelnya sudah saya buat langsung di Supabase project "HRM" (schema `oneland_dashboard`). `npm run db:migrate` tetap aman dijalankan kapan saja kalau perlu (semua perintahnya `IF NOT EXISTS`, tidak akan merusak data yang sudah ada).

### Catatan paket gratis Render
Paket Free Render akan "tidur" (sleep) kalau tidak ada yang akses selama ±15 menit, dan butuh beberapa detik untuk "bangun" lagi saat diakses pertama kali setelah tidur — wajar untuk alat internal, bukan bug. Kalau nanti dirasa mengganggu, tinggal upgrade ke paket berbayar termurah Render (~$7/bulan) supaya selalu online.

---

## 5. Update/redeploy di kemudian hari

Kalau saya (Claude) membuatkan perubahan kode lagi:
1. Saya kirim kamu file-file yang berubah / zip barunya (dan kalau ada perubahan skema database, saya terapkan langsung ke Supabase project "HRM" dari sisi saya, seperti yang sudah saya lakukan di langkah 2 di atas).
2. Replace file-nya di folder lokal kamu (folder hasil clone repo `WA-Chatbot`), lalu lewat GitHub Desktop: **commit** perubahan → **Push origin** (atau upload ulang lewat browser seperti langkah 3 di atas).
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
│   │   ├── db.js          # koneksi Postgres (Supabase project "HRM")
│   │   ├── schema.sql     # skema tabel di schema oneland_dashboard (meeting_summaries & loa_documents)
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
