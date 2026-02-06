// server.js (ROOTDA) — Railway uchun tayyor (admin + register qo'shildi)
import express from "express";
import cors from "cors";
import session from "express-session";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

console.log("### SERVER.JS LOADED FROM:", import.meta.url);

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

// ===== paths =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// users.json rootda:
const USERS_PATH = path.join(__dirname, "users.json");

// frontend `web/` papkada:
const WEB_PATH = path.join(__dirname, "web");
const PAGES_PATH = path.join(WEB_PATH, "pages");

// ===== env/config =====
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || ""; // bo'sh bo'lsa hammasiga ruxsat (same-domain uchun qulay)
const SESSION_SECRET = process.env.SESSION_SECRET || "change_me_secret";
const ADMIN_RESET_KEY = process.env.ADMIN_RESET_KEY || "admin_reset_key_123";
const isProd = process.env.NODE_ENV === "production";

// ===== helpers =====
function loadUsers() {
  try {
    const raw = fs.readFileSync(USERS_PATH, "utf-8");
    const users = JSON.parse(raw);
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), "utf-8");
}

function isAuthed(req) {
  return Boolean(req.session?.user?.username);
}

function originAllowed(origin) {
  if (!origin) return true;
  if (!FRONTEND_ORIGIN) return true;

  const allow = String(FRONTEND_ORIGIN)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return allow.includes(origin);
}

function isValidUsername(u) {
  if (!u) return false;
  if (u.length < 2 || u.length > 50) return false;
  // faqat eng oddiy xavfsiz belgilar
  return /^[a-zA-Z0-9_.-]+$/.test(u);
}

function normalizePhone(p) {
  const s = String(p || "").trim();
  // raqamlar va + qolsin
  const cleaned = s.replace(/[^\d+]/g, "");
  return cleaned;
}

function requireAdmin(req, res) {
  const adminKey = String(req.headers["x-admin-key"] || "");
  if (adminKey !== ADMIN_RESET_KEY) {
    res.status(403).json({ ok: false, message: "Admin key xato" });
    return false;
  }
  return true;
}

// ===== CORS =====
app.use(
  cors({
    origin: (origin, cb) => {
      if (originAllowed(origin)) return cb(null, true);
      return cb(new Error("CORS blocked: " + origin));
    },
    credentials: true,
  })
);

// ===== SESSION =====
app.use(
  session({
    name: "dash_sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd, // Railway https => true
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
  })
);

// =======================================
// ✅ FRONTEND SERVE (STATIC)
// =======================================
app.use(express.static(WEB_PATH));

app.get("/", (req, res) => res.sendFile(path.join(PAGES_PATH, "login.html")));
app.get("/pages/login", (req, res) => res.sendFile(path.join(PAGES_PATH, "login.html")));
app.get("/pages/user", (req, res) => res.sendFile(path.join(PAGES_PATH, "user.html")));
app.get("/pages/admin", (req, res) => res.sendFile(path.join(PAGES_PATH, "admin.html")));
app.get("/pages/register", (req, res) => res.sendFile(path.join(PAGES_PATH, "register.html")));

// ===== ROUTES =====
app.get("/health", (req, res) => res.json({ ok: true }));

// ===== REGISTER (1-MARTA) =====
// yangi user yaratadi: username + password + phone
app.post("/api/register", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const phone = normalizePhone(req.body?.phone || "");

  if (!isValidUsername(username)) {
    return res.status(400).json({ ok: false, message: "Username noto‘g‘ri (faqat harf/son/._-)" });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ ok: false, message: "Parol kamida 4 ta bo‘lsin" });
  }
  if (!phone || phone.length < 7) {
    return res.status(400).json({ ok: false, message: "Telefon raqam noto‘g‘ri" });
  }

  const users = loadUsers();
  const exists = users.find((u) => String(u.username).toLowerCase() === username.toLowerCase());
  if (exists) {
    return res.status(409).json({ ok: false, message: "Bu username allaqachon bor" });
  }

  users.push({ username, password, phone });
  saveUsers(users);

  return res.json({ ok: true, message: "Ro‘yxatdan o‘tish muvaffaqiyatli. Endi login qiling." });
});

// ===== LOGIN =====
app.post("/api/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: "Login va parol majburiy" });
  }

  const users = loadUsers();
  const user = users.find((u) => String(u.username) === username);

  if (!user || String(user.password) !== password) {
    return res.status(401).json({ ok: false, message: "Login yoki parol xato" });
  }

  req.session.user = { username: user.username };
  req.session.save(() => {
    return res.json({ ok: true, user: { username: user.username } });
  });
});

// ===== ME =====
app.get("/api/me", (req, res) => {
  if (!isAuthed(req)) return res.status(401).json({ ok: false });
  return res.json({ ok: true, user: req.session.user });
});

// ===== LOGOUT =====
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("dash_sid");
    res.json({ ok: true });
  });
});

// ===== CHANGE PASSWORD =====
app.post("/api/change-password", (req, res) => {
  if (!isAuthed(req)) {
    return res.status(401).json({ ok: false, message: "Avval tizimga kiring" });
  }

  const username = String(req.session.user.username || "");
  const oldPassword = String(req.body?.oldPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ ok: false, message: "Eski va yangi parol majburiy" });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ ok: false, message: "Yangi parol kamida 4 ta belgi bo‘lsin" });
  }
  if (oldPassword === newPassword) {
    return res.status(400).json({ ok: false, message: "Yangi parol eski parol bilan bir xil bo‘lmasin" });
  }

  const users = loadUsers();
  const idx = users.findIndex((u) => String(u.username) === username);

  if (idx === -1) return res.status(404).json({ ok: false, message: "Foydalanuvchi topilmadi" });
  if (String(users[idx].password) !== oldPassword) {
    return res.status(400).json({ ok: false, message: "Eski parol noto‘g‘ri" });
  }

  users[idx].password = newPassword;
  saveUsers(users);

  return res.json({ ok: true, message: "Parol muvaffaqiyatli o‘zgartirildi" });
});

// =================================================
// ✅ ADMIN: USERS LIST (username/password/phone)
// =================================================
app.get("/api/admin/users", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const users = loadUsers().map(u => ({
    username: String(u.username || ""),
    password: String(u.password || ""),
    phone: String(u.phone || "")
  }));

  return res.json({ ok: true, users });
});

// =================================================
// ✅ ADMIN: CREATE USER (admin paneldan)
// =================================================
app.post("/api/admin/create-user", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const phone = normalizePhone(req.body?.phone || "");

  if (!isValidUsername(username)) {
    return res.status(400).json({ ok: false, message: "Username noto‘g‘ri (faqat harf/son/._-)" });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ ok: false, message: "Parol kamida 4 ta bo‘lsin" });
  }
  if (!phone || phone.length < 7) {
    return res.status(400).json({ ok: false, message: "Telefon raqam noto‘g‘ri" });
  }

  const users = loadUsers();
  const exists = users.find((u) => String(u.username).toLowerCase() === username.toLowerCase());
  if (exists) return res.status(409).json({ ok: false, message: "Bu username allaqachon bor" });

  users.push({ username, password, phone });
  saveUsers(users);

  return res.json({ ok: true, message: "User qo‘shildi" });
});

// =================================================
// ✅ ADMIN RESET PASSWORD (ADMIN KEY BILAN) — o'zi bor edi
// =================================================
app.post("/api/admin/reset-password", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const username = String(req.body?.username || "").trim();
  const newPassword = String(req.body?.newPassword || "");

  if (!username) return res.status(400).json({ ok: false, message: "username kerak" });
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ ok: false, message: "newPassword kamida 4 ta bo‘lsin" });
  }

  const users = loadUsers();
  const idx = users.findIndex((u) => String(u.username).toLowerCase() === username.toLowerCase());
  if (idx === -1) return res.status(404).json({ ok: false, message: "User topilmadi" });

  users[idx].password = newPassword;
  saveUsers(users);

  return res.json({ ok: true, message: "Parol yangilandi", user: { username: users[idx].username } });
});

// =================================================
// ✅ ADMIN: DELETE USER
// =================================================
app.delete("/api/admin/users/:username", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const username = String(req.params.username || "").trim();
  if (!username) return res.status(400).json({ ok: false, message: "username kerak" });

  const users = loadUsers();
  const before = users.length;
  const filtered = users.filter(u => String(u.username).toLowerCase() !== username.toLowerCase());
  if (filtered.length === before) {
    return res.status(404).json({ ok: false, message: "User topilmadi" });
  }

  saveUsers(filtered);
  return res.json({ ok: true, message: "User o‘chirildi" });
});

// ===== DEBUG ROUTES =====
app.get("/api/_debug/routes", (req, res) => {
  const routes = app._router.stack
    .filter((r) => r.route)
    .map((r) => ({
      path: r.route.path,
      methods: Object.keys(r.route.methods),
    }));
  res.json(routes);
});

// ===== START =====
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, "0.0.0.0", () => {
  console.log("✅ Server running on port", PORT);
  console.log("✅ USERS_PATH =", USERS_PATH);
  console.log("✅ WEB_PATH =", WEB_PATH);
  console.log("✅ NODE_ENV =", process.env.NODE_ENV);
});
