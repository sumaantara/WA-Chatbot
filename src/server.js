import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

import { pool } from "./lib/db.js";
import { requireLogin, checkCredentials } from "./lib/auth.js";
import leadsRouter from "./routes/leads.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: pool
      ? new PgSession({ pool, tableName: "dashboard_sessions", createTableIfMissing: true })
      : undefined, // fallback ke MemoryStore kalau DATABASE_URL belum diisi (cuma untuk tes lokal cepat)
    secret: process.env.SESSION_SECRET || "ganti-session-secret-ini-di-env",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 hari
      secure: process.env.NODE_ENV === "production",
    },
  })
);

const businessName = process.env.BUSINESS_NAME || "ONEderland Consulting";
app.use((req, res, next) => {
  res.locals.businessName = businessName;
  res.locals.loggedIn = Boolean(req.session?.loggedIn);
  next();
});

app.get("/login", (req, res) => {
  if (req.session?.loggedIn) return res.redirect("/");
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  try {
    if (checkCredentials(username, password)) {
      req.session.loggedIn = true;
      req.session.username = username;
      return res.redirect("/");
    }
    return res.render("login", { error: "Username atau password salah." });
  } catch (err) {
    return res.render("login", { error: err.message });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.use("/", requireLogin, leadsRouter);

app.use((req, res) => {
  res.status(404).render("error", { message: "Halaman tidak ditemukan." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[dashboard] Error:", err);
  res.status(500).render("error", { message: err.message || "Terjadi kesalahan." });
});

const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
  console.log(`[dashboard] ${businessName} Leads Dashboard jalan di http://localhost:${PORT}`);
  if (!process.env.DATABASE_URL) {
    console.warn("[dashboard] DATABASE_URL belum diisi -- Meeting Summary & LOA tidak bisa disimpan sampai diisi + `npm run db:migrate`.");
  }
});
