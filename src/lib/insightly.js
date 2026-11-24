// Ambil data Leads langsung dari Insightly API (REST v3.1) -- SUMBER UTAMA
// data leads untuk dashboard ini (keputusan eksplisit pemilik bisnis,
// 2026-11-24: "langsung dari Insightly tiap kali dashboard dibuka", BUKAN
// disalin ke database sendiri). Kredensial SAMA dengan yang dipakai bot
// WhatsApp (src/insightly.js di proyek wa-chatbot) untuk generate Lead.
//
// PENTING (ditemukan 2026-11-24 saat membangun dashboard ini): akun
// Insightly ONEderland BUKAN akun baru -- sudah berisi puluhan ribu Leads
// lama dari sumber lain (Tawk.to, formulir web, chatbot LAIN di website,
// dst) sejak 2021. Dashboard ini HANYA boleh menampilkan Leads yang dibuat
// BOT WHATSAPP ini, jadi semua query di sini memfilter berdasarkan DUA
// syarat sekaligus (lihat wa-chatbot/src/insightly.js untuk sisi penulisnya):
//   1. LEAD_SOURCE_ID = "Chatbots" (CHATBOT_LEAD_SOURCE_ID) -- TAPI source
//      ini TERNYATA dipakai BERSAMA chatbot lain di website ONEderland
//      sejak 2025, jadi TIDAK CUKUP sendirian untuk identifikasi bot WA.
//   2. Lead itu bertag "wachatbot" (LEAD_TAG) -- inilah penanda yang
//      BENAR-BENAR unik untuk bot WhatsApp ini.
// Insightly TIDAK mendukung filter berdasarkan tag lewat endpoint Search
// (field "TAGS" ditolak dengan error), jadi strategi yang dipakai: filter
// di sisi Insightly berdasarkan Lead Source dulu (mengecilkan jumlah data
// yang ditarik dari puluhan ribu jadi beberapa ribu), LALU filter tag
// "wachatbot" di SISI KITA dari hasil itu (lihat `filterByWaChatbotTag()`).
//
// Endpoint list biasa (`GET /Leads`) TIDAK mendukung $orderby/$filter
// dengan baik di akun ini (selalu mengembalikan urutan ASCENDING by
// insertion, mengabaikan parameter sorting) -- jadi dipakai endpoint
// `GET /Leads/Search?field_name=...&field_value=...` yang mendukung
// top/skip dengan benar, dikombinasikan dengan strategi "cari total lalu
// skip ke ekor" di bawah supaya Leads TERBARU yang tampil duluan.

const API_KEY = process.env.INSIGHTLY_API_KEY;
const POD = process.env.INSIGHTLY_POD;

// HARUS SAMA dengan nilai di wa-chatbot/.env.
const CHATBOT_LEAD_SOURCE_ID = process.env.INSIGHTLY_CHATBOT_LEAD_SOURCE_ID
  ? Number(process.env.INSIGHTLY_CHATBOT_LEAD_SOURCE_ID)
  : 3832232;
const LEAD_TAG = (process.env.INSIGHTLY_LEAD_TAG || "wachatbot").toLowerCase();

function hasWaChatbotTag(lead) {
  return Array.isArray(lead.TAGS) && lead.TAGS.some((t) => (t.TAG_NAME || "").toLowerCase() === LEAD_TAG);
}

export function isInsightlyConfigured() {
  return Boolean(API_KEY && POD);
}

function apiBase() {
  return `https://api.${POD}.insightly.com/v3.1`;
}

function authHeader() {
  const token = Buffer.from(`${API_KEY}:`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

// Insightly membatasi 10 panggilan API per detik per akun (HTTP 429 kalau
// dilanggar) -- ditemukan 2026-11-24 saat strategi "binary search total"
// di bawah ini sempat memanggil API beruntun lebih cepat dari itu. Dua
// jaring pengaman dipasang: (1) jeda minimum antar panggilan supaya tidak
// pernah lebih dari ~8/detik, (2) retry dengan jeda lebih panjang kalau
// toh masih kena 429 (mis. ada proses lain yang juga memanggil API
// bersamaan, seperti bot WA yang sedang generate Lead).
const MIN_CALL_INTERVAL_MS = 130; // ~7-8 panggilan/detik, di bawah batas 10/detik
let lastCallAt = 0;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttledFetch(url, options) {
  const wait = MIN_CALL_INTERVAL_MS - (Date.now() - lastCallAt);
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429) return res;
    const backoff = 600 * (attempt + 1);
    console.warn(`[insightly-dashboard] Kena rate limit Insightly (429), coba lagi dalam ${backoff}ms...`);
    await sleep(backoff);
    lastCallAt = Date.now();
  }
  return fetch(url, options); // percobaan terakhir, apa adanya
}

async function fetchLeadsPage({ top, skip }) {
  const url = `${apiBase()}/Leads/Search?field_name=LEAD_SOURCE_ID&field_value=${CHATBOT_LEAD_SOURCE_ID}&top=${top}&skip=${skip}`;
  const res = await throttledFetch(url, { headers: authHeader() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Insightly API error (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

// --- Estimasi total jumlah Leads bersumber WhatsApp, supaya kita bisa
// langsung "skip" ke bagian EKOR (= paling baru, karena endpoint Search
// selalu mengembalikan urutan ascending by insertion) tanpa harus menarik
// seluruh data tiap kali. Di-cache di memori proses & diperbarui secara
// murah (linear probe) tiap kali dashboard dibuka, bukan binary search
// penuh ulang setiap saat.
let totalCache = { total: null, lastProbeAt: 0 };
const PROBE_MIN_INTERVAL_MS = 15_000;
const LINEAR_PROBE_MAX_STEPS = 80; // cukup untuk leads baru yang masuk dalam ~15 detik terakhir

async function countAt(skip) {
  const data = await fetchLeadsPage({ top: 1, skip });
  return Array.isArray(data) ? data.length : 0;
}

async function binarySearchTotal(loStart = 0, hiStart = 4000) {
  let lo = loStart;
  let hi = hiStart;
  // pastikan hi benar2 kosong, kalau belum, lipat gandakan dulu
  // (jaring pengaman kalau jumlah leads WhatsApp sudah tumbuh jauh melebihi hiStart)
  let guard = 0;
  while ((await countAt(hi)) > 0 && guard < 20) {
    hi *= 2;
    guard++;
  }
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const c = await countAt(mid);
    if (c > 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

async function getTotalCount({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (totalCache.total == null) {
    totalCache.total = await binarySearchTotal();
    totalCache.lastProbeAt = now;
    return totalCache.total;
  }
  if (forceRefresh || now - totalCache.lastProbeAt > PROBE_MIN_INTERVAL_MS) {
    let t = totalCache.total;
    let steps = 0;
    while (steps < LINEAR_PROBE_MAX_STEPS && (await countAt(t)) > 0) {
      t += 1;
      steps += 1;
    }
    if (steps === LINEAR_PROBE_MAX_STEPS) {
      // lonjakan leads baru lebih dari batas probe linear -- lakukan binary
      // search penuh dari titik ini supaya tidak terus-menerus linear 1-per-1.
      t = await binarySearchTotal(t, t + 5000);
    }
    totalCache.total = t;
    totalCache.lastProbeAt = now;
  }
  return totalCache.total;
}

const CACHE_TTL_MS = 20_000;
let leadsCache = { at: 0, key: null, data: null };

/**
 * Ambil Leads TERBARU dari bot WhatsApp (urut dari yang paling baru dibuat
 * duluan), sampai `limit` item. Dipakai untuk halaman daftar leads.
 *
 * Karena Lead Source "Chatbots" dipakai BERSAMA chatbot lain (lihat catatan
 * di atas file ini), kita ambil jendela data dari ekor (leads Source
 * "Chatbots" TERBARU) lebih besar dari `limit`, lalu saring di sisi kita
 * untuk yang bertag "wachatbot" saja. Kalau hasil saringan masih kurang
 * dari `limit` dan masih ada data lebih lama yang belum ditarik, jendelanya
 * diperbesar bertahap (maks beberapa kali) -- supaya tetap dapat `limit`
 * leads TERBARU milik bot WA, bukan cuma leads dari "Chatbots" secara umum.
 */
export async function listRecentLeads({ limit = 200, forceRefresh = false } = {}) {
  if (!isInsightlyConfigured()) {
    throw new Error("INSIGHTLY_API_KEY/INSIGHTLY_POD belum diisi di .env");
  }

  const cacheKey = `limit:${limit}`;
  if (!forceRefresh && leadsCache.data && leadsCache.key === cacheKey && Date.now() - leadsCache.at < CACHE_TTL_MS) {
    return leadsCache.data;
  }

  const total = await getTotalCount({ forceRefresh });

  let windowSize = Math.max(limit * 3, 60);
  let filtered = [];
  const MAX_EXPANSIONS = 5;
  for (let attempt = 0; attempt <= MAX_EXPANSIONS; attempt++) {
    const skip = Math.max(0, total - windowSize);
    const data = await fetchLeadsPage({ top: Math.min(windowSize, total), skip });
    filtered = data.filter(hasWaChatbotTag);
    const reachedStart = skip === 0;
    if (filtered.length >= limit || reachedStart || attempt === MAX_EXPANSIONS) {
      break;
    }
    windowSize *= 3; // perbesar jendela, coba lagi dari ekor yang lebih jauh ke belakang
  }

  filtered.sort((a, b) => new Date(b.DATE_CREATED_UTC) - new Date(a.DATE_CREATED_UTC));
  const result = filtered.slice(0, limit);

  leadsCache = { at: Date.now(), key: cacheKey, data: result };
  return result;
}

/**
 * Ambil 1 Lead berdasarkan LEAD_ID (dipakai di halaman detail lead). TIDAK
 * memfilter berdasarkan LEAD_SOURCE_ID -- kalau konsultan punya link
 * langsung ke Lead manapun di Insightly, halaman detail tetap bisa
 * menampilkannya.
 */
export async function getLeadById(leadId) {
  if (!isInsightlyConfigured()) {
    throw new Error("INSIGHTLY_API_KEY/INSIGHTLY_POD belum diisi di .env");
  }
  const res = await throttledFetch(`${apiBase()}/Leads/${encodeURIComponent(leadId)}`, {
    headers: authHeader(),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Insightly API error (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Hapus 1 Lead (dipakai untuk membersihkan Lead TEST dari dashboard ini
 * sendiri kalau dibutuhkan -- bukan dipakai dalam alur normal konsultan).
 */
export async function deleteLead(leadId) {
  if (!isInsightlyConfigured()) {
    throw new Error("INSIGHTLY_API_KEY/INSIGHTLY_POD belum diisi di .env");
  }
  const res = await throttledFetch(`${apiBase()}/Leads/${encodeURIComponent(leadId)}`, {
    method: "DELETE",
    headers: authHeader(),
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    throw new Error(`Insightly API error (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
}

/**
 * Pecah LEAD_DESCRIPTION (yang diisi bot WA, lihat wa-chatbot/src/insightly.js)
 * jadi { visaCategory, summaryBody } supaya tampilan dashboard lebih rapi
 * daripada menampilkan 1 blok teks panjang mentah-mentah.
 */
export function parseLeadDescription(description) {
  if (!description) return { visaCategory: null, summaryBody: "" };
  const match = description.match(/Kategori visa terdeteksi:\s*([^.]+)\./);
  const visaCategory = match ? match[1].trim() : null;
  const parts = description.split(/\n\n/);
  const summaryBody = parts.length > 1 ? parts.slice(1).join("\n\n") : description;
  return { visaCategory, summaryBody };
}
