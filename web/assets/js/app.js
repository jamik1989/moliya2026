// web/assets/js/app.js
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ✅ Sizda login/user ikkalasi ham: web/pages/
  // user.html ichidan login.html ga qaytish yo'li: ./login.html
  function loginUrlWithLogoutFlag() {
    return new URL("./login.html?logout=1", window.location.href).toString();
  }

  function goLogin() {
    const url = loginUrlWithLogoutFlag();
    console.log("➡️ Redirect to:", url);
    window.location.assign(url);
  }

  // ===== Tabs =====
  function switchTab(tabName) {
    $$(".nav-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
    });

    $$(".tab-content").forEach(tab => tab.classList.remove("active"));

    const target = $(`#${tabName}-tab`);
    if (target) target.classList.add("active");
  }

  function bindTabs() {
    const navs = $$(".nav-btn");
    if (!navs.length) return;

    navs.forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        if (tab) switchTab(tab);
      });
    });
  }

  // ===== Logout =====
  function findLogoutButton() {
    let btn = $("#logoutBtn");
    if (btn) return btn;

    btn = $(".logout-btn");
    if (btn) return btn;

    btn = $('[data-action="logout"]');
    if (btn) return btn;

    btn = $$("button").find(b => (b.textContent || "").trim().toLowerCase() === "chiqish");
    if (btn) return btn;

    return null;
  }

  function clearAuth() {
    // ✅ Sizning login.html token kalitlari:
    localStorage.removeItem("abc_auth_token");
    localStorage.removeItem("abc_auth_user");
    sessionStorage.removeItem("abc_auth_token");
    sessionStorage.removeItem("abc_auth_user");

    // ✅ Siz oldin ishlatgan kalitlar ham bo'lsa tozalab qo'yamiz (zarar qilmaydi)
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_key");
    localStorage.removeItem("user");
    sessionStorage.clear();
  }

  function bindLogout() {
    const btn = findLogoutButton();
    if (!btn) {
      console.warn("⚠️ Logout tugmasi topilmadi. (#logoutBtn / .logout-btn)");
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("✅ Logout click!");

      clearAuth();
      goLogin();
    };

    // direct
    btn.addEventListener("click", handler);

    // delegation (capture)
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!t) return;

      const maybeBtn = t.closest && t.closest("#logoutBtn, .logout-btn, [data-action='logout']");
      if (maybeBtn) handler(e);
    }, true);

    console.log("✅ Logout bind OK");
  }

  document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ app.js loaded:", window.location.href);
    bindTabs();
    bindLogout();
  });
})();
