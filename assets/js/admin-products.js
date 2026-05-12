(function () {
  "use strict";
  var API_BASE = window.NANA_API_BASE || "";
  var AUTH_KEY = "nana-secret-admin-token";
  var products = [];
  var searchTerm = "";
  var editingId = "";
  var currentImage = "";

  function one(selector, scope) { return (scope || document).querySelector(selector); }
  function lang() { return document.documentElement.lang === "en" ? "en" : "ar"; }
  function t(ar, en) { return lang() === "en" ? en : ar; }
  function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;"); }
  function field(id) { return one("#" + id); }
  function token() { return sessionStorage.getItem(AUTH_KEY) || ""; }
  function headers() { return { "Content-Type": "application/json", Authorization: "Bearer " + token() }; }
  function setMessage(ar, en, type) {
    var message = one("[data-admin-message]");
    if (message) { message.textContent = t(ar, en); message.dataset.type = type || "info"; }
  }
  function translateCategory(ar) {
    var map = { "بطاطين": "Blankets", "دفايات": "Warmers", "مفارش": "Bedspreads", "حافظات سجاد": "Carpet covers", "سجاد": "Rugs", "مخدات وخداديات": "Pillows and cushions", "أقمشة": "Textiles", "بالات": "Bales", "منتجات أخرى": "Other products" };
    return map[ar] || ar;
  }
  async function loadProducts() {
    try {
      var response = await fetch(API_BASE + "/api/products");
      if (!response.ok) throw new Error("load failed");
      products = await response.json();
      render();
    } catch (error) {
      setMessage("تعذر تحميل المنتجات. تأكد أن السيرفر يعمل.", "Could not load products. Make sure the server is running.", "error");
    }
  }
  function productFromForm() {
    var categoryAr = field("product-category-ar").value;
    return {
      ar: field("product-name-ar").value,
      en: field("product-name-en").value || field("product-name-ar").value,
      categoryAr: categoryAr,
      categoryEn: field("product-category-en").value || translateCategory(categoryAr),
      imageUrl: currentImage || field("product-image-url").value || "assets/images/product-placeholder.svg"
    };
  }
  function resetForm() {
    var form = one("[data-product-form]");
    editingId = ""; currentImage = "";
    if (form) form.reset();
    if (field("product-category-en")) field("product-category-en").value = "Blankets";
    var cancel = one("[data-product-cancel]");
    var submit = one("[data-product-submit]");
    if (cancel) cancel.hidden = true;
    if (submit) submit.textContent = t("إضافة المنتج", "Add product");
  }
  function fillForm(product) {
    editingId = product.id;
    currentImage = product.imageUrl || "";
    field("product-name-ar").value = product.ar || "";
    field("product-name-en").value = product.en || "";
    field("product-category-ar").value = product.categoryAr || "منتجات أخرى";
    field("product-category-en").value = product.categoryEn || translateCategory(product.categoryAr);
    field("product-image-url").value = product.imageUrl && !/^data:/i.test(product.imageUrl) ? product.imageUrl : "";
    var cancel = one("[data-product-cancel]");
    var submit = one("[data-product-submit]");
    if (cancel) cancel.hidden = false;
    if (submit) submit.textContent = t("حفظ تعديل المنتج", "Save product changes");
    one("[data-product-form]").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function matchesSearch(product) {
    var term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [product.id, product.ar, product.en, product.categoryAr, product.categoryEn]
      .join(" ").toLowerCase().indexOf(term) !== -1;
  }
  function render() {
    var list = one("[data-admin-products-list]");
    var count = one("[data-products-admin-count]");
    var visible = products.filter(matchesSearch);
    if (count) {
      count.textContent = searchTerm
        ? t("نتائج البحث: " + visible.length + " من " + products.length, "Search results: " + visible.length + " of " + products.length)
        : t("عدد المنتجات: " + products.length, "Products: " + products.length);
    }
    if (!list) return;
    list.style.display = "grid";
    list.style.opacity = "1";
    list.style.transform = "none";
    var panel = list.closest(".admin-list-panel");
    if (panel) { panel.style.opacity = "1"; panel.style.transform = "none"; panel.style.visibility = "visible"; }
    if (!products.length) {
      list.innerHTML = '<div class="admin-empty">' + t("لا توجد منتجات.", "No products.") + '</div>';
      return;
    }
    if (!visible.length) {
      list.innerHTML = '<div class="admin-empty">' + t("لا توجد نتائج مطابقة للبحث.", "No products match your search.") + '</div>';
      return;
    }
    list.innerHTML = visible.map(function (product) {
      var name = lang() === "en" ? product.en || product.ar : product.ar;
      var category = lang() === "en" ? product.categoryEn || product.categoryAr : product.categoryAr;
      return '<article class="admin-product-card"><div class="admin-product-image"><img src="' + escapeHtml(product.imageUrl || "assets/images/product-placeholder.svg") + '" alt="' + escapeHtml(product.ar) + '"></div><div class="admin-product-info"><strong>' + escapeHtml(name) + '</strong><small>#' + escapeHtml(product.id) + '</small><span>' + escapeHtml(category) + '</span></div><div class="admin-product-actions"><button type="button" class="button secondary" data-edit-product="' + escapeHtml(product.id) + '">' + t("تعديل", "Edit") + '</button><button type="button" class="danger-button" data-delete-product="' + escapeHtml(product.id) + '">' + t("حذف", "Delete") + '</button></div></article>';
    }).join("");
  }
  function setupForm() {
    var form = one("[data-product-form]");
    var cancel = one("[data-product-cancel]");
    var imageFile = field("product-image-file");
    var categoryAr = field("product-category-ar");
    if (!form) return;
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var product = productFromForm();
      if (!product.ar) { setMessage("اكتب اسم المنتج أولًا.", "Enter the product name first.", "error"); return; }
      var url = API_BASE + "/api/products" + (editingId ? "/" + encodeURIComponent(editingId) : "");
      var method = editingId ? "PUT" : "POST";
      try {
        var response = await fetch(url, { method: method, headers: headers(), body: JSON.stringify(product) });
        if (!response.ok) throw new Error("save failed");
        await loadProducts();
        resetForm();
        window.dispatchEvent(new CustomEvent("nana:products-updated"));
        setMessage("تم حفظ المنتج بنجاح وسيظهر لكل الزوار.", "Product saved successfully and will appear for all visitors.", "success");
      } catch (error) { setMessage("تعذر حفظ المنتج. تأكد أنك مسجل دخول.", "Could not save product. Make sure you are signed in.", "error"); }
    });
    if (cancel) cancel.addEventListener("click", resetForm);
    if (categoryAr) categoryAr.addEventListener("change", function () { field("product-category-en").value = translateCategory(categoryAr.value); });
    if (imageFile) imageFile.addEventListener("change", function () {
      var file = imageFile.files && imageFile.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.addEventListener("load", function () { currentImage = String(reader.result || ""); setMessage("تم تجهيز صورة المنتج.", "Product image is ready.", "success"); });
      reader.readAsDataURL(file);
    });
  }
  function setupActions() {
    var list = one("[data-admin-products-list]"); if (!list) return;
    list.addEventListener("click", async function (event) {
      var edit = event.target.closest("[data-edit-product]");
      var del = event.target.closest("[data-delete-product]");
      if (edit) {
        var product = products.filter(function (item) { return String(item.id) === String(edit.dataset.editProduct); })[0];
        if (product) fillForm(product);
      }
      if (del && window.confirm(t("هل تريد حذف هذا المنتج؟", "Delete this product?"))) {
        try {
          var response = await fetch(API_BASE + "/api/products/" + encodeURIComponent(del.dataset.deleteProduct), { method: "DELETE", headers: { Authorization: "Bearer " + token() } });
          if (!response.ok) throw new Error("delete failed");
          await loadProducts(); window.dispatchEvent(new CustomEvent("nana:products-updated")); setMessage("تم حذف المنتج.", "Product deleted.", "success");
        } catch (error) { setMessage("تعذر حذف المنتج.", "Could not delete product.", "error"); }
      }
    });
  }
  function setupSearch() {
    var input = one("[data-admin-products-search]");
    if (!input) return;
    input.addEventListener("input", function () {
      searchTerm = input.value || "";
      render();
    });
  }
  setupForm(); setupActions(); setupSearch(); resetForm(); loadProducts();
  window.addEventListener("nana:language", render);
})();
