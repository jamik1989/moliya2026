// web/assets/js/app.js
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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
    // eski local tokenlar bo‘lsa ham tozalaymiz
    localStorage.removeItem("abc_auth_token");
    localStorage.removeItem("abc_auth_user");
    sessionStorage.removeItem("abc_auth_token");
    sessionStorage.removeItem("abc_auth_user");

    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_key");
    localStorage.removeItem("user");

    // ehtiyot uchun
    // sessionStorage.clear(); // xohlasangiz oching
  }

  function goLogin() {
    // user.html va login.html bitta papkada: web/pages/
    window.location.replace("login.html");
  }

  async function callBackendLogout() {
    const base = window.API_BASE;
    if (!base) return;

    try {
      await fetch(base + "/api/logout", {
        method: "POST",
        credentials: "include"
      });
    } catch (e) {
      // offline bo‘lsa ham baribir login’ga ketaveramiz
    }
  }

  function bindLogout() {
    const btn = findLogoutButton();
    if (!btn) {
      console.warn("⚠️ Logout tugmasi topilmadi. (#logoutBtn / .logout-btn)");
      return;
    }

    const handler = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      await callBackendLogout(); // ✅ session’ni serverda ham yopamiz
      clearAuth();
      goLogin();
    };

    btn.addEventListener("click", handler);

    // delegation
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!t) return;

      const maybeBtn = t.closest && t.closest("#logoutBtn, .logout-btn, [data-action='logout']");
      if (maybeBtn) handler(e);
    }, true);
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindTabs();
    bindLogout();
  });
})();
