// web/assets/js/core/security.js
(() => {
  "use strict";

  // ====== SETTINGS ======
  // Demo limit
  const DEMO_ROWS_LIMIT = 10;

  // Storage keys
  const KEY_LICENSE = "license_state_v1"; // { key, machineId, activatedAt }
  const KEY_DEMO = "demo_state_v1";       // { enabled: true/false }
  const KEY_MACHINE = "machine_id_v1";    // cached machineId

  // ====== MACHINE ID (browser fingerprint - lightweight) ======
  async function sha256(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function getFingerprintRaw() {
    // minimal + stable-ish signals
    const nav = window.navigator || {};
    const screen = window.screen || {};
    const parts = [
      nav.userAgent || "",
      nav.language || "",
      String(nav.hardwareConcurrency || ""),
      String(nav.deviceMemory || ""),
      String(screen.width || ""),
      String(screen.height || ""),
      String(screen.colorDepth || ""),
      Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      String(new Date().getTimezoneOffset())
    ];
    return parts.join("|");
  }

  async function getMachineId() {
    try {
      const cached = localStorage.getItem(KEY_MACHINE);
      if (cached) return cached;

      const raw = getFingerprintRaw();
      const id = await sha256(raw);
      localStorage.setItem(KEY_MACHINE, id);
      return id;
    } catch (e) {
      // fallback
      return "machine_unknown";
    }
  }

  // ====== LICENSE CHECK ======
  function getSavedLicense() {
    try {
      const raw = localStorage.getItem(KEY_LICENSE);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !obj.key || !obj.machineId) return null;
      return obj;
    } catch {
      return null;
    }
  }

  function saveLicense(key, machineId) {
    const payload = { key, machineId, activatedAt: Date.now() };
    localStorage.setItem(KEY_LICENSE, JSON.stringify(payload));
  }

  function setDemoEnabled(enabled) {
    localStorage.setItem(KEY_DEMO, JSON.stringify({ enabled: !!enabled, updatedAt: Date.now() }));
  }

  function isDemoEnabled() {
    try {
      const raw = localStorage.getItem(KEY_DEMO);
      if (!raw) return true; // default demo ON until activated
      const obj = JSON.parse(raw);
      return obj?.enabled !== false;
    } catch {
      return true;
    }
  }

  // ====== KEY FORMAT ======
  // Key format: ABCD-EFGH-IJKL-MNOP (letters/digits), upper-case
  function normalizeKey(input) {
    return String(input || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "")
      .replace(/-{2,}/g, "-");
  }

  function isKeyLike(key) {
    return /^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(key);
  }

  // ====== VERIFY KEY (offline) ======
  // Bu yerda "sotuvchi key" bilan machineId mosligini tekshiramiz.
  // Variant A (hozir): key ichida machineId hash qisqacha kodlangan bo‘ladi.
  // Biz soddalashtiramiz: key = first16(machineIdHash) dan 4-4 qilib.
  // Ya’ni siz mijozga key berishda shu funksiyadan foydalansangiz bo‘ladi.

  function split4(str16) {
    return `${str16.slice(0,4)}-${str16.slice(4,8)}-${str16.slice(8,12)}-${str16.slice(12,16)}`;
  }

  async function expectedKeyForMachine(machineId) {
    const h = await sha256("LIC|" + machineId);
    const first16 = h.slice(0, 16).toUpperCase();
    return split4(first16);
  }

  async function verifyKeyForThisMachine(key) {
    const machineId = await getMachineId();
    const expected = await expectedKeyForMachine(machineId);
    return normalizeKey(key) === expected;
  }

  // ====== PUBLIC API ======
  const License = {
    DEMO_ROWS_LIMIT,
    normalizeKey,
    isKeyLike,
    getSavedLicense,
    isDemoEnabled,
    setDemoEnabled,
    getMachineId,
    expectedKeyForMachine, // sotuvchi key generate qilish uchun (admin)
    async isActivated() {
      const machineId = await getMachineId();
      const saved = getSavedLicense();
      if (!saved) return false;
      return saved.machineId === machineId && (await verifyKeyForThisMachine(saved.key));
    },
    async activate(keyInput) {
      const key = normalizeKey(keyInput);
      if (!isKeyLike(key)) return { ok: false, reason: "Key formati noto‘g‘ri" };

      const machineId = await getMachineId();
      const ok = await verifyKeyForThisMachine(key);
      if (!ok) return { ok: false, reason: "Key ushbu qurilmaga mos emas" };

      saveLicense(key, machineId);
      setDemoEnabled(false);
      return { ok: true };
    },
    deactivate() {
      localStorage.removeItem(KEY_LICENSE);
      setDemoEnabled(true);
    }
  };

  window.License = License;

  // ====== SIMPLE UI (Activation Modal) ======
  function ensureActivationUI() {
    if (document.getElementById("licenseModal")) return;

    const modal = document.createElement("div");
    modal.id = "licenseModal";
    modal.style.cssText = `
      position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
      background: rgba(0,0,0,.45); z-index: 9999; padding: 16px;
    `;

    modal.innerHTML = `
      <div style="max-width:520px; width:100%; background:#fff; border-radius:16px; padding:18px; box-shadow:0 10px 30px rgba(0,0,0,.2)">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="font-weight:700; font-size:18px;">Aktivatsiya</div>
          <button id="licenseCloseBtn" style="border:none; background:#eee; border-radius:10px; padding:6px 10px; cursor:pointer;">✕</button>
        </div>

        <div style="margin-top:10px; font-size:13px; color:#444;">
          <div><b>Qurilma ID:</b> <span id="machineIdText">...</span></div>
          <div style="margin-top:6px;">Key kiriting (misol: XXXX-XXXX-XXXX-XXXX)</div>
        </div>

        <div style="display:flex; gap:10px; margin-top:10px;">
          <input id="licenseKeyInput" placeholder="XXXX-XXXX-XXXX-XXXX" style="flex:1; padding:10px 12px; border:1px solid #ddd; border-radius:12px; outline:none;" />
          <button id="licenseActivateBtn" style="padding:10px 14px; border:none; background:#111827; color:#fff; border-radius:12px; cursor:pointer;">Aktivlash</button>
        </div>

        <div id="licenseMsg" style="margin-top:10px; font-size:13px;"></div>

        <div style="margin-top:12px; font-size:12px; color:#666;">
          Aktivatsiya muvaffaqiyatli bo‘lsa demo cheklovlar olib tashlanadi.
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => { modal.style.display = "none"; };
    document.getElementById("licenseCloseBtn").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    // fill machine id
    License.getMachineId().then(id => {
      const el = document.getElementById("machineIdText");
      if (el) el.textContent = id.slice(0, 12) + "...";
    });

    document.getElementById("licenseActivateBtn").addEventListener("click", async () => {
      const input = document.getElementById("licenseKeyInput");
      const msg = document.getElementById("licenseMsg");
      const key = input?.value || "";

      const res = await License.activate(key);
      if (res.ok) {
        if (msg) msg.innerHTML = `<span style="color:green; font-weight:600;">✅ Aktivatsiya muvaffaqiyatli!</span>`;
        setTimeout(() => window.location.reload(), 700);
      } else {
        if (msg) msg.innerHTML = `<span style="color:#b91c1c; font-weight:600;">❌ ${res.reason}</span>`;
      }
    });
  }

  function ensureTopBarBadge() {
    // yuqoriga demo/active badge + aktivatsiya tugma
    if (document.getElementById("licenseBadgeWrap")) return;

    const wrap = document.createElement("div");
    wrap.id = "licenseBadgeWrap";
    wrap.style.cssText = "position:fixed; right:14px; bottom:14px; z-index:9998; display:flex; gap:10px; align-items:center;";

    wrap.innerHTML = `
      <div id="licenseBadge" style="padding:8px 10px; border-radius:12px; background:#111827; color:#fff; font-size:12px; box-shadow:0 6px 18px rgba(0,0,0,.18);">
        ...
      </div>
      <button id="licenseOpenBtn" style="padding:9px 12px; border:none; border-radius:12px; background:#fff; cursor:pointer; box-shadow:0 6px 18px rgba(0,0,0,.12);">
        Aktivatsiya
      </button>
    `;

    document.body.appendChild(wrap);

    const btn = document.getElementById("licenseOpenBtn");
    btn.addEventListener("click", () => {
      ensureActivationUI();
      const modal = document.getElementById("licenseModal");
      if (modal) modal.style.display = "flex";
    });
  }

  async function refreshBadge() {
    const badge = document.getElementById("licenseBadge");
    if (!badge) return;

    const active = await License.isActivated();
    if (active) {
      badge.textContent = "✅ Litsenziya: Aktiv";
      badge.style.background = "#065f46";
    } else {
      badge.textContent = `🧪 Demo: ${DEMO_ROWS_LIMIT} qator`;
      badge.style.background = "#111827";
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    ensureTopBarBadge();
    await refreshBadge();
    // demo default ON until activated
    const active = await License.isActivated();
    if (active) License.setDemoEnabled(false);
  });

})();
