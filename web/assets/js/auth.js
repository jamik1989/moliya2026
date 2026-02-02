// web/assets/js/auth.js
// MVP: license-key orqali kirish (server yo'q)

(function () {
  const STORAGE_KEY = "app_auth_v1";

  // 🔑 Shu yerga mijozlar uchun kalitlarni qo'shib borasiz
  // format: KEY: "YYYY-MM-DD" (muddati)
  const LICENSES = {
    "DEMO-1111-2222": "2026-12-31",
    "SHOH-AB12-CD34": "2026-06-30",
    "BETA-0000-0000": "2026-03-31",
  };

  function todayYMD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function safeParse(json) {
    try { return JSON.parse(json); } catch { return null; }
  }

  function getState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? safeParse(raw) : null;
  }

  function setState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function clearState() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function normalizeKey(k) {
    return String(k || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/_/g, "-");
  }

  function validateLicenseKey(key) {
    const k = normalizeKey(key);
    const expiresAt = LICENSES[k] || null;
    if (!expiresAt) return { ok: false, reason: "KEY_NOT_FOUND" };

    // muddat tekshirish (YYYY-MM-DD)
    const now = todayYMD();
    if (now > expiresAt) return { ok: false, reason: "EXPIRED", expiresAt };

    return { ok: true, key: k, expiresAt };
  }

  function loginWithKey(key) {
    const res = validateLicenseKey(key);
    if (!res.ok) return res;

    setState({
      key: res.key,
      expiresAt: res.expiresAt,
      loggedAt: new Date().toISOString(),
    });

    return { ok: true, key: res.key, expiresAt: res.expiresAt };
  }

  function isAuthenticated() {
    const st = getState();
    if (!st || !st.key || !st.expiresAt) return false;

    const res = validateLicenseKey(st.key);
    return res.ok;
  }

  function logout() {
    clearState();
  }

  function requireAuth(options) {
    const cfg = Object.assign(
      {
        loginPath: "./login.html", // user.html bilan bir papkada bo'lsa
      },
      options || {}
    );

    if (!isAuthenticated()) {
      // qaytib kelish uchun url saqlab qo'yamiz
      const backTo = window.location.href;
      sessionStorage.setItem("after_login_redirect", backTo);
      window.location.href = cfg.loginPath;
      return false;
    }
    return true;
  }

  // Globalga chiqaramiz (app.js / login.html ishlatishi uchun)
  window.Auth = {
    loginWithKey,
    isAuthenticated,
    logout,
    requireAuth,
    getState,
    validateLicenseKey,
    normalizeKey,
  };
})();
