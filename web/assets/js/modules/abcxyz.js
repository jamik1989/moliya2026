// web/assets/js/modules/abcxyz.js
(() => {
  "use strict";

  console.log("✅ ABC-XYZ modul yuklandi. XLSX:", typeof XLSX !== "undefined");

  const STORAGE_KEY = "abcxyz_state_v1";

  // ==================== STATE ====================
  let productsDashboard = [];
  let currentFilter = "ALL";
  let currentPeriod = "all";
  let dateRange = { start: null, end: null };

  // ==================== HELPERS ====================
  const $ = (id) => document.getElementById(id);

  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  function safeInt(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }

  // 1 234 567 format + M (mln) / B (mlrd)
  function formatMoney(amount) {
    const a = safeNum(amount);
    const abs = Math.abs(a);

    if (abs >= 1_000_000_000) return (a / 1_000_000_000).toFixed(2) + "B";
    if (abs >= 1_000_000) return (a / 1_000_000).toFixed(2) + "M";

    // 6-7 xonali sonlar uchun 1 234 567 ko‘rinish
    return new Intl.NumberFormat("uz-UZ", {
      maximumFractionDigits: 0,
      useGrouping: true
    }).format(a);
  }

  function formatDateForDisplay(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "Noma'lum";
    return date.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function parseExcelDate(dateValue) {
    if (dateValue === null || dateValue === undefined || dateValue === "") return null;

    if (typeof dateValue === "number") {
      const excelEpoch = new Date(1899, 11, 30);
      const millisecondsPerDay = 24 * 60 * 60 * 1000;
      return new Date(excelEpoch.getTime() + (dateValue - 1) * millisecondsPerDay);
    }

    if (typeof dateValue === "string") {
      const s = dateValue.trim();

      const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dotMatch) {
        return new Date(parseInt(dotMatch[3], 10), parseInt(dotMatch[2], 10) - 1, parseInt(dotMatch[1], 10));
      }

      const dashMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (dashMatch) {
        return new Date(parseInt(dashMatch[1], 10), parseInt(dashMatch[2], 10) - 1, parseInt(dashMatch[3], 10));
      }

      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
      return null;
    }

    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) return dateValue;
    return null;
  }

  function isDateInRange(date, startDate, endDate) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    const s = new Date(startDate); s.setHours(0, 0, 0, 0);
    const e = new Date(endDate); e.setHours(0, 0, 0, 0);
    return d.getTime() >= s.getTime() && d.getTime() <= e.getTime();
  }

  function updateTimestampABC() {
    const el = $("timestamp");
    if (!el) return;
    const now = new Date();
    const timeString = now.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", hour12: false });
    const dateString = now.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
    el.innerHTML = `<i class="far fa-clock"></i> Oxirgi yangilanish: ${timeString} ${dateString}`;
  }

  function updateLegendHeader() {
    const catEl = $("abcCurrentCategory");
    if (catEl) catEl.textContent = currentFilter || "ALL";
  }

  // ==================== PERSIST ====================
  function saveABCState() {
    try {
      const payload = {
        v: 1,
        savedAt: Date.now(),
        currentFilter,
        currentPeriod,
        dateRange,
        productsDashboard: productsDashboard.map(p => ({
          name: p.name,
          cost: p.cost,
          price: p.price,
          sold: p.sold,
          stock: p.stock,
          profit: p.profit,
          abc: p.abc,
          xyz: p.xyz,
          category: p.category,
          profitShare: p.profitShare,
          date: p.date ? new Date(p.date).toISOString() : null,
          dateValue: p.dateValue ?? null
        }))
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("ABC save error:", e);
    }
  }

  function loadABCState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const payload = JSON.parse(raw);
      if (!payload || payload.v !== 1) return false;

      currentFilter = payload.currentFilter || "ALL";
      currentPeriod = payload.currentPeriod || "all";
      dateRange = payload.dateRange || { start: null, end: null };

      productsDashboard = Array.isArray(payload.productsDashboard)
        ? payload.productsDashboard.map(p => ({
          ...p,
          date: p.date ? new Date(p.date) : null,
          original: p.original || null
        }))
        : [];

      const fileInfo = $("fileInfo");
      if (fileInfo && productsDashboard.length) {
        fileInfo.innerHTML = `<span class="success"><i class="fas fa-check-circle"></i> Oxirgi natija tiklandi</span>`;
      }

      return productsDashboard.length > 0;
    } catch (e) {
      console.warn("ABC load error:", e);
      return false;
    }
  }

  // ✅ HARD RESET (yangi Excel yuklanganda eskisi qolmasin)
  function hardResetABCState() {
    productsDashboard = [];
    currentFilter = "ALL";
    currentPeriod = "all";
    dateRange = { start: null, end: null };

    // UI tozalash
    const table = $("productsTable");
    const tableBody = $("tableBody");
    const emptyState = $("emptyState");
    const statsRow = $("statsRow");
    const categoryFilters = $("categoryFilters");
    const periodFilters = $("periodFilters");
    const datePicker = $("datePicker");

    if (statsRow) statsRow.innerHTML = "";
    if (categoryFilters) categoryFilters.innerHTML = "";
    if (periodFilters) periodFilters.innerHTML = "";
    if (datePicker) datePicker.style.display = "none";

    if (tableBody) tableBody.innerHTML = "";
    if (table) table.style.display = "none";
    if (emptyState) {
      emptyState.style.display = "block";
      emptyState.innerHTML = `
        <i class="fas fa-database"></i>
        <h3>Ma'lumotlar mavjud emas</h3>
        <p>Excel fayl yuklang</p>
      `;
    }

    const countEl = $("abcProductCount");
    if (countEl) countEl.textContent = "0";
    updateLegendHeader();
    updateTimestampABC();

    saveABCState();
  }

  // ==================== FILTERS ====================
  function getFilteredProductsByPeriodOnlyABC() {
    let filteredProducts = productsDashboard;
    if (currentPeriod !== "all") {
      const today = new Date();
      let startDate;
      let endDate = today;

      switch (currentPeriod) {
        case "month":   startDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()); break;
        case "quarter": startDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()); break;
        case "year":    startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()); break;
        case "custom":
          if (dateRange.start && dateRange.end) {
            startDate = new Date(dateRange.start);
            endDate = new Date(dateRange.end);
          }
          break;
      }

      if (startDate && endDate) {
        filteredProducts = filteredProducts.filter(p => isDateInRange(p.date, startDate, endDate));
      }
    }
    return filteredProducts;
  }

  function getFilteredProductsABC() {
    let filteredProducts = productsDashboard;

    if (currentFilter !== "ALL") {
      filteredProducts = filteredProducts.filter(p => p.category === currentFilter);
    }

    if (currentPeriod !== "all") {
      const today = new Date();
      let startDate;
      let endDate = today;

      switch (currentPeriod) {
        case "month":   startDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()); break;
        case "quarter": startDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()); break;
        case "year":    startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()); break;
        case "custom":
          if (dateRange.start && dateRange.end) {
            startDate = new Date(dateRange.start);
            endDate = new Date(dateRange.end);
          }
          break;
      }

      if (startDate && endDate) {
        filteredProducts = filteredProducts.filter(p => isDateInRange(p.date, startDate, endDate));
      }
    }

    return filteredProducts;
  }

  // ==================== UI UPDATES ====================
  function updateStatsABC() {
    const statsRow = $("statsRow");
    if (!statsRow) return;

    const filteredProducts = getFilteredProductsABC();
    const totalProducts = filteredProducts.length;
    const totalProfit = filteredProducts.reduce((sum, p) => sum + safeNum(p.profit), 0);

    const axProducts = filteredProducts.filter(p => p.category === "AX");
    const axProfit = axProducts.reduce((sum, p) => sum + safeNum(p.profit), 0);

    const czProducts = filteredProducts.filter(p => p.category === "CZ");
    const czProfit = czProducts.reduce((sum, p) => sum + safeNum(p.profit), 0);

    const aProducts = filteredProducts.filter(p => p.abc === "A");
    const aProfit = aProducts.reduce((sum, p) => sum + safeNum(p.profit), 0);

    statsRow.innerHTML = `
      <div class="stat-card">
        <div class="dashboard-stat-label">Jami Mahsulotlar</div>
        <div class="dashboard-stat-value">${totalProducts}</div>
        <div class="stat-subtext">ta mahsulot</div>
      </div>

      <div class="stat-card">
        <div class="dashboard-stat-label">Jami Foyda</div>
        <div class="dashboard-stat-value">${formatMoney(totalProfit)}</div>
        <div class="stat-subtext">so'm</div>
      </div>

      <div class="stat-card">
        <div class="dashboard-stat-label">Oltin Fond (AX)</div>
        <div class="dashboard-stat-value">${axProducts.length}</div>
        <div class="stat-subtext">${formatMoney(axProfit)} so'm</div>
      </div>

      <div class="stat-card">
        <div class="dashboard-stat-label">O'lik Yuk (CZ)</div>
        <div class="dashboard-stat-value">${czProducts.length}</div>
        <div class="stat-subtext">${formatMoney(czProfit)} so'm</div>
      </div>

      <div class="stat-card">
        <div class="dashboard-stat-label">Yuqori Daromadli (A)</div>
        <div class="dashboard-stat-value">${aProducts.length}</div>
        <div class="stat-subtext">${formatMoney(aProfit)} so'm</div>
      </div>
    `;
  }

  function updateFiltersABC() {
    const categoryFilters = $("categoryFilters");
    if (!categoryFilters) return;

    const categories = ["ALL", "AX", "AY", "AZ", "BX", "BY", "BZ", "CX", "CY", "CZ"];
    const periodFilteredProducts = getFilteredProductsByPeriodOnlyABC();

    categoryFilters.innerHTML = categories.map(cat => {
      const count = cat === "ALL"
        ? periodFilteredProducts.length
        : periodFilteredProducts.filter(p => p.category === cat).length;

      return `
        <button class="category-btn ${currentFilter === cat ? "active" : ""}" data-category="${cat}">
          <div class="category-name">${cat === "ALL" ? "Hammasi" : cat}</div>
          <div class="category-count">${count} mahsulot</div>
        </button>
      `;
    }).join("");

    document.querySelectorAll(".category-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        currentFilter = btn.getAttribute("data-category") || "ALL";
        updateLegendHeader();
        saveABCState();
        updateFiltersABC();
        updateTableABC();
        updateStatsABC();
      });
    });
  }

  function updateTableABC() {
    const table = $("productsTable");
    const tableBody = $("tableBody");
    const emptyState = $("emptyState");
    if (!table || !tableBody || !emptyState) return;

    const filteredProducts = getFilteredProductsABC();

    const countEl = $("abcProductCount");
    if (countEl) countEl.textContent = String(filteredProducts.length);

    updateLegendHeader();

    if (filteredProducts.length === 0) {
      table.style.display = "none";
      emptyState.style.display = "block";
      emptyState.innerHTML = `
        <i class="fas fa-filter"></i>
        <h3>Filtr natijasi</h3>
        <p>Tanlangan filtr bo'yicha mahsulot topilmadi</p>
      `;
      return;
    }

    tableBody.innerHTML = filteredProducts.map(p => `
      <tr>
        <td><strong>${String(p.name)}</strong></td>
        <td>${formatMoney(p.cost)}</td>
        <td>${formatMoney(p.price)}</td>
        <td>${safeInt(p.sold)} dona</td>
        <td><span class="highlight">${formatMoney(p.profit)}</span></td>
        <td><span class="highlight">${p.abc}</span></td>
        <td><span class="highlight">${p.xyz}</span></td>
        <td><span class="category-badge category-${p.category}">${p.category}</span></td>
        <td>${formatDateForDisplay(p.date)}</td>
      </tr>
    `).join("");

    table.style.display = "table";
    emptyState.style.display = "none";
  }

  function updateDashboardABC() {
    updateStatsABC();
    updateFiltersABC();
    updateTableABC();
    updateLegendHeader();
  }

  // ==================== PERIOD UI ====================
  function setupPeriodFiltersABC() {
    const periodFilters = $("periodFilters");
    const datePicker = $("datePicker");
    const applyDateRangeBtn = $("applyDateRange");
    const startDateInput = $("startDate");
    const endDateInput = $("endDate");

    if (!periodFilters) return;

    periodFilters.innerHTML = `
      <button class="period-btn ${currentPeriod === "all" ? "active" : ""}" data-period="all" type="button">
        <div class="period-icon"><i class="fas fa-infinity"></i></div>
        <div class="period-name">Hammasi</div>
      </button>

      <button class="period-btn ${currentPeriod === "month" ? "active" : ""}" data-period="month" type="button">
        <div class="period-icon"><i class="fas fa-calendar-week"></i></div>
        <div class="period-name">Oxirgi oy</div>
      </button>

      <button class="period-btn ${currentPeriod === "quarter" ? "active" : ""}" data-period="quarter" type="button">
        <div class="period-icon"><i class="fas fa-calendar-alt"></i></div>
        <div class="period-name">Oxirgi kvartal</div>
      </button>

      <button class="period-btn ${currentPeriod === "year" ? "active" : ""}" data-period="year" type="button">
        <div class="period-icon"><i class="fas fa-calendar"></i></div>
        <div class="period-name">Oxirgi yil</div>
      </button>

      <button class="period-btn ${currentPeriod === "custom" ? "active" : ""}" data-period="custom" type="button">
        <div class="period-icon"><i class="fas fa-calendar-day"></i></div>
        <div class="period-name">Maxsus davr</div>
      </button>
    `;

    if (datePicker) datePicker.style.display = (currentPeriod === "custom") ? "flex" : "none";

    if (currentPeriod === "custom") {
      if (startDateInput && dateRange.start) startDateInput.value = dateRange.start;
      if (endDateInput && dateRange.end) endDateInput.value = dateRange.end;
    }

    document.querySelectorAll(".period-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        currentPeriod = btn.getAttribute("data-period") || "all";

        if (currentPeriod === "custom") {
          if (datePicker) datePicker.style.display = "flex";

          if (startDateInput && endDateInput && (!startDateInput.value || !endDateInput.value)) {
            const today = new Date();
            const weekAgo = new Date();
            weekAgo.setDate(today.getDate() - 7);
            startDateInput.valueAsDate = weekAgo;
            endDateInput.valueAsDate = today;
          }

          dateRange.start = startDateInput ? startDateInput.value : null;
          dateRange.end = endDateInput ? endDateInput.value : null;
        } else {
          if (datePicker) datePicker.style.display = "none";
          dateRange.start = null;
          dateRange.end = null;
        }

        saveABCState();
        updateTableABC();
        updateStatsABC();
        updateFiltersABC();
      });
    });

    if (applyDateRangeBtn) {
      applyDateRangeBtn.addEventListener("click", () => {
        dateRange.start = startDateInput ? startDateInput.value : null;
        dateRange.end = endDateInput ? endDateInput.value : null;

        document.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
        const customBtn = document.querySelector('.period-btn[data-period="custom"]');
        if (customBtn) customBtn.classList.add("active");
        currentPeriod = "custom";

        saveABCState();
        updateTableABC();
        updateStatsABC();
        updateFiltersABC();
      });
    }
  }

  // ==================== DATA PROCESS ====================
  function processDataDashboard(data) {
    productsDashboard = data.map(item => {
      const productName =
        item["Mahsulot Nomi"] || item["Mahsulot nomi"] || item["Mahsulot"] || item["Nomi"] ||
        item["Товар"] || item["Товар номи"] || "Noma'lum";

      const cost = safeNum(item["Tannarx"] ?? item["Tannarxi"] ?? item["Cost"] ?? item["Себестоимость"] ?? item["Narx"] ?? 0);
      const price = safeNum(item["Sotish Narxi"] ?? item["Sotish narxi"] ?? item["Price"] ?? item["Продажа"] ?? item["Sotish"] ?? 0);
      const sold = safeInt(item["Sotilgan"] ?? item["Sold"] ?? item["Miqdori"] ?? item["Количество"] ?? item["Qty"] ?? 0);
      const stock = safeInt(item["Ombor qoldigi"] ?? item["Ombor qoldiq"] ?? item["Qoldiq"] ?? item["Остаток"] ?? item["Stock"] ?? 0);

      const dateValue = item["Sana"] || item["Date"] || item["Sotish Sana"] || item["Sotish sanasi"] || item["Дата"] || null;
      const date = parseExcelDate(dateValue);

      const profit = (price - cost) * sold;

      return {
        name: String(productName),
        cost,
        price,
        sold,
        stock,
        profit,
        dateValue,
        date,
        original: item,
        abc: "C",
        xyz: "Z",
        category: "CZ",
        profitShare: 0,
      };
    });

    const totalProfit = productsDashboard.reduce((sum, p) => sum + safeNum(p.profit), 0);
    productsDashboard.forEach(p => {
      p.profitShare = totalProfit > 0 ? (p.profit / totalProfit) * 100 : 0;
    });

    const sortedByProfit = [...productsDashboard].sort((a, b) => b.profit - a.profit);
    let cumulative = 0;
    sortedByProfit.forEach(p => {
      cumulative += p.profitShare;
      if (cumulative <= 80) p.abc = "A";
      else if (cumulative <= 95) p.abc = "B";
      else p.abc = "C";
    });

    const salesValues = productsDashboard.map(p => safeNum(p.sold));
    const avgSales = salesValues.reduce((a, b) => a + b, 0) / (salesValues.length || 1);

    productsDashboard.forEach(p => {
      const deviation = avgSales ? (Math.abs(p.sold - avgSales) / avgSales) * 100 : 0;
      if (deviation < 20) p.xyz = "X";
      else if (deviation < 50) p.xyz = "Y";
      else p.xyz = "Z";
      p.category = p.abc + p.xyz;
    });

    setupPeriodFiltersABC();
    updateDashboardABC();
    updateTimestampABC();
    saveABCState();
  }

  // ==================== EXCEL TEMPLATE GENERATOR (ABC) ====================
  function downloadABCTemplate() {
    if (typeof XLSX === "undefined") {
      alert("XLSX kutubxonasi topilmadi (cdn ishlamayapti).");
      return;
    }

    const sample = [
      { "Mahsulot Nomi": "SHOHASAR BOOM Apple", "Tannarx": 6000, "Sotish Narxi": 8000, "Sotilgan": 120, "Sana": "2026-01-05" },
      { "Mahsulot Nomi": "SHOHASAR BOOM Mint",  "Tannarx": 5500, "Sotish Narxi": 7500, "Sotilgan": 80,  "Sana": "2026-01-12" },
      { "Mahsulot Nomi": "SHOHASAR BOOM Peach", "Tannarx": 6200, "Sotish Narxi": 9000, "Sotilgan": 50,  "Sana": "2026-01-20" }
    ];

    const ws = XLSX.utils.json_to_sheet(sample, { header: ["Mahsulot Nomi", "Tannarx", "Sotish Narxi", "Sotilgan", "Sana"] });

    // Ustun kengligi (chiroyli)
    ws["!cols"] = [
      { wch: 28 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 12 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ABC_XYZ_Shablon");

    XLSX.writeFile(wb, "ABC_XYZ_Shablon.xlsx");
  }

  // ==================== FILE UPLOAD ====================
  function bindUploadEvents() {
    const uploadBtn = $("uploadBtn");
    const fileInput = $("fileInput");
    const fileInfo = $("fileInfo");
    const emptyState = $("emptyState");
    const loading = $("loading");

    if (!uploadBtn || !fileInput) return;

    uploadBtn.addEventListener("click", () => {
      fileInput.value = ""; // ✅ MUHIM: bir xil nomli fayl qayta yuklansa ham change ishlaydi
      fileInput.click();
    });

    fileInput.addEventListener("change", function (event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      // ✅ eng muhim: yangi fayl bo‘lsa eski natijani tozalaymiz
      hardResetABCState();

      if (fileInfo) {
        fileInfo.innerHTML = `<span class="success"><i class="fas fa-check-circle"></i> ${file.name} yuklandi (${(file.size / 1024).toFixed(1)} KB)</span>`;
      }
      if (emptyState) emptyState.style.display = "none";
      if (loading) loading.style.display = "flex";

      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

          processDataDashboard(jsonData);

          if (loading) loading.style.display = "none";
        } catch (error) {
          console.error("❌ Xato:", error);
          if (loading) loading.style.display = "none";
          if (fileInfo) {
            fileInfo.innerHTML = `<span class="error"><i class="fas fa-exclamation-triangle"></i> Xato: ${error.message}</span>`;
          }
        } finally {
          event.target.value = ""; // ✅ MUHIM: keyingi yuklash uchun
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // ==================== PDF EXPORT (oldingi kabi) ====================
  function bindABCPdf() {
    const btn = $("abcPdfBtn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      if (!productsDashboard || productsDashboard.length === 0) {
        alert("PDF olish uchun avval Excel yuklang (ABC-XYZ natija bo‘lsin).");
        return;
      }
      if (typeof html2pdf === "undefined") {
        alert("html2pdf topilmadi. (user.html da html2pdf.bundle.min.js ulanganini tekshiring)");
        return;
      }

      const el = $("abc-tab");
      const now = new Date();
      const stamp = now.toISOString().slice(0, 10);

      const opt = {
        margin: 10,
        filename: `ABC-XYZ_${stamp}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      };

      await html2pdf().set(opt).from(el).save();
    });
  }

  // ==================== Legend Toggle ====================
  function bindLegendToggle() {
    const toggleBtn = $("abcLegendToggle");
    const body = $("abcLegendText");
    if (!toggleBtn || !body) return;

    toggleBtn.addEventListener("click", () => {
      const hidden = body.classList.toggle("hidden");
      toggleBtn.textContent = hidden ? "Ko‘rsatish" : "Yashirish";
    });
  }

  // ==================== TEMPLATE BTN ====================
  function bindABCTemplateBtn() {
    const btn = $("abcTemplateBtn");
    if (!btn) return;
    btn.addEventListener("click", downloadABCTemplate);
  }

  // ==================== INIT ====================
  document.addEventListener("DOMContentLoaded", () => {
    updateTimestampABC();
    bindUploadEvents();
    bindABCPdf();
    bindLegendToggle();
    bindABCTemplateBtn();

    const restored = loadABCState();
    if (restored) {
      setupPeriodFiltersABC();
      updateDashboardABC();
      updateTimestampABC();
    } else {
      updateLegendHeader();
      const countEl = $("abcProductCount");
      if (countEl) countEl.textContent = "0";
    }

    console.log("🚀 ABC-XYZ modul ishga tushdi!");
  });
})();
