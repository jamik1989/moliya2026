// web/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API_BASE ni Railway env dan olamiz
// Backend deploy bo'lgach, uning public URL ini shu yerga qo'yasiz.
const API_BASE = process.env.API_BASE || "http://127.0.0.1:3000";

// Static: web papkani o'zi
app.use(express.static(__dirname, { extensions: ["html"] }));

// Config endpoint: brauzer uchun
app.get("/config.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.end(`window.API_BASE = ${JSON.stringify(API_BASE)};`);
});

// Root => login
app.get("/", (req, res) => {
  res.redirect("/pages/login.html");
});

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, "0.0.0.0", () => {
  console.log("✅ Frontend running on port", PORT);
  console.log("✅ API_BASE =", API_BASE);
});
