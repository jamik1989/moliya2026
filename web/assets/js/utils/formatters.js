// web/assets/js/utils/formatters.js
(() => {
  "use strict";

  // 1 000 000 000 ko'rinish (space bilan)
  const nfFull = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0
  });

  // 1 234 567.89 (agar kerak bo'lsa)
  const nf2 = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  function toNum(v) {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    // "1 000 000" yoki "1,000,000" yoki "1 000 000 so'm" bo'lishi mumkin
    const s = String(v).replace(/[^\d.,-]/g, "").replace(/\s/g, "");
    // avval vergulni nuqtaga aylantiramiz (xohlovchi formatlar uchun)
    const normalized = s.replace(/,/g, ".");
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  // To'liq pul: "1 000 000 000 so'm"
  function formatUZS(value) {
    const n = toNum(value);
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    return `${sign}${nfFull.format(abs)} so'm`;
  }

  // Qisqa ko'rinish: "1.2 mlrd so'm", "350 mln so'm", "120 ming so'm"
  function formatUZSShort(value) {
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
  }

  // Oddiy son: "1 000 000" (foiz, dona, qty uchun)
  function formatNum(value) {
    const n = toNum(value);
    return nfFull.format(n);
  }

  // %: "12.34%"
  function formatPct(value) {
    const n = toNum(value);
    return `${nf2.format(n)}%`;
  }

  // Global qilib qo'yamiz (modullar ishlatishi oson)
  window.FMT = {
    toNum,
    formatUZS,
    formatUZSShort,
    formatNum,
    formatPct
  };
})();
