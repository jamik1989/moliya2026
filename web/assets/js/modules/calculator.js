(() => {
  "use strict";

  let taxMode = "TAX1"; // TAX1 or VAT_PROFIT

  const $ = (id) => document.getElementById(id);

  const el = {
    tax1Btn: null,
    taxVatBtn: null,

    revenue: null,
    cogs: null,
    fixed: null,
    salesPct: null,
    targetProfit: null,
    riskPct: null,

    outGross: null,
    outTax: null,
    outOpBeforeTax: null,
    outNet: null,
    outBreakeven: null,
    outTargetRevenue: null,
    outRisk: null,
    outMarginPct: null,

    calcHint: null,
  };

  document.addEventListener("DOMContentLoaded", () => {
    // bind
    el.tax1Btn = $("tax1Btn");
    el.taxVatBtn = $("taxVatBtn");

    el.revenue = $("inpRevenue");
    el.cogs = $("inpCogs");
    el.fixed = $("inpFixed");
    el.salesPct = $("inpSalesPct");
    el.targetProfit = $("inpTargetProfit");
    el.riskPct = $("inpRiskPct");

    el.outGross = $("outGross");
    el.outTax = $("outTax");
    el.outOpBeforeTax = $("outOpBeforeTax");
    el.outNet = $("outNet");
    el.outBreakeven = $("outBreakeven");
    el.outTargetRevenue = $("outTargetRevenue");
    el.outRisk = $("outRisk");
    el.outMarginPct = $("outMarginPct");

    el.calcHint = $("calcHint");

    // if kalkulyator tab yo‘q bo‘lsa exit
    if (!el.revenue || !el.tax1Btn || !el.taxVatBtn) return;

    // mode buttons
    el.tax1Btn.addEventListener("click", () => setMode("TAX1"));
    el.taxVatBtn.addEventListener("click", () => setMode("VAT_PROFIT"));

    // live compute
    const inputs = [el.revenue, el.cogs, el.fixed, el.salesPct, el.targetProfit, el.riskPct];
    inputs.forEach((i) => i.addEventListener("input", compute));

    compute();
  });

  function setMode(mode) {
    taxMode = mode;

    el.tax1Btn.classList.toggle("active", mode === "TAX1");
    el.taxVatBtn.classList.toggle("active", mode === "VAT_PROFIT");

    compute();
  }

  function n(v) {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }

  function pct(v) {
    return Math.max(0, n(v) / 100);
  }

  function fmtMoney(x) {
    const num = n(x);
    const abs = Math.abs(num);

    if (abs >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + "B";
    if (abs >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (abs >= 1_000) return (num / 1_000).toFixed(1) + "K";

    return new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(num);
  }

  function fmtPct(x) {
    return (n(x)).toFixed(1) + "%";
  }

  function compute() {
    const revenue = Math.max(0, n(el.revenue.value));
    const cogs = Math.max(0, n(el.cogs.value));
    const fixed = Math.max(0, n(el.fixed.value));
    const salesRate = pct(el.salesPct.value);
    const targetProfit = Math.max(0, n(el.targetProfit.value));
    const riskRate = pct(el.riskPct.value);

    // Core
    const gross = revenue - cogs;                       // brutto foyda
    const salesCost = revenue * salesRate;              // sotuv harajati (%)
    const opBeforeTax = gross - fixed - salesCost;      // operatsion foyda (soliqdan oldin)

    // Tax
    let tax = 0;
    let net = 0;

    if (taxMode === "TAX1") {
      tax = revenue * 0.01; // 1% turnover
      net = opBeforeTax - tax;
    } else {
      const vat = revenue * 0.12;              // QQS 12%
      const profitTaxBase = Math.max(0, opBeforeTax - vat); // foyda bazasi (soddalashtirilgan)
      const profitTax = profitTaxBase * 0.15;  // 15%
      tax = vat + profitTax;
      net = opBeforeTax - tax;
    }

    const marginPct = revenue > 0 ? (net / revenue) * 100 : 0;
    const riskSum = revenue * riskRate;

    // Breakeven revenue: net = 0 ga teng bo‘ladigan revenue topamiz
    // net = (rev - cogs - fixed - rev*salesRate) - tax(...)
    // TAX1: net = rev*(1 - salesRate - 0.01) - cogs - fixed
    // VAT_PROFIT: soddalashtirilgan: net = opBeforeTax - (rev*0.12 + max(0, opBeforeTax - rev*0.12)*0.15)
    // Biz TAX1 ga aniq formula, VAT_PROFIT ga iteratsiya ishlatamiz.

    let breakeven = 0;
    let targetRevenue = 0;

    if (taxMode === "TAX1") {
      const k = 1 - salesRate - 0.01;
      breakeven = k > 0 ? (cogs + fixed) / k : Infinity;

      // target: net = targetProfit
      targetRevenue = k > 0 ? (cogs + fixed + targetProfit) / k : Infinity;
    } else {
      breakeven = solveRevenueForNet(0, cogs, fixed, salesRate);
      targetRevenue = solveRevenueForNet(targetProfit, cogs, fixed, salesRate);
    }

    // output
    el.outGross.textContent = fmtMoney(gross);
    el.outTax.textContent = fmtMoney(tax);
    el.outOpBeforeTax.textContent = fmtMoney(opBeforeTax);
    el.outNet.textContent = fmtMoney(net);
    el.outBreakeven.textContent = Number.isFinite(breakeven) ? fmtMoney(breakeven) : "∞";
    el.outTargetRevenue.textContent = Number.isFinite(targetRevenue) ? fmtMoney(targetRevenue) : "∞";
    el.outRisk.textContent = fmtMoney(riskSum);
    el.outMarginPct.textContent = fmtPct(marginPct);

    el.calcHint.textContent =
      taxMode === "TAX1"
        ? "Rejim: 1% aylanma soliq. Formula aniq, tez ishlaydi."
        : "Rejim: QQS 12% + Foyda solig‘i 15% (soddalashtirilgan). Breakeven/Target iteratsiya bilan hisoblanadi.";
  }

  // Iterative solve for VAT_PROFIT mode
  function solveRevenueForNet(desiredNet, cogs, fixed, salesRate) {
    // binary search
    let lo = 0;
    let hi = Math.max(1, cogs + fixed + desiredNet) * 50; // keng upper bound

    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;

      const gross = mid - cogs;
      const salesCost = mid * salesRate;
      const opBeforeTax = gross - fixed - salesCost;

      const vat = mid * 0.12;
      const profitTaxBase = Math.max(0, opBeforeTax - vat);
      const profitTax = profitTaxBase * 0.15;
      const tax = vat + profitTax;
      const net = opBeforeTax - tax;

      if (net >= desiredNet) hi = mid;
      else lo = mid;
    }

    return hi;
  }
})();
