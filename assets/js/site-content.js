(function () {
  "use strict";
  var API_BASE = window.NANA_API_BASE || (window.location.protocol === "file:" ? "http://localhost:4000" : "");
  function all(selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); }
  function pageName() { return document.body.dataset.page || location.pathname.split('/').pop().replace('.html','') || 'home'; }
  function applyLanguageAgain() {
    var lang = localStorage.getItem("nana-secret-lang") || document.documentElement.lang || "ar";
    all("[data-ar][data-en]").forEach(function (el) { el.textContent = lang === "en" ? (el.dataset.en || el.textContent) : (el.dataset.ar || el.textContent); });
  }
  async function rowsFor(group) {
    try {
      var response = await fetch(API_BASE + "/api/content/" + encodeURIComponent(group));
      if (!response.ok) return [];
      return await response.json();
    } catch (error) { return []; }
  }
  async function loadTextOverrides(group, selector, keyPrefix) {
    var rows = await rowsFor(group), map = {};
    rows.forEach(function (row) { map[row.key] = row; });
    all(selector).forEach(function (el, index) {
      var row = map[keyPrefix + index];
      if (!row) return;
      if (typeof row.ar === "string") el.dataset.ar = row.ar;
      if (typeof row.en === "string") el.dataset.en = row.en;
    });
    applyLanguageAgain();
  }

  async function loadContactOverrides() {
    var rows = await rowsFor("contact"), map = {};
    rows.forEach(function (row) { map[row.key] = row; });
    function text(key, selector) {
      var row = map[key], el = document.querySelector(selector);
      if (!row || !el) return;
      if (typeof row.ar === "string") el.dataset.ar = row.ar;
      if (typeof row.en === "string") el.dataset.en = row.en;
    }
    function phone(key, selector) {
      var row = map[key], el = document.querySelector(selector);
      if (!row || !el) return;
      var value = row.ar || row.en || el.textContent.trim();
      el.textContent = value;
      var linkEl = el.matches && el.matches("a") ? el : el.closest("a");
      if (linkEl) linkEl.setAttribute("href", "tel:" + value.replace(/[^+\d]/g, ""));
    }
    function email(key, selector) {
      var row = map[key], el = document.querySelector(selector);
      if (!row || !el) return;
      var value = row.ar || row.en || el.textContent.trim();
      el.textContent = value;
      var linkEl = el.matches && el.matches("a") ? el : el.closest("a");
      if (linkEl) linkEl.setAttribute("href", "mailto:" + value.trim());
    }
    function link(key, selector) {
      var row = map[key], el = document.querySelector(selector);
      if (!row || !el) return;
      var value = row.ar || row.en || el.getAttribute("href");
      el.setAttribute("href", value);
    }
    text("contact-address-main", ".contact-list a[href*='maps.google'] em");
    text("contact-map-text", ".map-card p");
    text("footer-address", ".site-footer .footer-grid > div:nth-child(2) p[data-ar]");
    phone("contact-phone", ".contact-list a[href^='tel:'] em");
    phone("footer-phone", ".site-footer a[href^='tel:']");
    email("contact-email", ".contact-list a[href^='mailto:'] em");
    email("footer-email", ".site-footer a[href^='mailto:']");
    link("contact-map-link", ".map-card a.text-link");
    applyLanguageAgain();
  }

  async function loadTeamOverrides() {
    var rows = await rowsFor("team"), map = {};
    rows.forEach(function (row) { map[row.key] = row; });
    all(".team-card").forEach(function (card, i) {
      [["role", ".team-info span"], ["name", ".team-info h3"], ["bio", ".team-info p"]].forEach(function (pair) {
        var row = map["team-" + i + "-" + pair[0]], el = card.querySelector(pair[1]);
        if (!row || !el) return;
        if (typeof row.ar === "string") el.dataset.ar = row.ar;
        if (typeof row.en === "string") el.dataset.en = row.en;
      });
    });
    applyLanguageAgain();
  }

  async function loadImageOverrides(group, selector, keyPrefix) {
    var rows = await rowsFor(group), map = {};
    rows.forEach(function (row) { map[row.key] = row; });
    all(selector).filter(function(img){ return !/logo\.webp|logo\.png|logo\.jpg|logo\.svg/i.test(img.getAttribute('src') || ''); }).forEach(function (img, index) {
      var row = map[keyPrefix + index];
      if (!row) return;
      if (row.ar) img.setAttribute("src", row.ar);
      if (row.en) img.setAttribute("alt", row.en);
    });
  }
  document.addEventListener("DOMContentLoaded", function () {
    var page = pageName();
    loadTextOverrides("navbar", ".site-header [data-ar][data-en]", "navbar-");
    loadImageOverrides(page, page === "home" ? "main section:not(.news-preview) img, footer img" : "main img, footer img", page + "-img-");
    loadContactOverrides();
    if (page === "team") loadTeamOverrides();
  });
})();
