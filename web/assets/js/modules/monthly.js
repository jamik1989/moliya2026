/* =========================================================================
monthly.js — Oylik tahlil (Savdo / Foyda / Xarajat / Nasiya / Qarz)

PUL FORMAT FIX:
  - K/M/B harflari yo'q
  - 1 234 567 so'm (to'liq)
  - 1.25 mln so'm / 1.25 mlrd so'm (qisqa)
  - Chart y-ticks ham pul formatda

FIX: Yangi Excel yuklanganda eski state/filter qolib ketmasin -> HARD RESET.
Grafik: compare = Savdo+Foyda+Cashflow bitta grafikda.
ADD:
  - Excel shablon generator (monthlyTemplateBtn bo'lsa ishlaydi)
  - Brendli PDF (logo + ranglar) window.DASH_BRAND orqali
========================================================================= */
(() => {
  "use strict";

  const STORAGE_KEY = "monthly_state_v1";

  // ===== Brand config (PDF uchun) =====
  const BRAND = (() => {
    const b = (window.DASH_BRAND && typeof window.DASH_BRAND === "object") ? window.DASH_BRAND : {};
    return {
      name: b.name || "Hisobot",
      primary: b.primary || "#1f2937",
      accent: b.accent || "#111827",
      logoUrl: b.logoUrl || "",
    };
  })();

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);

  // ✅ Common Money Formatter (window.FMT bo'lsa ishlatadi, bo'lmasa fallback)
  const F = (() => {
    if (window.FMT && typeof window.FMT.formatUZS === "function") return window.FMT;

    const nfFull = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
    const nf2 = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const toNum = (v) => {
      if (v === null || v === undefined) return 0;
      if (typeof v === "number") return Number.isFinite(v) ? v : 0;

      let s = String(v).trim();
      if (!s) return 0;

      s = s.replace(/\s+/g, "");
      // 1,234.56 -> 1234.56, 1 234,56 -> 1234.56
      if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
      else if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
      s = s.replace(/[^\d.-]/g, "");

      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    };

    const formatUZS = (value) => {
      const n = toNum(value);
      const sign = n < 0 ? "-" : "";
      const abs = Math.abs(n);
      return `${sign}${nfFull.format(abs)} so'm`;
    };

    const formatUZSShort = (value) => {
      const n = toNum(value);
      const sign = n < 0 ? "-" : "";
      const abs = Math.abs(n);

      const billion = 1_000_000_000;
      const million = 1_000_000;
      const thousand = 1_000;

      if (abs >= billion) return `${sign}${nf2.format(abs / billion)} mlrd so'm`;
      if (abs >= million) return `${sign}${nf2.format(abs / million)} mln so'm`;
      if (abs >= thousand) return `${sign}${nf2.format(abs / thousand)} ming so'm`;
      return `${sign}${nfFull.format(abs)} so'm`;
    };

    const formatNum = (value) => nfFull.format(toNum(value));

    return { toNum, formatUZS, formatUZSShort, formatNum, formatPct: (v) => `${nf2.format(toNum(v))}%` };
  })();

  function toNumber(v) { return F.toNum(v); }

  function parseExcelDate(val) {
    if (val === null || val === undefined || val === "") return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;

    if (typeof val === "number") {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(epoch.getTime() + val * 86400000);
      return isNaN(d.getTime()) ? null : d;
    }

    if (typeof val === "string") {
      const s = val.trim();
      if (!s) return null;

      const m1 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (m1) {
        const d = new Date(Number(m1[3]), Number(m1[2]) - 1, Number(m1[1]));
        return isNaN(d.getTime()) ? null : d;
      }

      const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (m2) {
        const d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
        return isNaN(d.getTime()) ? null : d;
      }

      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }

    return null;
  }

  function monthKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function pick(row, candidates) {
    for (const c of candidates) {
      if (Object.prototype.hasOwnProperty.call(row, c)) return row[c];
    }
    const keys = Object.keys(row);
    const lowerMap = new Map(keys.map((k) => [k.toLowerCase(), k]));
    for (const c of candidates) {
      const k = lowerMap.get(String(c).toLowerCase());
      if (k) return row[k];
    }
    return undefined;
  }

  function fmt2(n) { return String(n).padStart(2, "0"); }
  function stamp() {
    const d = new Date();
    return `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}-${fmt2(d.getDate())}_${fmt2(d.getHours())}${fmt2(d.getMinutes())}`;
  }

  // ---------- DOM ----------
  const monthlyUploadBtn = $("monthlyUploadBtn");
  const monthlyFileInput = $("monthlyFileInput");
  const monthlyFileInfo = $("monthlyFileInfo");
  const warningsBox = $("monthlyWarningsBox");
  const warningsText = $("monthlyWarningsText");
  const monthlyStatsRow = $("monthlyStatsRow");
  const startMonthEl = $("monthlyStartMonth");
  const endMonthEl = $("monthlyEndMonth");
  const applyRangeBtn = $("monthlyApplyRange");
  const chartCanvas = $("monthlyChart");
  const monthlyEmptyState = $("monthlyEmptyState");
  const monthlyTable = $("monthlyTable");
  const monthlyTableBody = $("monthlyTableBody");
  const monthlyTimestamp = $("monthlyTimestamp");
  const monthlyPdfBtn = $("monthlyPdfBtn");
  const monthlyTemplateBtn = $("monthlyTemplateBtn");

  if (!monthlyUploadBtn || !monthlyFileInput) return;

  // ---------- State ----------
  let monthlyRows = [];
  let monthlyAgg = [];
  let currentMetric = "compare"; // compare | sales | profit | cashflow
  let chartInstance = null;

  const COLS = {
    date: ["Sana", "Дата", "Date", "Sotish Sana", "Sana (Date)"],
    sales: ["Savdo", "Kassa", "Revenue", "Tushum", "Aylanma", "Sales"],
    cost: ["Tannarx", "Cost", "Xarid", "COST", "Tovar Tannarxi"],
    expense: ["Xarajat", "Harajat", "Expense", "Expenses", "Operatsion xarajat", "Doimiy Xarajat", "Sotuv harajati"],
    credit: ["Nasiya", "Nasiya (mijoz)", "Debitor", "Debitor qarz", "Receivable", "Receivables"],
    debt: ["Qarz", "Qarz (taminotchi)", "Kreditor", "Kreditor qarz", "Payable", "Payables"]
  };

  // ---------- Persist ----------
  function saveMonthlyState() {
    try {
      const payload = {
        v: 1,
        savedAt: Date.now(),
        currentMetric,
        startMonth: startMonthEl?.value || "",
        endMonth: endMonthEl?.value || "",
        monthlyAgg
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("Monthly save error:", e);
    }
  }

  function loadMonthlyState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const payload = JSON.parse(raw);
      if (!payload || payload.v !== 1) return false;

      currentMetric = payload.currentMetric || "compare";
      monthlyAgg = Array.isArray(payload.monthlyAgg) ? payload.monthlyAgg : [];
      monthlyRows = [];

      if (startMonthEl && payload.startMonth) startMonthEl.value = payload.startMonth;
      if (endMonthEl && payload.endMonth) endMonthEl.value = payload.endMonth;

      const wrap = document.getElementById("monthly-tab");
      if (wrap) {
        wrap.querySelectorAll('.period-btn[data-metric]').forEach((b) => {
          b.classList.toggle("active", (b.getAttribute("data-metric") || "") === currentMetric);
        });
      }

      if (monthlyFileInfo && monthlyAgg.length) {
        monthlyFileInfo.innerHTML = `<span class="success"><i class="fas fa-check-circle"></i> Oxirgi natija tiklandi</span>`;
      }

      return monthlyAgg.length > 0;
    } catch (e) {
      console.warn("Monthly load error:", e);
      return false;
    }
  }

  // ✅ HARD RESET
  function hardResetMonthlyState() {
    monthlyRows = [];
    monthlyAgg = [];

    if (startMonthEl) startMonthEl.value = "";
    if (endMonthEl) endMonthEl.value = "";

    hideWarning();
    renderStats([]);
    renderTable([]);
    buildChart([]);
    setTimestamp();

    saveMonthlyState();
  }

  // ---------- UI ----------
  function showWarning(msg) {
    if (!warningsBox || !warningsText) return;
    warningsBox.style.display = "block";
    warningsText.innerHTML = escapeHtml(msg).replace(/\n/g, "<br>");
  }

  function hideWarning() {
    if (!warningsBox) return;
    warningsBox.style.display = "none";
    if (warningsText) warningsText.textContent = "";
  }

  function setFileInfoOk(name, sizeKb) {
    if (!monthlyFileInfo) return;
    monthlyFileInfo.innerHTML = `<span class="success"><i class="fas fa-check-circle"></i> ${escapeHtml(name)} yuklandi (${sizeKb.toFixed(1)} KB)</span>`;
  }

  function setFileInfoErr(msg) {
    if (!monthlyFileInfo) return;
    monthlyFileInfo.innerHTML = `<span class="error"><i class="fas fa-exclamation-triangle"></i> ${escapeHtml(msg)}</span>`;
  }

  function setTimestamp() {
    if (!monthlyTimestamp) return;
    const now = new Date();
    const time = now.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", hour12: false });
    const date = now.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
    monthlyTimestamp.innerHTML = `<i class="far fa-clock"></i> Oxirgi yangilanish: ${time} ${date}`;
  }

  function renderStats(aggRows) {
    if (!monthlyStatsRow) return;

    const totals = aggRows.reduce(
      (acc, r) => {
        acc.sales += r.sales;
        acc.cost += r.cost;
        acc.expense += r.expense;
        acc.profit += r.profit;
        acc.credit += r.credit;
        acc.debt += r.debt;
        acc.cashflow += r.cashflow;
        acc.lines += r.lines;
        return acc;
      },
      { sales: 0, cost: 0, expense: 0, profit: 0, credit: 0, debt: 0, cashflow: 0, lines: 0 }
    );

    monthlyStatsRow.dataset.t_sales = String(totals.sales);
    monthlyStatsRow.dataset.t_profit = String(totals.profit);
    monthlyStatsRow.dataset.t_expense = String(totals.expense);
    monthlyStatsRow.dataset.t_credit = String(totals.credit);
    monthlyStatsRow.dataset.t_debt = String(totals.debt);

    monthlyStatsRow.innerHTML = `
      <div class="stat-card">
        <div class="dashboard-stat-label">Jami Savdo</div>
        <div class="dashboard-stat-value">${F.formatUZSShort(totals.sales)}</div>
        <div class="stat-subtext">${F.formatUZS(totals.sales)}</div>
      </div>

      <div class="stat-card">
        <div class="dashboard-stat-label">Jami Foyda</div>
        <div class="dashboard-stat-value">${F.formatUZSShort(totals.profit)}</div>
        <div class="stat-subtext">${F.formatUZS(totals.profit)}</div>
      </div>

      <div class="stat-card">
        <div class="dashboard-stat-label">Jami Xarajat</div>
        <div class="dashboard-stat-value">${F.formatUZSShort(totals.expense)}</div>
        <div class="stat-subtext">${F.formatUZS(totals.expense)}</div>
      </div>

      <div class="stat-card">
        <div class="dashboard-stat-label">Nasiya (Debitor)</div>
        <div class="dashboard-stat-value">${F.formatUZSShort(totals.credit)}</div>
        <div class="stat-subtext">${F.formatUZS(totals.credit)}</div>
      </div>

      <div class="stat-card">
        <div class="dashboard-stat-label">Qarz (Kreditor)</div>
        <div class="dashboard-stat-value">${F.formatUZSShort(totals.debt)}</div>
        <div class="stat-subtext">${F.formatUZS(totals.debt)}</div>
      </div>
    `;
  }

  function renderTable(aggRows) {
    if (!monthlyTable || !monthlyTableBody || !monthlyEmptyState) return;

    if (!aggRows.length) {
      monthlyTable.style.display = "none";
      monthlyEmptyState.style.display = "block";
      monthlyTableBody.innerHTML = "";
      return;
    }

    monthlyEmptyState.style.display = "none";
    monthlyTable.style.display = "table";

    monthlyTableBody.innerHTML = aggRows.map(r => `
      <tr>
        <td><strong>${escapeHtml(r.month)}</strong></td>
        <td>${F.formatUZS(r.sales)}</td>
        <td>${F.formatUZS(r.cost)}</td>
        <td><span class="highlight">${F.formatUZS(r.profit)}</span></td>
        <td>${F.formatUZS(r.expense)}</td>
        <td>${F.formatUZS(r.credit)}</td>
        <td>${F.formatUZS(r.debt)}</td>
        <td><span class="highlight">${F.formatUZS(r.cashflow)}</span></td>
        <td>${F.formatNum(r.lines)}</td>
      </tr>
    `).join("");
  }

  function buildChart(aggRows) {
    if (!chartCanvas || typeof Chart === "undefined") return;

    const labels = aggRows.map(r => r.month);
    const mkDataset = (label, dataArr, emphasis = false) => ({
      label,
      data: dataArr,
      tension: 0.25,
      fill: false,
      borderWidth: emphasis ? 3 : 2,
      pointRadius: emphasis ? 3 : 2,
      pointHoverRadius: 4,
    });

    let datasets = [];
    let titleText = "";

    if (currentMetric === "compare") {
      datasets = [
        mkDataset("Savdo", aggRows.map(r => r.sales)),
        mkDataset("Foyda", aggRows.map(r => r.profit)),
        mkDataset("Cashflow", aggRows.map(r => r.cashflow)),
      ];
      titleText = "Oylik taqqoslash (Savdo / Foyda / Cashflow)";
    } else if (currentMetric === "sales") {
      datasets = [mkDataset("Savdo", aggRows.map(r => r.sales), true)];
      titleText = "Savdo";
    } else if (currentMetric === "profit") {
      datasets = [mkDataset("Foyda", aggRows.map(r => r.profit), true)];
      titleText = "Foyda";
    } else {
      datasets = [mkDataset("Cashflow", aggRows.map(r => r.cashflow), true)];
      titleText = "Cashflow (Savdo - Tannarx - Xarajat)";
    }

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    chartInstance = new Chart(chartCanvas, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: true },
          title: { display: true, text: titleText, font: { weight: "bold" } }
        },
        scales: {
          y: {
            ticks: { callback: (v) => F.formatUZSShort(v) }
          }
        }
      }
    });
  }

  function getRangeFilteredAgg() {
    const s = startMonthEl?.value || "";
    const e = endMonthEl?.value || "";
    let out = [...monthlyAgg];
    if (s) out = out.filter(r => r.month >= s);
    if (e) out = out.filter(r => r.month <= e);
    return out;
  }

  function rerenderAll() {
    const filtered = getRangeFilteredAgg();
    renderStats(filtered);
    renderTable(filtered);
    buildChart(filtered);
    setTimestamp();
    saveMonthlyState();
  }

  // ---------- Core ----------
  function normalizeMonthlyRows(jsonRows) {
    let skippedNoDate = 0;

    const normalized = jsonRows.map(row => {
      const rawDate = pick(row, COLS.date);
      const dateObj = parseExcelDate(rawDate);
      if (!dateObj) { skippedNoDate += 1; return null; }

      const sales = toNumber(pick(row, COLS.sales));
      const cost = toNumber(pick(row, COLS.cost));
      const expense = toNumber(pick(row, COLS.expense));
      const credit = toNumber(pick(row, COLS.credit));
      const debt = toNumber(pick(row, COLS.debt));

      const profit = sales - cost;
      const cashflow = sales - cost - expense;

      return { date: dateObj, month: monthKey(dateObj), sales, cost, expense, credit, debt, profit, cashflow };
    });

    return { rows: normalized.filter(Boolean), skippedNoDate };
  }

  function aggregateByMonth(rows) {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.month)) {
        map.set(r.month, { month: r.month, sales: 0, cost: 0, expense: 0, credit: 0, debt: 0, profit: 0, cashflow: 0, lines: 0 });
      }
      const m = map.get(r.month);
      m.sales += r.sales;
      m.cost += r.cost;
      m.expense += r.expense;
      m.credit += r.credit;
      m.debt += r.debt;
      m.profit += r.profit;
      m.cashflow += r.cashflow;
      m.lines += 1;
    }
    return Array.from(map.values()).sort((a, b) => (a.month > b.month ? 1 : -1));
  }

  function forceSetRangeFromAgg() {
    if (!monthlyAgg.length) return;
    const minM = monthlyAgg[0].month;
    const maxM = monthlyAgg[monthlyAgg.length - 1].month;

    if (startMonthEl) startMonthEl.value = minM;
    if (endMonthEl) endMonthEl.value = maxM;
  }

  // ---------- Excel Template Generator ----------
  function buildMonthlyTemplateWorkbook() {
    if (typeof XLSX === "undefined") throw new Error("XLSX kutubxonasi topilmadi");

    const headers = ["Sana", "Savdo", "Tannarx", "Xarajat", "Nasiya", "Qarz"];
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = today.getMonth();

    const rows = [];
    for (let i = 0; i < 15; i++) {
      const d = new Date(yyyy, mm - 2, 1 + i);
      rows.push({
        Sana: d.toISOString().slice(0, 10),
        Savdo: i % 2 === 0 ? 12000000 : 8500000,
        Tannarx: i % 2 === 0 ? 7000000 : 5200000,
        Xarajat: 900000,
        Nasiya: 0,
        Qarz: 0
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    ws["!cols"] = [
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Oylik");
    return wb;
  }

  function downloadMonthlyTemplate() {
    try {
      const wb = buildMonthlyTemplateWorkbook();
      XLSX.writeFile(wb, `Oylik_Shablon_${stamp()}.xlsx`);
    } catch (e) {
      alert("Shablon yaratishda xato: " + (e?.message || e));
    }
  }

  // ---------- Events ----------
  monthlyUploadBtn.addEventListener("click", () => {
    monthlyFileInput.value = "";
    monthlyFileInput.click();
  });

  monthlyFileInput.addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    hardResetMonthlyState();

    hideWarning();
    setFileInfoOk(file.name, file.size / 1024);

    if (typeof XLSX === "undefined") {
      setFileInfoErr("XLSX kutubxonasi topilmadi (cdn ishlamayapti).");
      ev.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        const { rows, skippedNoDate } = normalizeMonthlyRows(json);
        monthlyRows = rows;

        monthlyAgg = aggregateByMonth(rows);
        forceSetRangeFromAgg();

        if (skippedNoDate > 0) {
          showWarning(`Sana bo‘lmagan ${skippedNoDate} ta qator tahlilga kiritilmadi (sana majburiy).`);
        }

        rerenderAll();
      } catch (err) {
        console.error(err);
        setFileInfoErr("Excelni o‘qishda xato: " + (err?.message || err));
      } finally {
        ev.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  });

  if (applyRangeBtn) applyRangeBtn.addEventListener("click", () => rerenderAll());

  document.addEventListener("click", (e) => {
    const btn = e.target.closest('.period-btn[data-metric]');
    if (!btn) return;

    const wrap = btn.closest("#monthly-tab");
    if (!wrap) return;

    wrap.querySelectorAll('.period-btn[data-metric]').forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    currentMetric = btn.getAttribute("data-metric") || "compare";
    rerenderAll();
  });

  function bindMonthlyTemplate() {
    if (!monthlyTemplateBtn) return;
    monthlyTemplateBtn.addEventListener("click", downloadMonthlyTemplate);
  }

  // ---------- PDF ----------
  function getOrCreateReportHost() {
    let host = document.getElementById("monthlyReportHost");
    if (host) return host;

    host = document.createElement("div");
    host.id = "monthlyReportHost";
    host.style.position = "fixed";
    host.style.left = "-10000px";
    host.style.top = "0";
    host.style.width = "297mm";
    host.style.minHeight = "210mm";
    host.style.background = "#fff";
    host.style.opacity = "1";
    host.style.pointerEvents = "none";
    host.style.zIndex = "-1";
    document.body.appendChild(host);
    return host;
  }

  function getChartImage() {
    try { return chartCanvas ? chartCanvas.toDataURL("image/png", 1.0) : ""; }
    catch { return ""; }
  }

  function buildMonthlyReportHTML() {
    const now = new Date();
    const createdAt = now.toLocaleString("uz-UZ", { hour12: false });

    const s = startMonthEl?.value || "-";
    const e = endMonthEl?.value || "-";

    const tSales = Number(monthlyStatsRow?.dataset?.t_sales || 0);
    const tProfit = Number(monthlyStatsRow?.dataset?.t_profit || 0);
    const tExpense = Number(monthlyStatsRow?.dataset?.t_expense || 0);
    const tCredit = Number(monthlyStatsRow?.dataset?.t_credit || 0);
    const tDebt = Number(monthlyStatsRow?.dataset?.t_debt || 0);

    const chartImg = getChartImage();
    const tableHTML = (monthlyTable && monthlyTable.style.display !== "none")
      ? monthlyTable.outerHTML
      : `<div class="pdf-note">Jadval mavjud emas</div>`;

    const metricName =
      currentMetric === "compare" ? "Taqqoslash" :
      currentMetric === "sales" ? "Savdo" :
      currentMetric === "profit" ? "Foyda" :
      "Cashflow";

    const logo = BRAND.logoUrl
      ? `<img class="pdf-logo" src="${escapeHtml(BRAND.logoUrl)}" alt="logo" />`
      : "";

    return `
      <div class="pdf-report">
        <div class="pdf-head">
          <div class="pdf-head-left">
            <div class="pdf-title">Oylik Hisobot</div>
            <div class="pdf-meta">Brend: <b>${escapeHtml(BRAND.name)}</b></div>
            <div class="pdf-meta">Davr: <b>${escapeHtml(s)}</b> — <b>${escapeHtml(e)}</b></div>
            <div class="pdf-meta">Grafik: <b>${escapeHtml(metricName)}</b></div>
            <div class="pdf-meta">Yaratilgan: ${escapeHtml(createdAt)}</div>
          </div>
          <div class="pdf-head-right">
            ${logo}
          </div>
        </div>

        <div class="pdf-kpis">
          <div class="pdf-kpi"><div class="k-label">Jami Savdo</div><div class="k-value">${escapeHtml(F.formatUZSShort(tSales))}</div><div class="k-sub">${escapeHtml(F.formatUZS(tSales))}</div></div>
          <div class="pdf-kpi"><div class="k-label">Jami Foyda</div><div class="k-value">${escapeHtml(F.formatUZSShort(tProfit))}</div><div class="k-sub">${escapeHtml(F.formatUZS(tProfit))}</div></div>
          <div class="pdf-kpi"><div class="k-label">Jami Xarajat</div><div class="k-value">${escapeHtml(F.formatUZSShort(tExpense))}</div><div class="k-sub">${escapeHtml(F.formatUZS(tExpense))}</div></div>
          <div class="pdf-kpi"><div class="k-label">Nasiya (Debitor)</div><div class="k-value">${escapeHtml(F.formatUZSShort(tCredit))}</div><div class="k-sub">${escapeHtml(F.formatUZS(tCredit))}</div></div>
          <div class="pdf-kpi"><div class="k-label">Qarz (Kreditor)</div><div class="k-value">${escapeHtml(F.formatUZSShort(tDebt))}</div><div class="k-sub">${escapeHtml(F.formatUZS(tDebt))}</div></div>
        </div>

        <div class="pdf-section">
          <div class="pdf-section-title">Oylik grafik</div>
          ${chartImg ? `<img class="pdf-chart" src="${chartImg}" alt="chart"/>` : `<div class="pdf-note">Grafik topilmadi</div>`}
        </div>

        <div class="pdf-section">
          <div class="pdf-section-title">Oylik Jadval</div>
          <div class="pdf-table-wrap">${tableHTML}</div>
        </div>
      </div>
    `;
  }

  function injectPdfStyles(host) {
    const style = document.createElement("style");
    style.textContent = `
      .pdf-report{ font-family: Arial, sans-serif; background:#fff; color:#111; padding:10mm; }
      .pdf-head{
        display:flex; justify-content:space-between; align-items:flex-start; gap:10px;
        border-bottom:3px solid ${BRAND.primary};
        padding-bottom:10px; margin-bottom:12px;
      }
      .pdf-title{ font-size:22px; font-weight:900; margin-bottom:6px; color:${BRAND.accent}; }
      .pdf-meta{ font-size:12px; color:#444; margin:2px 0; }
      .pdf-logo{ max-height:42px; max-width:180px; object-fit:contain; }
      .pdf-kpis{ display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin:10px 0 14px; }
      .pdf-kpi{ border:1px solid #e5e7eb; border-radius:10px; padding:10px; background:#fafafa; }
      .k-label{ font-size:11px; color:#555; font-weight:800; }
      .k-value{ font-size:18px; font-weight:900; margin-top:6px; color:${BRAND.primary}; }
      .k-sub{ font-size:11px; color:#666; margin-top:4px; }
      .pdf-section{ margin-top:12px; }
      .pdf-section-title{ font-size:14px; font-weight:900; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #eee; }
      .pdf-chart{ width:100%; border:1px solid #eee; border-radius:10px; padding:8px; background:#fff; }
      .pdf-table-wrap table{ width:100%; border-collapse:collapse; font-size:10.5px; }
      .pdf-table-wrap th,.pdf-table-wrap td{ border:1px solid #e5e7eb; padding:6px 8px; vertical-align:top; }
      .pdf-table-wrap th{ background:${BRAND.primary} !important; color:#fff !important; font-weight:900; }
      .pdf-table-wrap tr:nth-child(even) td{ background:#fafafa; }
      .pdf-table-wrap tr{ page-break-inside:avoid; }
    `;
    host.appendChild(style);
  }

  async function exportMonthlyPdf() {
    if (!monthlyAgg || monthlyAgg.length === 0) { alert("PDF olish uchun avval Oylik Excel yuklang."); return; }
    if (typeof html2pdf === "undefined") { alert("html2pdf topilmadi."); return; }

    await new Promise(r => setTimeout(r, 120));
    const host = getOrCreateReportHost();
    host.innerHTML = "";
    host.innerHTML = buildMonthlyReportHTML();
    injectPdfStyles(host);
    await new Promise(r => setTimeout(r, 90));

    const opt = {
      margin: [8, 8, 8, 8],
      filename: `Oylik_Hisobot_${stamp()}.pdf`,
      image: { type: "png", quality: 1.0 },
      html2canvas: { scale: 3, useCORS: true, backgroundColor: "#ffffff", logging: false, dpi: 192, letterRendering: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      pagebreak: { mode: ["css", "avoid-all", "legacy"] }
    };

    await html2pdf().set(opt).from(host).save();
    host.innerHTML = "";
  }

  function bindMonthlyPdf() {
    if (!monthlyPdfBtn) return;
    monthlyPdfBtn.addEventListener("click", exportMonthlyPdf);
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindMonthlyPdf();
    bindMonthlyTemplate();

    const restored = loadMonthlyState();
    if (restored) rerenderAll();
    else setTimestamp();
  });

  setTimestamp();
})();
