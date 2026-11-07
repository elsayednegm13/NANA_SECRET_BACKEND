(function () {
  "use strict";

  var store = window.NanaNews;
  var editingId = "";
  var currentImage = "";
  if (!store) return;

  function one(selector, scope) { return (scope || document).querySelector(selector); }
  function all(selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); }
  function lang() { return document.documentElement.lang === "en" ? "en" : "ar"; }
  function t(ar, en) { return lang() === "en" ? en : ar; }
  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function field(id) { return one("#" + id); }
  function setMessage(ar, en, type) {
    var message = one("[data-admin-message]");
    if (message) { message.textContent = t(ar, en); message.dataset.type = type || "info"; }
  }
  function isAuthenticated() { return Boolean(sessionStorage.getItem(store.authKey)); }
  function togglePanels() {
    var login = one("[data-admin-login]");
    var panel = one("[data-admin-panel]");
    var authenticated = isAuthenticated();
    if (login) login.hidden = authenticated;
    if (panel) panel.hidden = !authenticated;
    if (authenticated) renderList();
  }
  function resetForm() {
    var form = one("[data-news-form]");
    editingId = ""; currentImage = "";
    if (form) form.reset();
    updateImagePreview(""); updateSubmitState();
  }
  function updateSubmitState() {
    var submit = one("[data-news-submit]");
    var cancel = one("[data-news-cancel]");
    if (submit) submit.textContent = editingId ? t("حفظ التعديل", "Save changes") : t("نشر الخبر", "Publish story");
    if (cancel) cancel.hidden = !editingId;
  }
  function updateImagePreview(src) {
    var preview = one("[data-image-preview]");
    var image = src || (field("news-image-url") ? field("news-image-url").value.trim() : "") || store.defaultImage;
    if (preview) preview.src = window.NanaConfig.mediaUrl(image);
  }
  function postFromForm() {
    return {
      id: editingId,
      titleAr: field("news-title-ar").value,
      titleEn: field("news-title-en").value,
      authorAr: field("news-author-ar").value,
      authorEn: field("news-author-en").value,
      dateAr: field("news-date-ar").value,
      dateEn: field("news-date-en").value,
      excerptAr: field("news-excerpt-ar").value,
      excerptEn: field("news-excerpt-en").value,
      bodyAr: field("news-body-ar").value,
      bodyEn: field("news-body-en").value,
      imageUrl: currentImage || field("news-image-url").value.trim() || store.defaultImage,
      videoUrl: field("news-video-url").value
    };
  }
  function fillForm(post) {
    editingId = post.id; currentImage = post.imageUrl || "";
    field("news-title-ar").value = post.titleAr || "";
    field("news-title-en").value = post.titleEn || "";
    field("news-author-ar").value = post.authorAr || "";
    field("news-author-en").value = post.authorEn || "";
    field("news-date-ar").value = post.dateAr || "";
    field("news-date-en").value = post.dateEn || "";
    field("news-excerpt-ar").value = post.excerptAr || "";
    field("news-excerpt-en").value = post.excerptEn || "";
    field("news-body-ar").value = post.bodyAr || "";
    field("news-body-en").value = post.bodyEn || "";
    field("news-image-url").value = post.imageUrl && !/^data:/i.test(post.imageUrl) ? post.imageUrl : "";
    field("news-video-url").value = post.videoUrl || "";
    updateImagePreview(currentImage); updateSubmitState();
    one("[data-news-form]").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function validatePost(post) {
    if (!post.titleAr || !post.authorAr || !post.dateAr || !post.excerptAr || !post.bodyAr) {
      setMessage("من فضلك أكمل الحقول العربية الأساسية قبل النشر.", "Please complete the required Arabic fields before publishing.", "error");
      return false;
    }
    return true;
  }
  function renderList() {
    var list = one("[data-admin-news-list]");
    var count = one("[data-news-count]");
    var posts = store.getPosts();
    if (count) count.textContent = t("عدد الأخبار المضافة: " + posts.length, "Added stories: " + posts.length);
    if (!list) return;
    if (!posts.length) {
      list.innerHTML = '<div class="admin-empty" data-ar="لا توجد أخبار مضافة من لوحة التحكم حتى الآن." data-en="No stories have been added from the dashboard yet.">' + t("لا توجد أخبار مضافة من لوحة التحكم حتى الآن.", "No stories have been added from the dashboard yet.") + '</div>';
      return;
    }
    list.innerHTML = posts.map(function (post) {
      return '<article class="admin-news-row"><img src="' + escapeHtml(window.NanaConfig.mediaUrl(post.imageUrl || store.defaultImage)) + '" alt="' + escapeHtml(post.titleEn || post.titleAr) + '"><div class="admin-news-row-content"><strong>' + escapeHtml(lang() === "en" ? post.titleEn || post.titleAr : post.titleAr) + '</strong><span>' + escapeHtml(lang() === "en" ? post.authorEn || post.authorAr : post.authorAr) + ' / ' + escapeHtml(lang() === "en" ? post.dateEn || post.dateAr : post.dateAr) + '</span><p>' + escapeHtml(lang() === "en" ? post.excerptEn || post.excerptAr : post.excerptAr) + '</p></div><div class="admin-row-actions"><button type="button" class="button secondary" data-edit-news="' + escapeHtml(post.id) + '">' + t("تعديل", "Edit") + '</button><button type="button" class="danger-button" data-delete-news="' + escapeHtml(post.id) + '">' + t("حذف", "Delete") + '</button></div></article>';
    }).join("");
  }
  function setupLogin() {
    var form = one("[data-login-form]");
    var logout = one("[data-admin-logout]");
    if (form) {
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        try {
          await store.login(field("admin-username").value.trim(), field("admin-password").value.trim());
          form.reset(); setMessage("تم تسجيل الدخول بنجاح.", "Signed in successfully.", "success"); togglePanels();
        } catch (error) { setMessage("بيانات الدخول غير صحيحة.", "Incorrect login.", "error"); }
      });
    }
    if (logout) {
      logout.addEventListener("click", async function () {
        await store.logout(); setMessage("تم تسجيل الخروج.", "Signed out.", "info"); togglePanels();
      });
    }
  }
  function setupForm() {
    var form = one("[data-news-form]");
    var cancel = one("[data-news-cancel]");
    var imageFile = field("news-image-file");
    var imageUrl = field("news-image-url");
    if (!form) return;
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var post = postFromForm();
      if (!validatePost(post)) return;
      try {
        await store.upsertPost(post); resetForm(); renderList();
        setMessage("تم حفظ الخبر بنجاح وسيظهر لكل الزوار.", "Story saved successfully and will appear for all visitors.", "success");
      } catch (error) { setMessage("حدث خطأ أثناء حفظ الخبر.", "An error occurred while saving the story.", "error"); }
    });
    if (cancel) cancel.addEventListener("click", function () { resetForm(); setMessage("تم إلغاء التعديل.", "Edit canceled.", "info"); });
    if (imageUrl) imageUrl.addEventListener("input", function () { currentImage = ""; updateImagePreview(""); });
    if (imageFile) {
      imageFile.addEventListener("change", function () {
        var file = imageFile.files && imageFile.files[0]; if (!file) return;
        var reader = new FileReader();
        reader.addEventListener("load", function () { currentImage = String(reader.result || ""); updateImagePreview(currentImage); setMessage("تم تجهيز الصورة للخبر.", "Image is ready for the story.", "success"); });
        reader.readAsDataURL(file);
      });
    }
  }
  function setupListActions() {
    var list = one("[data-admin-news-list]"); if (!list) return;
    list.addEventListener("click", async function (event) {
      var editButton = event.target.closest("[data-edit-news]");
      var deleteButton = event.target.closest("[data-delete-news]");
      if (editButton) {
        var post = store.findPost(editButton.dataset.editNews);
        if (post) { fillForm(post); setMessage("أنت الآن تعدل الخبر المحدد.", "You are editing the selected story.", "info"); }
      }
      if (deleteButton && window.confirm(t("هل تريد حذف هذا الخبر؟", "Delete this story?"))) {
        try { await store.removePost(deleteButton.dataset.deleteNews); renderList(); resetForm(); setMessage("تم حذف الخبر.", "Story deleted.", "success"); }
        catch (error) { setMessage("تعذر حذف الخبر.", "Could not delete story.", "error"); }
      }
    });
  }
  function setupImportExport() {
    var exportButton = one("[data-export-news]");
    var importInput = one("[data-import-news]");
    if (exportButton) exportButton.addEventListener("click", function () {
      var data = JSON.stringify(store.getPosts(), null, 2);
      var blob = new Blob([data], { type: "application/json" });
      var link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "nana-secret-news.json"; link.click(); URL.revokeObjectURL(link.href);
    });
    if (importInput) importInput.addEventListener("change", function () {
      var file = importInput.files && importInput.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.addEventListener("load", async function () {
        var parsed;
        try { parsed = JSON.parse(String(reader.result || "[]")); } catch (error) { setMessage("ملف الأخبار غير صالح.", "Invalid news file.", "error"); return; }
        if (!Array.isArray(parsed)) { setMessage("ملف الأخبار يجب أن يحتوي على قائمة أخبار.", "News file must contain an array of stories.", "error"); return; }
        if (window.confirm(t("سيتم استبدال الأخبار المضافة حاليًا. هل تريد المتابعة؟", "Current dashboard stories will be replaced. Continue?"))) {
          try { await store.replacePosts(parsed); renderList(); resetForm(); setMessage("تم استيراد الأخبار بنجاح.", "Stories imported successfully.", "success"); }
          catch (error) { setMessage("تعذر استيراد الأخبار.", "Could not import stories.", "error"); }
        }
      });
      reader.readAsText(file);
    });
  }

  setupLogin(); setupForm(); setupListActions(); setupImportExport(); togglePanels(); updateSubmitState();
  window.addEventListener("nana:news-loaded", renderList);
  window.addEventListener("nana:language", function () { updateSubmitState(); renderList(); });
})();
