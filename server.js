// server.js (ROOTDA) — Admin login + Admin panel (session) + Users CRUD
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

const USERS_PATH = path.join(__dirname, "users.json");
const WEB_PATH = path.join(__dirname, "web");
const PAGES_PATH = path.join(WEB_PATH, "pages");

// ===== env/config =====
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "change_me_secret";
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

function originAllowed(origin) {
  if (!origin) return true;
  if (!FRONTEND_ORIGIN) return true;

  const allow = String(FRONTEND_ORIGIN)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  return allow.includes(origin);
}

function isValidUsername(u) {
  if (!u) return false;
  if (u.length < 2 || u.length > 50) return false;
  return /^[a-zA-Z0-9_.-]+$/.test(u);
}

function normalizePhone(p) {
  const s = String(p || "").trim();
  return s.replace(/[^\d+]/g, "");
}

function isUserAuthed(req) {
  return Boolean(req.session?.user?.username);
}

function isAdminAuthed(req) {
  return Boolean(req.session?.admin?.username);
}

function requireAdmin(req, res) {
  if (!isAdminAuthed(req)) {
    res.status(401).json({ ok: false, message: "Admin login qiling" });
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
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
  })
);

// ===== FRONTEND SERVE =====
app.use(express.static(WEB_PATH));

app.get("/", (req, res) => res.sendFile(path.join(PAGES_PATH, "login.html")));
app.get("/pages/login", (req, res) => res.sendFile(path.join(PAGES_PATH, "login.html")));
app.get("/pages/user", (req, res) => res.sendFile(path.join(PAGES_PATH, "user.html")));
app.get("/pages/admin", (req, res) => res.sendFile(path.join(PAGES_PATH, "admin.html")));

app.get("/health", (req, res) => res.json({ ok: true }));

// =======================================
// ✅ USER LOGIN (oddiy user)
// =======================================
app.post("/api/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: "Login va parol majburiy" });
  }

  const users = loadUsers();
  const user = users.find(u => String(u.username) === username && String(u.role || "") !== "admin");

  if (!user || String(user.password) !== password) {
    return res.status(401).json({ ok: false, message: "Login yoki parol xato" });
  }

  req.session.user = { username: user.username };
  req.session.save(() => res.json({ ok: true, user: { username: user.username } }));
});

// ===== USER ME =====
app.get("/api/me", (req, res) => {
  if (!isUserAuthed(req)) return res.status(401).json({ ok: false });
  return res.json({ ok: true, user: req.session.user });
});

// ===== USER LOGOUT =====
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("dash_sid");
    res.json({ ok: true });
  });
});

// ===== USER CHANGE PASSWORD =====
app.post("/api/change-password", (req, res) => {
  if (!isUserAuthed(req)) {
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
  const idx = users.findIndex(u => String(u.username) === username && String(u.role || "") !== "admin");
  if (idx === -1) return res.status(404).json({ ok: false, message: "Foydalanuvchi topilmadi" });

  if (String(users[idx].password) !== oldPassword) {
    return res.status(400).json({ ok: false, message: "Eski parol noto‘g‘ri" });
  }

  users[idx].password = newPassword;
  saveUsers(users);

  return res.json({ ok: true, message: "Parol muvaffaqiyatli o‘zgartirildi" });
});

// =======================================
// ✅ ADMIN LOGIN (alohida)
// =======================================
app.post("/api/admin/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: "Admin login va parol majburiy" });
  }

  const users = loadUsers();
  const admin = users.find(u => String(u.username) === username && String(u.role || "") === "admin");

  if (!admin || String(admin.password) !== password) {
    return res.status(401).json({ ok: false, message: "Admin login yoki parol xato" });
  }

  req.session.admin = { username: admin.username };
  req.session.save(() => res.json({ ok: true, admin: { username: admin.username } }));
});

// ===== ADMIN ME =====
app.get("/api/admin/me", (req, res) => {
  if (!isAdminAuthed(req)) return res.status(401).json({ ok: false });
  return res.json({ ok: true, admin: req.session.admin });
});

// ===== ADMIN LOGOUT =====
app.post("/api/admin/logout", (req, res) => {
  // faqat admin sessiyani o'chiramiz
  delete req.session.admin;
  req.session.save(() => res.json({ ok: true }));
});

// =======================================
// ✅ ADMIN: USERS LIST (username/password/phone)
// =======================================
app.get("/api/admin/users", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const users = loadUsers()
    .filter(u => String(u.role || "") !== "admin") // adminni jadvalga qo'shmaymiz
    .map(u => ({
      username: String(u.username || ""),
      password: String(u.password || ""),
      phone: String(u.phone || "")
    }));

  return res.json({ ok: true, users });
});

// =======================================
// ✅ ADMIN: CREATE USER (admin paneldan)
// =======================================
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
  const exists = users.find(u => String(u.username).toLowerCase() === username.toLowerCase());
  if (exists) return res.status(409).json({ ok: false, message: "Bu username allaqachon bor" });

  users.push({ username, password, phone });
  saveUsers(users);

  return res.json({ ok: true, message: "User qo‘shildi" });
});

// =======================================
// ✅ ADMIN: RESET USER PASSWORD
// =======================================
app.post("/api/admin/reset-password", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const username = String(req.body?.username || "").trim();
  const newPassword = String(req.body?.newPassword || "");

  if (!username) return res.status(400).json({ ok: false, message: "username kerak" });
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ ok: false, message: "newPassword kamida 4 ta bo‘lsin" });
  }

  const users = loadUsers();
  const idx = users.findIndex(u => String(u.username).toLowerCase() === username.toLowerCase() && String(u.role || "") !== "admin");
  if (idx === -1) return res.status(404).json({ ok: false, message: "User topilmadi" });

  users[idx].password = newPassword;
  saveUsers(users);

  return res.json({ ok: true, message: "Parol yangilandi", user: { username: users[idx].username } });
});

// =======================================
// ✅ ADMIN: DELETE USER
// =======================================
app.delete("/api/admin/users/:username", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const username = String(req.params.username || "").trim();
  if (!username) return res.status(400).json({ ok: false, message: "username kerak" });

  const users = loadUsers();
  const before = users.length;

  const filtered = users.filter(u => {
    const isSame = String(u.username).toLowerCase() === username.toLowerCase();
    const isAdmin = String(u.role || "") === "admin";
    // adminni hech qachon o'chirmaymiz
    if (isSame && !isAdmin) return false;
    return true;
  });

  if (filtered.length === before) {
    return res.status(404).json({ ok: false, message: "User topilmadi" });
  }

  saveUsers(filtered);
  return res.json({ ok: true, message: "User o‘chirildi" });
});

// ===== START =====
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, "0.0.0.0", () => {
  console.log("✅ Server running on port", PORT);
  console.log("✅ USERS_PATH =", USERS_PATH);
  console.log("✅ WEB_PATH =", WEB_PATH);
  console.log("✅ NODE_ENV =", process.env.NODE_ENV);
});
