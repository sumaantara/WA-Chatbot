// Login sederhana, 1 username+password bersama untuk semua konsultan
// (keputusan eksplisit pemilik bisnis untuk versi pertama, 2026-11-24 --
// bisa di-upgrade ke akun per-konsultan nanti kalau dibutuhkan). Session
// disimpan di Postgres (connect-pg-simple) supaya login tidak hilang kalau
// server di-restart/redeploy, dan supaya beberapa konsultan bisa login
// bersamaan dari device berbeda tanpa saling mengganggu.

export function requireLogin(req, res, next) {
  if (req.session?.loggedIn) return next();
  return res.redirect("/login");
}

export function checkCredentials(username, password) {
  const validUser = process.env.DASHBOARD_USERNAME || "admin";
  const validPass = process.env.DASHBOARD_PASSWORD;
  if (!validPass) {
    throw new Error(
      "DASHBOARD_PASSWORD belum diisi di .env -- wajib diisi supaya dashboard tidak bisa diakses sembarang orang."
    );
  }
  return username === validUser && password === validPass;
}
