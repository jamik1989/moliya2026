// web/assets/js/core/mapping.js
(() => {
  "use strict";

  const MAP_KEY_ABC = "mapping_abc_v1";
  const MAP_KEY_MONTHLY = "mapping_monthly_v1";

  function saveMap(key, obj) {
    localStorage.setItem(key, JSON.stringify({ v: 1, savedAt: Date.now(), map: obj || {} }));
  }
  function loadMap(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const p = JSON.parse(raw);
      return p?.map || null;
    } catch {
      return null;
    }
  }

  function normalizeHeader(h) {
    return String(h || "").trim().toLowerCase();
  }

  // ===== TEMPLATE DOWNLOAD =====
  function downloadCSV(filename, rows) {
    const csv = rows.map(r => r.map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function ensureTemplateButtons() {
    // ABC template button
    if (!document.getElementById("abcTemplateBtn")) {
      const tab = document.getElementById("abcxyz-tab");
      if (tab) {
        const btn = document.createElement("button");
        btn.id = "abcTemplateBtn";
        btn.className = "period-btn";
        btn.type = "button";
        btn.style.marginLeft = "10px";
        btn.innerHTML = `<div class="period-icon"><i class="fas fa-download"></i></div><div class="period-name">Shablon</div>`;
        btn.addEventListener("click", () => {
          downloadCSV("ABC_XYZ_TEMPLATE.csv", [
            ["Mahsulot Nomi","Tannarx","Sotish Narxi","Sotilgan","Ombor qoldiq","Sana"],
            ["Misol mahsulot","12000","15000","25","100","2026-01-05"]
          ]);
        });

        const periodFilters = document.getElementById("periodFilters");
        if (periodFilters) periodFilters.appendChild(btn);
        else tab.insertBefore(btn, tab.firstChild);
      }
    }

    // Monthly template button
    if (!document.getElementById("monthlyTemplateBtn")) {
      const tab = document.getElementById("monthly-tab");
      if (tab) {
        const btn = document.createElement("button");
        btn.id = "monthlyTemplateBtn";
        btn.className = "period-btn";
        btn.type = "button";
        btn.style.marginLeft = "10px";
        btn.innerHTML = `<div class="period-icon"><i class="fas fa-download"></i></div><div class="period-name">Shablon</div>`;
        btn.addEventListener("click", () => {
          downloadCSV("OYLK_TEMPLATE.csv", [
            ["Sana","Savdo","Tannarx","Xarajat","Nasiya","Qarz"],
            ["2026-01-05","2500000","1800000","250000","400000","700000"]
          ]);
        });

        tab.insertBefore(btn, tab.firstChild);
      }
    }
  }

  // ===== MAPPING WIZARD UI =====
  function createWizard({ title, fields, headers, onApply }) {
    // fields: [{key,label,required}]
    const id = "mapWizardModal";
    const old = document.getElementById(id);
    if (old) old.remove();

    const modal = document.createElement("div");
    modal.id = id;
    modal.style.cssText = `
      position: fixed; inset:0; display:flex; align-items:center; justify-content:center;
      background: rgba(0,0,0,.45); z-index: 9999; padding:16px;
    `;

    const options = headers.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join("");

    modal.innerHTML = `
      <div style="max-width:640px; width:100%; background:#fff; border-radius:16px; padding:18px; box-shadow:0 10px 30px rgba(0,0,0,.2)">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-weight:800; font-size:18px;">${escapeHtml(title)}</div>
          <button id="mwClose" style="border:none;background:#eee;border-radius:10px;padding:6px 10px;cursor:pointer;">✕</button>
        </div>

        <div style="margin-top:10px; font-size:13px; color:#444;">
          Excel ustunlarini moslang. Bir marta moslasangiz, keyin avtomatik ishlaydi.
        </div>

        <div style="margin-top:12px; display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          ${fields.map(f => `
            <div style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:12px; color:#111827; font-weight:700;">
                ${escapeHtml(f.label)} ${f.required ? '<span style="color:#b91c1c">*</span>' : ""}
              </label>
              <select data-mapkey="${escapeHtml(f.key)}" style="padding:10px 12px; border:1px solid #ddd; border-radius:12px;">
                <option value="">— Tanlang —</option>
                ${options}
              </select>
            </div>
          `).join("")}
        </div>

        <div id="mwMsg" style="margin-top:10px; font-size:13px;"></div>

        <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:14px;">
          <button id="mwCancel" style="padding:10px 14px; border:none; background:#e5e7eb; border-radius:12px; cursor:pointer;">Bekor</button>
          <button id="mwApply" style="padding:10px 14px; border:none; background:#111827; color:#fff; border-radius:12px; cursor:pointer;">Saqlash</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector("#mwClose").addEventListener("click", close);
    modal.querySelector("#mwCancel").addEventListener("click", close);

    modal.querySelector("#mwApply").addEventListener("click", () => {
      const selects = Array.from(modal.querySelectorAll("select[data-mapkey]"));
      const map = {};
      for (const sel of selects) {
        const k = sel.getAttribute("data-mapkey");
        map[k] = sel.value || "";
      }

      // validate required
      const missing = fields.filter(f => f.required && !map[f.key]).map(f => f.label);
      const msg = modal.querySelector("#mwMsg");
      if (missing.length) {
        msg.innerHTML = `<span style="color:#b91c1c; font-weight:700;">Majburiy ustun(lar) tanlanmadi: ${escapeHtml(missing.join(", "))}</span>`;
        return;
      }

      onApply(map);
      msg.innerHTML = `<span style="color:green; font-weight:700;">✅ Saqlandi. Endi avtomatik ishlaydi.</span>`;
      setTimeout(close, 500);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ===== APPLY MAPPING to a row =====
  function applyMappingToRows(rows, map) {
    // returns rows with normalized keys
    return rows.map(r => {
      const out = {};
      for (const [targetKey, sourceHeader] of Object.entries(map || {})) {
        if (!sourceHeader) continue;
        out[targetKey] = r[sourceHeader];
      }
      // keep original too
      out.__original = r;
      return out;
    });
  }

  // ===== AUTOMAP (optional quick guess) =====
  function guessMap(headers, dict) {
    // dict: {targetKey:[synonyms]}
    const low = headers.map(h => ({ h, n: normalizeHeader(h) }));
    const map = {};
    for (const [k, syns] of Object.entries(dict)) {
      const found = low.find(x => syns.some(s => x.n.includes(s)));
      if (found) map[k] = found.h;
    }
    return map;
  }

  window.Mapping = {
    // ABC
    getABCMap() { return loadMap(MAP_KEY_ABC); },
    saveABCMap(map) { saveMap(MAP_KEY_ABC, map); },
    // Monthly
    getMonthlyMap() { return loadMap(MAP_KEY_MONTHLY); },
    saveMonthlyMap(map) { saveMap(MAP_KEY_MONTHLY, map); },

    ensureTemplateButtons,

    openABCMWizard(headers, onApply) {
      createWizard({
        title: "ABC-XYZ — Ustunlarni moslash",
        headers,
        fields: [
          { key: "name", label: "Mahsulot nomi", required: true },
          { key: "cost", label: "Tannarx", required: true },
          { key: "price", label: "Sotish narxi", required: true },
          { key: "sold", label: "Sotilgan (qty)", required: true },
          { key: "stock", label: "Ombor qoldiq", required: false },
          { key: "date", label: "Sana", required: false }
        ],
        onApply
      });
    },

    openMonthlyWizard(headers, onApply) {
      createWizard({
        title: "Oylik tahlil — Ustunlarni moslash",
        headers,
        fields: [
          { key: "date", label: "Sana", required: true },
          { key: "sales", label: "Savdo", required: true },
          { key: "cost", label: "Tannarx", required: true },
          { key: "expense", label: "Xarajat", required: false },
          { key: "credit", label: "Nasiya (debitor)", required: false },
          { key: "debt", label: "Qarz (kreditor)", required: false }
        ],
        onApply
      });
    },

    applyMappingToRows,
    guessMap
  };

  document.addEventListener("DOMContentLoaded", () => {
    window.Mapping.ensureTemplateButtons();
  });

})();
