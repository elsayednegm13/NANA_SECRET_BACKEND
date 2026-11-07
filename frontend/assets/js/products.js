(function () {
  "use strict";

  var API_BASE = window.NANA_API_BASE;
  var products = [];
  var state = {
    query: "",
    category: "all",
    sort: "az",
    columns: 4,
    view: "grid",
    lang: document.documentElement.lang === "en" ? "en" : "ar"
  };

  var list = document.querySelector("[data-products-list]");
  var search = document.querySelector("[data-product-search]");
  var categoryFilter = document.querySelector("[data-product-category]");
  var sort = document.querySelector("[data-product-sort]");
  var columns = document.querySelector("[data-grid-columns]");
  var count = document.querySelector("[data-product-count]");
  var reset = document.querySelector("[data-products-reset]");
  var empty = document.querySelector("[data-products-empty]");
  var viewButtons = Array.prototype.slice.call(document.querySelectorAll("[data-view-mode]"));

  if (!list) return;
  list.classList.add("is-visible");

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[أإآا]/g, "ا")
      .replace(/[ىي]/g, "ي")
      .replace(/[ة]/g, "ه")
      .replace(/[^\u0600-\u06FFa-z0-9. ]/g, " ");
  }
  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  }
  function formatCount(total, shown) {
    if (state.lang === "ar") return "عرض " + shown + " من " + total + " منتج";
    return "Showing " + shown + " of " + total + " products";
  }
  function render() {
    var query = normalize(state.query);
    var filtered = products.filter(function (product) {
      var matchesCategory = state.category === "all" || product.categoryAr === state.category;
      var matchesQuery = !query ||
        normalize(product.ar).indexOf(query) !== -1 ||
        normalize(product.en).indexOf(query) !== -1 ||
        normalize(product.categoryAr).indexOf(query) !== -1 ||
        normalize(product.categoryEn).indexOf(query) !== -1;
      return matchesCategory && matchesQuery;
    });
    filtered.sort(function (a, b) {
      var result = String(a.ar || "").localeCompare(String(b.ar || ""), "ar");
      return state.sort === "az" ? result : -result;
    });
    list.classList.toggle("is-list", state.view === "list");
    list.style.setProperty("--product-columns", state.columns);
    list.innerHTML = filtered.map(function (product) {
      return '<article class="product-card">' +
        '<div class="product-image"><img src="' + escapeHtml(window.NanaConfig.mediaUrl(product.imageUrl || "assets/images/product-placeholder.svg")) + '" alt="' + escapeHtml(product.ar) + '"></div>' +
        '<div class="product-body"><h3>' + escapeHtml(state.lang === "en" ? product.en || product.ar : product.ar) + '</h3>' +
        '<p>' + escapeHtml(state.lang === "ar" ? product.categoryAr : product.categoryEn) + '</p></div>' +
      '</article>';
    }).join("");
    if (count) count.textContent = formatCount(products.length, filtered.length);
    if (empty) empty.classList.toggle("is-visible", filtered.length === 0);
  }
  async function loadProducts() {
    try {
      var response = await fetch(API_BASE + "/api/products");
      if (!response.ok) throw new Error("Cannot load products");
      products = await response.json();
      render();
    } catch (error) {
      products = [];
      render();
    }
  }

  if (search) search.addEventListener("input", function () { state.query = search.value; render(); });
  if (categoryFilter) categoryFilter.addEventListener("change", function () { state.category = categoryFilter.value; render(); });
  if (sort) sort.addEventListener("change", function () { state.sort = sort.value; render(); });
  if (columns) columns.addEventListener("change", function () { state.columns = Number(columns.value); render(); });
  viewButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      state.view = button.dataset.viewMode;
      viewButtons.forEach(function (item) { item.classList.toggle("is-active", item === button); });
      render();
    });
  });
  if (reset) reset.addEventListener("click", function () {
    state.query = ""; state.category = "all"; state.sort = "az"; state.columns = 4; state.view = "grid";
    if (search) search.value = ""; if (categoryFilter) categoryFilter.value = "all"; if (sort) sort.value = "az"; if (columns) columns.value = "4";
    viewButtons.forEach(function (button) { button.classList.toggle("is-active", button.dataset.viewMode === "grid"); });
    render();
  });
  window.addEventListener("nana:language", function (event) { state.lang = event.detail.lang === "en" ? "en" : "ar"; render(); });
  window.addEventListener("nana:products-updated", loadProducts);
  loadProducts();
})();
