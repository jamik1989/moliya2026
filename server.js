// server.js (Railway uchun tayyor, to'liq)
// Eslatma: bu faylni endi repo ROOT ga qo'ying: ABC/server.js
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

// users.json endi server.js yonida (repo rootda) turadi
const USERS_PATH = path.join(__dirname, "users.json");

// ===== env/config =====
// Railway: FRONTEND_ORIGIN ni frontend URL ga qo'ying (misol: https://xxx.up.railway.app)
// Agar bir nechta bo'lsa, vergul bilan ajrating:
// FRONTEND_ORIGIN="https://a.app,https://b.app"
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5500";
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
  // requests from tools / server-side without Origin header
  if (!origin) return true;

  const allow = String(FRONTEND_ORIGIN)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // exact match
  return allow.includes(origin);
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
// Railway (https) uchun: secure=true + sameSite=none bo'lishi kerak
app.use(
  session({
    name: "dash_sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd, // prod:https => true
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
  })
);

// ===== ROUTES =====
app.get("/health", (req, res) => res.json({ ok: true }));

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

// =================================================
// 🔐 CHANGE PASSWORD (USER O'ZI UCHUN)
// =================================================
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
    return res
      .status(400)
      .json({ ok: false, message: "Yangi parol eski parol bilan bir xil bo‘lmasin" });
  }

  const users = loadUsers();
  const idx = users.findIndex((u) => String(u.username) === username);

  if (idx === -1) {
    return res.status(404).json({ ok: false, message: "Foydalanuvchi topilmadi" });
  }

  if (String(users[idx].password) !== oldPassword) {
    return res.status(400).json({ ok: false, message: "Eski parol noto‘g‘ri" });
  }

  users[idx].password = newPassword;
  saveUsers(users);

  return res.json({ ok: true, message: "Parol muvaffaqiyatli o‘zgartirildi" });
});

// =================================================
// ✅ ADMIN RESET PASSWORD (ADMIN KEY BILAN)
// =================================================
app.post("/api/admin/reset-password", (req, res) => {
  const adminKey = String(req.headers["x-admin-key"] || "");
  if (adminKey !== ADMIN_RESET_KEY) {
    return res.status(403).json({ ok: false, message: "Admin key xato" });
  }

  const username = String(req.body?.username || "").trim();
  const newPassword = String(req.body?.newPassword || "");

  if (!username) return res.status(400).json({ ok: false, message: "username kerak" });
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ ok: false, message: "newPassword kamida 4 ta bo‘lsin" });
  }

  const users = loadUsers();
  const idx = users.findIndex(
    (u) => String(u.username).toLowerCase() === username.toLowerCase()
  );

  if (idx === -1) {
    return res.status(404).json({ ok: false, message: "User topilmadi" });
  }

  users[idx].password = newPassword;
  saveUsers(users);

  return res.json({
    ok: true,
    message: "Parol yangilandi",
    user: { username: users[idx].username },
  });
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
// Railway: PORT beradi. Listen 0.0.0.0 bo'lishi shart.
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, "0.0.0.0", () => {
  console.log("✅ Auth server running on port", PORT);
  console.log("✅ FRONTEND_ORIGIN =", FRONTEND_ORIGIN);
  console.log("✅ USERS_PATH =", USERS_PATH);
  console.log("✅ NODE_ENV =", process.env.NODE_ENV);
});
