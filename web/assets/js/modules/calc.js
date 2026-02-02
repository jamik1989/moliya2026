// web/assets/js/modules/calc.js
(function () {
  let currentTaxMode = "1percent";

  function formatNumber(num) {
    const n = Number(num) || 0;
    return n.toLocaleString("uz-UZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function updateMainPreview(input) {
    const value = Number(input.value) || 0;
    const preview = document.getElementById(input.id + "Preview");
    if (preview) preview.textContent = formatNumber(value) + " so'm";
  }

  function quickSet(field, value) {
    const input = document.getElementById(field);
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event("input"));
  }

  function calculateMain() {
    const sales = Number(document.getElementById("sales")?.value) || 0;
    const cost = Number(document.getElementById("cost")?.value) || 0;
    const fixedCost = Number(document.getElementById("fixedCost")?.value) || 0;
    const operatingCost = Number(document.getElementById("operatingCost")?.value) || 0;

    let breakEven = 0;
    let margin = 0;

    if (sales <= 0) {
      document.getElementById("breakEvenAmount").textContent = "0 so'm";
      document.getElementById("profitMargin").textContent = "0.0%";
      document.getElementById("requiredSales").textContent = "0 so'm";
      document.getElementById("progressBar").style.width = "0%";
      return;
    }

    if (currentTaxMode === "1percent") {
      const taxAmount = sales * 0.01;
      const profitAfterTax = sales - cost - operatingCost - taxAmount;
      const marginValue = profitAfterTax / sales;

      margin = marginValue * 100;
      breakEven = marginValue > 0 ? fixedCost / marginValue : 0;

      const progressPercent = breakEven > 0 ? Math.min((sales / breakEven) * 100, 100) : 0;
      document.getElementById("progressBar").style.width = `${progressPercent}%`;

      const isProfitable = breakEven > 0 ? sales >= breakEven : false;
      const profitLossAmount = breakEven > 0 ? Math.abs(sales - breakEven) : 0;

      const status = document.getElementById("statusContainer");
      if (status) {
        status.innerHTML = `
          <div style="display:flex;align-items:center;gap:12px;padding:15px;background:${isProfitable ? "#d5f4e6" : "#fdeaea"};border-radius:10px;margin:15px 0;">
            <div style="font-size:20px;">${isProfitable ? "💰" : "⚠️"}</div>
            <div>
              <div style="font-weight:600;color:#2c3e50;margin-bottom:4px;">${isProfitable ? "FOYDA" : "ZARAR"}</div>
              <div style="font-size:13px;color:#7f8c8d;">${formatNumber(profitLossAmount)} so'm ${isProfitable ? "foyda" : "zarar"}</div>
            </div>
          </div>
        `;
      }
    } else {
      // QQS rejimi: savdoni 1.12 ga ajratamiz, foyda solig'i 15%
      const salesWithoutVAT = sales / 1.12;
      const profitBeforeTax = salesWithoutVAT - cost - operatingCost;
      const profitAfterTax = profitBeforeTax * 0.85;

      const marginValue = salesWithoutVAT > 0 ? profitAfterTax / salesWithoutVAT : 0;
      margin = marginValue * 100;

      const breakEvenWithoutVAT = marginValue > 0 ? fixedCost / marginValue : 0;
      breakEven = breakEvenWithoutVAT * 1.12;

      const progressPercent = breakEvenWithoutVAT > 0 ? Math.min((salesWithoutVAT / breakEvenWithoutVAT) * 100, 100) : 0;
      document.getElementById("progressBar").style.width = `${progressPercent}%`;

      const status = document.getElementById("statusContainer");
      if (status) status.innerHTML = "";
    }

    document.getElementById("breakEvenAmount").textContent = formatNumber(breakEven) + " so'm";
    document.getElementById("profitMargin").textContent = (Number.isFinite(margin) ? margin : 0).toFixed(1) + "%";

    calculateTargetProfit();
  }

  function calculateTargetProfit() {
    const sales = Number(document.getElementById("sales")?.value) || 0;
    const cost = Number(document.getElementById("cost")?.value) || 0;
    const fixedCost = Number(document.getElementById("fixedCost")?.value) || 0;
    const operatingCost = Number(document.getElementById("operatingCost")?.value) || 0;
    const targetProfit = Number(document.getElementById("targetProfit")?.value) || 0;

    if (sales <= 0) {
      document.getElementById("requiredSales").textContent = "0 so'm";
      return;
    }

    let requiredSalesAmount = 0;

    if (currentTaxMode === "1percent") {
      const profitAfterTax = sales - cost - operatingCost - (sales * 0.01);
      const marginValue = profitAfterTax / sales;
      requiredSalesAmount = marginValue > 0 ? (fixedCost + targetProfit) / marginValue : 0;
    } else {
      const salesWithoutVAT = sales / 1.12;
      const profitBeforeTax = salesWithoutVAT - cost - operatingCost;
      const profitAfterTax = profitBeforeTax * 0.85;

      const marginValue = salesWithoutVAT > 0 ? profitAfterTax / salesWithoutVAT : 0;
      const targetProfitBeforeTax = targetProfit / 0.85;

      const breakEvenWithoutVAT = marginValue > 0 ? (fixedCost + targetProfitBeforeTax) / marginValue : 0;
      requiredSalesAmount = breakEvenWithoutVAT * 1.12;
    }

    document.getElementById("requiredSales").textContent = formatNumber(requiredSalesAmount) + " so'm";
  }

  function updateGaugePointer(cashCycle) {
    let position;
    if (cashCycle < 0) position = 10;
    else if (cashCycle <= 30) position = 10 + (cashCycle / 30) * 60;
    else position = 70 + Math.min((cashCycle - 30) / 70, 0.3) * 30;

    const pointer = document.getElementById("gaugePointer");
    if (pointer) pointer.style.left = position + "%";
  }

  function updateCashflowStatus(cashCycle) {
    const box = document.getElementById("cashflowStatus");
    if (!box) return;

    if (cashCycle < 0) {
      box.innerHTML = `
        <div class="status-display" style="border-left: 4px solid #27ae60;">
          <div class="status-content">
            <h3>✅ A'lo Holat!</h3>
            <p>Siz boshqalarning puli hisobiga savdo qilyapsiz. Kassa har doim to'la.</p>
          </div>
        </div>
      `;
    } else if (cashCycle <= 30) {
      box.innerHTML = `
        <div class="status-display" style="border-left: 4px solid #f1c40f;">
          <div class="status-content">
            <h3>⚠️ Ehtiyot Bo'ling</h3>
            <p>Pul aylanishi sekin. Mablag'ingiz tovar va qarzlarda.</p>
          </div>
        </div>
      `;
    } else {
      box.innerHTML = `
        <div class="status-display" style="border-left: 4px solid #e74c3c;">
          <div class="status-content">
            <h3>🚨 Kassa Uzilishi Xavfi!</h3>
            <p>Yetkazib beruvchiga pulni mijozdan oldin to'lab qo'yasiz.</p>
          </div>
        </div>
      `;
    }
  }

  function calculateCashCycle() {
    const customerPaymentDays = Number(document.getElementById("customerPaymentDays")?.value) || 0;
    const inventoryDays = Number(document.getElementById("inventoryDays")?.value) || 0;
    const supplierPaymentDays = Number(document.getElementById("supplierPaymentDays")?.value) || 0;

    const cashCycle = (inventoryDays + customerPaymentDays) - supplierPaymentDays;

    document.getElementById("customerDebtDays").textContent = customerPaymentDays + " kun";
    document.getElementById("inventoryValueDays").textContent = inventoryDays + " kun";
    document.getElementById("supplierPaymentValueDays").textContent = supplierPaymentDays + " kun";
    document.getElementById("cashCycleDays").textContent = cashCycle + " kun";

    const p1 = document.getElementById("customerPaymentPreview");
    const p2 = document.getElementById("inventoryPreview");
    const p3 = document.getElementById("supplierPaymentPreview");
    if (p1) p1.textContent = customerPaymentDays + " kun";
    if (p2) p2.textContent = inventoryDays + " kun";
    if (p3) p3.textContent = supplierPaymentDays + " kun";

    updateGaugePointer(cashCycle);
    updateCashflowStatus(cashCycle);
  }

  function runFullAnalysis() {
    const btn = document.querySelector("#calculator-tab .btn-primary");
    if (!btn) return;

    const original = btn.innerHTML;
    btn.innerHTML = "<span>⏳</span> Hisoblanmoqda...";
    btn.disabled = true;

    setTimeout(() => {
      calculateMain();
      calculateCashCycle();

      btn.innerHTML = "<span>✅</span> Hisoblandi!";
      setTimeout(() => {
        btn.innerHTML = original;
        btn.disabled = false;
      }, 1200);
    }, 900);
  }

  function resetCalculator() {
    document.getElementById("sales").value = 1000000000;
    document.getElementById("cost").value = 600000000;
    document.getElementById("fixedCost").value = 50000000;
    document.getElementById("operatingCost").value = 30000000;
    document.getElementById("targetProfit").value = 100000000;

    document.getElementById("customerPaymentDays").value = 30;
    document.getElementById("inventoryDays").value = 15;
    document.getElementById("supplierPaymentDays").value = 45;

    document.querySelectorAll("#calculator-tab input").forEach(input => {
      input.dispatchEvent(new Event("input"));
    });

    alert("🔄 Kalkulyator tozalandi!");
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Tax tabs
    document.querySelectorAll(".tax-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tax-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentTaxMode = tab.dataset.tab;
        calculateMain();
      });
    });

    // Main inputs
    ["sales", "cost", "fixedCost", "operatingCost", "targetProfit"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", () => {
        updateMainPreview(el);
        calculateMain();
      });
      updateMainPreview(el);
    });

    // Cash inputs
    ["customerPaymentDays", "inventoryDays", "supplierPaymentDays"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", calculateCashCycle);
    });

    calculateMain();
    calculateCashCycle();
  });

  // onclick ishlashi uchun global
  window.quickSet = quickSet;
  window.runFullAnalysis = runFullAnalysis;
  window.resetCalculator = resetCalculator;
})();
