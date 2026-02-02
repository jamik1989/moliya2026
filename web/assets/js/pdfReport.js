// web/assets/js/pdfReport.js
(function () {
  "use strict";

  function fmt2(n) { return String(n).padStart(2, "0"); }
  function stamp() {
    const d = new Date();
    return `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}-${fmt2(d.getDate())}_${fmt2(d.getHours())}${fmt2(d.getMinutes())}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getOrCreateHost(hostId, orientation) {
    let host = document.getElementById(hostId);
    if (host) return host;

    host = document.createElement("div");
    host.id = hostId;

    host.style.position = "fixed";
    host.style.left = "-10000px";
    host.style.top = "0";
    host.style.background = "#fff";

    // ✅ A4 host size (mm)
    if (orientation === "landscape") {
      host.style.width = "297mm";
      host.style.minHeight = "210mm";
    } else {
      host.style.width = "210mm";
      host.style.minHeight = "297mm";
    }

    // ❗ oq PDF bo‘lmasligi uchun opacity 0 emas
    host.style.opacity = "1";
    host.style.pointerEvents = "none";
    host.style.zIndex = "-1";

    document.body.appendChild(host);
    return host;
  }

  function injectUnifiedStyles(host) {
    const style = document.createElement("style");
    style.textContent = `
      .pdf-report{
        font-family: Arial, sans-serif;
        background:#fff;
        color:#111;
        padding: 12mm;
      }
      .pdf-head{
        border-bottom:2px solid #eee;
        padding-bottom:10px;
        margin-bottom:12px;
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:12px;
      }
      .pdf-title{
        font-size:22px;
        font-weight:800;
        margin-bottom:6px;
      }
      .pdf-meta{
        font-size:12px;
        color:#444;
        margin:2px 0;
      }
      .pdf-badge{
        font-size:12px;
        font-weight:800;
        padding:6px 10px;
        border-radius:999px;
        background:#111;
        color:#fff;
        height:fit-content;
        white-space:nowrap;
      }

      .pdf-kpis{
        display:grid;
        grid-template-columns: repeat(5, 1fr);
        gap:10px;
        margin: 10px 0 16px;
      }
      .pdf-kpi{
        border:1px solid #e5e7eb;
        border-radius:10px;
        padding:10px;
        background:#fafafa;
      }
      .k-label{ font-size:11px; color:#555; font-weight:700; }
      .k-value{ font-size:18px; font-weight:800; margin-top:6px; }
      .k-sub{ font-size:11px; color:#666; margin-top:4px; }

      .pdf-section{ margin-top:14px; }
      .pdf-section-title{
        font-size:14px;
        font-weight:800;
        margin-bottom:8px;
        padding-bottom:6px;
        border-bottom:1px solid #eee;
      }

      .pdf-chart{
        width:100%;
        border:1px solid #eee;
        border-radius:10px;
        padding:8px;
        background:#fff;
      }

      .pdf-table-wrap{
        margin-top:8px;
      }
      .pdf-table-wrap table{
        width:100%;
        border-collapse:collapse;
        font-size:10.5px;
      }
      .pdf-table-wrap th, .pdf-table-wrap td{
        border:1px solid #e5e7eb;
        padding:6px 8px;
        vertical-align:top;
      }
      .pdf-table-wrap th{
        background:#f3f4f6 !important;
        color:#111 !important;
        font-weight:800;
      }
      .pdf-table-wrap tr:nth-child(even) td{
        background:#fafafa;
      }
      .pdf-table-wrap tr{ page-break-inside: avoid; }

      /* landscape uchun yaxshi joylashsin */
      @media print{
        .pdf-kpis{ grid-template-columns: repeat(5, 1fr); }
      }
    `;
    host.appendChild(style);
  }

  async function exportUnifiedPdf({
    hostId,
    title,
    badgeText,
    filenamePrefix,
    orientation = "landscape",
    metaLines = [],
    kpis = [],
    chartImg = "",
    tableHTML = "",
  }) {
    if (typeof html2pdf === "undefined") {
      alert("html2pdf yuklanmagan. user.html da html2pdf.bundle.min.js ulanganini tekshiring.");
      return;
    }

    const host = getOrCreateHost(hostId, orientation);
    host.innerHTML = "";

    const now = new Date();
    const createdAt = now.toLocaleString("uz-UZ", { hour12: false });

    const metaHtml = [
      ...metaLines.map(x => `<div class="pdf-meta">${escapeHtml(x)}</div>`),
      `<div class="pdf-meta">Yaratilgan: ${escapeHtml(createdAt)}</div>`
    ].join("");

    const kpiHtml = kpis.map(k => `
      <div class="pdf-kpi">
        <div class="k-label">${escapeHtml(k.label)}</div>
        <div class="k-value">${escapeHtml(k.value)}</div>
        ${k.sub ? `<div class="k-sub">${escapeHtml(k.sub)}</div>` : ``}
      </div>
    `).join("");

    host.innerHTML = `
      <div class="pdf-report">
        <div class="pdf-head">
          <div>
            <div class="pdf-title">${escapeHtml(title)}</div>
            ${metaHtml}
          </div>
          ${badgeText ? `<div class="pdf-badge">${escapeHtml(badgeText)}</div>` : ``}
        </div>

        ${kpis.length ? `<div class="pdf-kpis">${kpiHtml}</div>` : ``}

        <div class="pdf-section">
          <div class="pdf-section-title">Grafik</div>
          ${chartImg ? `<img class="pdf-chart" src="${chartImg}" alt="chart"/>` : `<div class="pdf-meta">Grafik topilmadi</div>`}
        </div>

        <div class="pdf-section">
          <div class="pdf-section-title">Jadval</div>
          <div class="pdf-table-wrap">
            ${tableHTML || `<div class="pdf-meta">Jadval mavjud emas</div>`}
          </div>
        </div>
      </div>
    `;

    injectUnifiedStyles(host);

    // DOM o‘rnashishi
    await new Promise(r => setTimeout(r, 80));

    const opt = {
      margin: [10, 10, 12, 10],
      filename: `${filenamePrefix}_${stamp()}.pdf`,
      image: { type: "png", quality: 1.0 },
      html2canvas: {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        dpi: 192,
        letterRendering: true
      },
      jsPDF: { unit: "mm", format: "a4", orientation },
      pagebreak: { mode: ["css", "avoid-all", "legacy"] }
    };

    await html2pdf().set(opt).from(host).save();
    host.innerHTML = "";
  }

  window.PDFReport = {
    exportUnifiedPdf,
  };
})();
