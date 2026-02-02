// web/assets/js/utils/columnMapper.js
// Universal Excel ustunlarini moslashtirish (Sana majburiy)

(function () {
  const LS_KEY = "abcxyz_column_map_v1";

  function norm(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  const FIELD_LABELS = {
    date: "Sana",
    name: "Mahsulot nomi",
    cost: "Tannarx",
    price: "Sotish narxi",
    sold: "Sotilgan",
    stock: "Ombor qoldigi (ixtiyoriy)"
  };

  const FIELD_CANDIDATES = {
    date: [
      "sana", "date", "kun", "data", "дата", "sotish sana", "sotuv sana", "sotish sanasi"
    ],
    name: [
      "mahsulot nomi", "mahsulot", "nomi", "product", "product name", "товар", "наименование", "nomenklatura"
    ],
    cost: [
      "tannarx", "cost", " себестоимость", "kirish narxi", "purchase", "buy price"
    ],
    price: [
      "sotish narxi", "sotish", "price", "sale price", "продажа", "selling price"
    ],
    sold: [
      "sotilgan", "sold", "miqdori", "qty", "quantity", "количество", "dona"
    ],
    stock: [
      "ombor qoldigi", "ombor", "qoldiq", "stock", "остаток", "balance"
    ]
  };

  function guessMap(headers) {
    const map = {};
    const hNorm = headers.map(h => ({ raw: h, n: norm(h) }));

    Object.keys(FIELD_CANDIDATES).forEach((field) => {
      const candidates = FIELD_CANDIDATES[field].map(norm);
      const hit = hNorm.find(h => candidates.includes(h.n));
      if (hit) map[field] = hit.raw;
    });

    return map;
  }

  function loadSavedMap() {
    try {
      const v = localStorage.getItem(LS_KEY);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  }

  function saveMap(map) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  function validateMap(map) {
    // Sana majburiy
    return !!(map && map.date && map.name && map.cost && map.price && map.sold);
  }

  function getHeadersFromRows(rows) {
    const set = new Set();
    rows.forEach(r => Object.keys(r || {}).forEach(k => set.add(k)));
    return Array.from(set);
  }

  // Modal UI
  function openMapperModal(headers, initialMap) {
    const modal = document.getElementById("colmapModal");
    const form = document.getElementById("colmapForm");
    const err = document.getElementById("colmapError");

    if (!modal || !form) {
      throw new Error("Mapper modal HTML topilmadi (colmapModal). user.html ga modal qo‘shing.");
    }

    err.textContent = "";

    const fields = ["date", "name", "cost", "price", "sold", "stock"];
    form.innerHTML = fields.map((f) => {
      const selected = initialMap && initialMap[f] ? initialMap[f] : "";
      const required = (f !== "stock") ? "required" : "";
      const reqStar = (f !== "stock") ? `<span style="color:#e74c3c;">*</span>` : "";
      return `
        <div class="colmap-row">
          <label class="colmap-label">${FIELD_LABELS[f]} ${reqStar}</label>
          <select class="colmap-select" name="${f}" ${required}>
            <option value="">— tanlang —</option>
            ${headers.map(h => `<option value="${escapeHtml(h)}" ${h === selected ? "selected" : ""}>${escapeHtml(h)}</option>`).join("")}
          </select>
        </div>
      `;
    }).join("");

    modal.classList.add("open");

    return new Promise((resolve, reject) => {
      const btnCancel = document.getElementById("colmapCancel");
      const btnSave = document.getElementById("colmapSave");

      const cleanup = () => {
        modal.classList.remove("open");
        btnCancel && btnCancel.removeEventListener("click", onCancel);
        btnSave && btnSave.removeEventListener("click", onSave);
      };

      const onCancel = () => {
        cleanup();
        reject(new Error("Mapping bekor qilindi"));
      };

      const onSave = () => {
        const data = new FormData(form);
        const map = {};
        fields.forEach(f => map[f] = data.get(f) || "");

        if (!validateMap(map)) {
          err.textContent = "Sana, Mahsulot nomi, Tannarx, Sotish narxi, Sotilgan — majburiy. Hammasini tanlang.";
          return;
        }

        saveMap(map);
        cleanup();
        resolve(map);
      };

      btnCancel && btnCancel.addEventListener("click", onCancel);
      btnSave && btnSave.addEventListener("click", onSave);
    });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Rows -> unified rows
  function mapRows(rows, map) {
    return rows.map((r) => ({
      Sana: r[map.date],
      "Mahsulot Nomi": r[map.name],
      Tannarx: r[map.cost],
      "Sotish Narxi": r[map.price],
      Sotilgan: r[map.sold],
      "Ombor qoldigi": map.stock ? r[map.stock] : undefined
    }));
  }

  // Public API
  window.ColumnMapper = {
    getHeadersFromRows,
    guessMap,
    loadSavedMap,
    validateMap,
    openMapperModal,
    mapRows
  };
})();
