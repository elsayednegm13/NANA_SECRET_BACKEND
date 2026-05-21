(function () {
  "use strict";

  var API_BASE = window.NANA_API_BASE || (window.location.protocol === "file:" ? "http://localhost:4000" : "");
  var AUTH_KEY = "nana-secret-admin-token";
  var DEFAULT_IMAGE = "assets/images/news-chairman.svg";
  var FALLBACK_NEWS_IMAGES = ["assets/images/event-1.jpg", "assets/images/event-2.jpg", "assets/images/news-chairman.svg"];
  function newsImage(post, index) {
    var src = String((post && post.imageUrl) || "").trim();
    return src || FALLBACK_NEWS_IMAGES[index % FALLBACK_NEWS_IMAGES.length] || DEFAULT_IMAGE;
  }
  var ADMIN_USER = "ADMIN";
  var ADMIN_PASS = "123";
  var cache = [];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function authHeaders() {
    var token = sessionStorage.getItem(AUTH_KEY) || "";
    return token ? { Authorization: "Bearer " + token } : {};
  }
  function jsonHeaders() {
    return Object.assign({ "Content-Type": "application/json" }, authHeaders());
  }
  function normalizePost(input, existing) {
    var now = new Date().toISOString();
    var source = input || {};
    var current = existing || {};
    return {
      id: current.id || source.id || "custom-news-" + Date.now(),
      createdAt: current.createdAt || source.createdAt || now,
      updatedAt: source.updatedAt || now,
      titleAr: String(source.titleAr || "").trim(),
      titleEn: String(source.titleEn || source.titleAr || "").trim(),
      authorAr: String(source.authorAr || "من الإدارة").trim(),
      authorEn: String(source.authorEn || "From Management").trim(),
      dateAr: String(source.dateAr || "").trim(),
      dateEn: String(source.dateEn || source.dateAr || "").trim(),
      excerptAr: String(source.excerptAr || "").trim(),
      excerptEn: String(source.excerptEn || source.excerptAr || "").trim(),
      bodyAr: String(source.bodyAr || "").trim(),
      bodyEn: String(source.bodyEn || source.bodyAr || "").trim(),
      imageUrl: String(source.imageUrl || DEFAULT_IMAGE).trim(),
      videoUrl: String(source.videoUrl || "").trim(),
      isPublished: Number(source.isPublished) === 0 ? 0 : 1
    };
  }
  function sortPosts(posts) {
    return (posts || []).filter(function (post) {
      return post && post.id && post.titleAr && Number(post.isPublished) !== 0;
    }).sort(function (a, b) {
      var ao = Number(a.sortOrder || 0);
      var bo = Number(b.sortOrder || 0);
      if (ao || bo) return (ao || 999999) - (bo || 999999);
      return String(a.createdAt || a.updatedAt || "").localeCompare(String(b.createdAt || b.updatedAt || ""));
    });
  }
  function getPosts() { return cache.slice(); }
  function setCache(posts) { cache = sortPosts(posts); }
  function findPost(id) {
    return cache.filter(function (post) { return String(post.id) === String(id); })[0] || null;
  }
  async function fetchPosts() {
    var response = await fetch(API_BASE + "/api/news");
    if (!response.ok) throw new Error("Cannot load news");
    setCache(await response.json());
    renderNewsPage();
    renderLatestNews();
    window.dispatchEvent(new CustomEvent("nana:news-loaded"));
    return getPosts();
  }
  async function login(username, password) {
    var response = await fetch(API_BASE + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username, password: password })
    });
    if (!response.ok) throw new Error("Invalid login");
    var data = await response.json();
    sessionStorage.setItem(AUTH_KEY, data.token);
    return data;
  }
  async function logout() {
    try { await fetch(API_BASE + "/api/logout", { method: "POST", headers: authHeaders() }); } catch (error) {}
    sessionStorage.removeItem(AUTH_KEY);
  }
  async function upsertPost(input) {
    var existing = input.id ? findPost(input.id) : null;
    var method = existing ? "PUT" : "POST";
    var url = API_BASE + "/api/news" + (existing ? "/" + encodeURIComponent(input.id) : "");
    var response = await fetch(url, { method: method, headers: jsonHeaders(), body: JSON.stringify(input) });
    if (!response.ok) throw new Error("Cannot save story");
    await fetchPosts();
    return response.json();
  }
  async function removePost(id) {
    var response = await fetch(API_BASE + "/api/news/" + encodeURIComponent(id), { method: "DELETE", headers: authHeaders() });
    if (!response.ok) throw new Error("Cannot delete story");
    await fetchPosts();
  }
  async function replacePosts(rawPosts) {
    var posts = Array.isArray(rawPosts) ? rawPosts.map(function (post) { return normalizePost(post, post); }) : [];
    var response = await fetch(API_BASE + "/api/news/import/replace", { method: "PUT", headers: jsonHeaders(), body: JSON.stringify(posts) });
    if (!response.ok) throw new Error("Cannot import stories");
    await fetchPosts();
  }
  function splitParagraphs(value) {
    return String(value || "").split(/\n+/).map(function (part) { return part.trim(); }).filter(Boolean);
  }
  function metaText(post, lang) {
    var author = lang === "en" ? post.authorEn : post.authorAr;
    var date = lang === "en" ? post.dateEn : post.dateAr;
    return [author, date].filter(Boolean).join(" / ");
  }
  function bodyMarkup(post) {
    var arParts = splitParagraphs(post.bodyAr);
    var enParts = splitParagraphs(post.bodyEn || post.bodyAr);
    var length = Math.max(arParts.length, enParts.length);
    var html = "";
    for (var index = 0; index < length; index += 1) {
      html += '<p data-ar="' + escapeHtml(arParts[index] || enParts[index] || "") + '" data-en="' + escapeHtml(enParts[index] || arParts[index] || "") + '">' +
        escapeHtml(arParts[index] || enParts[index] || "") + "</p>";
    }
    return html;
  }
  function facebookEmbedUrl(url) {
    if (!/facebook\.com/i.test(url || "")) return "";
    return "https://www.facebook.com/plugins/video.php?href=" + encodeURIComponent(url) + "&show_text=false&width=734";
  }
  function articleMarkup(post) {
    var id = escapeHtml(post.id);
    var video = "";
    var videoUrl = post.videoUrl ? escapeHtml(post.videoUrl) : "";
    var embedUrl = facebookEmbedUrl(post.videoUrl);
    var videoButton = "";
    if (embedUrl) {
      video = '<div class="news-video"><iframe title="' + escapeHtml(post.titleEn || post.titleAr) + '" src="' + escapeHtml(embedUrl) + '" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe></div>';
    }
    if (videoUrl) {
      videoButton = '<a class="button secondary" href="' + videoUrl + '" target="_blank" rel="noopener" data-ar="فتح رابط الفيديو" data-en="Open video link">فتح رابط الفيديو</a>';
    }
    return '' +
      '<article class="article-card news-article is-visible" id="' + id + '" data-custom-news>' +
        '<div class="article-cover"><img src="' + escapeHtml(newsImage(post, 0)) + '" alt="' + escapeHtml(post.titleEn || post.titleAr) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + DEFAULT_IMAGE + '\';"></div>' +
        '<p class="meta" data-ar="' + escapeHtml(metaText(post, "ar")) + '" data-en="' + escapeHtml(metaText(post, "en")) + '">' + escapeHtml(metaText(post, "ar")) + '</p>' +
        '<h2 data-ar="' + escapeHtml(post.titleAr) + '" data-en="' + escapeHtml(post.titleEn || post.titleAr) + '">' + escapeHtml(post.titleAr) + '</h2>' +
        '<p data-ar="' + escapeHtml(post.excerptAr) + '" data-en="' + escapeHtml(post.excerptEn || post.excerptAr) + '">' + escapeHtml(post.excerptAr) + '</p>' +
        video + '<div class="news-actions">' + videoButton + '<button class="expand-button" type="button" aria-expanded="false" data-expand-button data-open-ar="قراءة التفاصيل" data-close-ar="إخفاء التفاصيل" data-open-en="Read details" data-close-en="Hide details">قراءة التفاصيل</button></div>' +
        '<div class="news-detail" data-expand-panel>' + bodyMarkup(post) + '</div>' +
      '</article>';
  }
  function latestCardMarkup(post, index) {
    return '' +
      '<article class="latest-news-card is-visible" data-custom-latest-news>' +
        '<img src="' + escapeHtml(newsImage(post, index || 0)) + '" alt="' + escapeHtml(post.titleEn || post.titleAr) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + DEFAULT_IMAGE + '\';">' +
        '<div><p class="meta" data-ar="' + escapeHtml(metaText(post, "ar")) + '" data-en="' + escapeHtml(metaText(post, "en")) + '">' + escapeHtml(metaText(post, "ar")) + '</p>' +
        '<h3 data-ar="' + escapeHtml(post.titleAr) + '" data-en="' + escapeHtml(post.titleEn || post.titleAr) + '">' + escapeHtml(post.titleAr) + '</h3>' +
        '<p data-ar="' + escapeHtml(post.excerptAr) + '" data-en="' + escapeHtml(post.excerptEn || post.excerptAr) + '">' + escapeHtml(post.excerptAr) + '</p>' +
        '<a class="text-link" href="news.html#' + escapeHtml(post.id) + '" data-ar="قراءة الخبر" data-en="Read story">قراءة الخبر</a></div>' +
      '</article>';
  }
  function renderNewsPage() {
    var list = document.querySelector("[data-news-list]");
    var aside = document.querySelector("[data-news-aside]");
    var posts = getPosts();
    if (list) {
      // صفحة الأخبار تعرض الآن الأخبار القادمة من لوحة التحكم فقط.
      // هذا يمنع بقاء الأخبار القديمة الثابتة بعد الحذف أو الإخفاء من الداشبورد.
      list.innerHTML = posts.length ? posts.map(articleMarkup).join("") : '<article class="article-card news-article is-visible"><h2 data-ar="لا توجد أخبار منشورة" data-en="No published news">لا توجد أخبار منشورة</h2></article>';
    }
    if (aside) {
      var keepTitle = aside.querySelector("h3");
      aside.innerHTML = "";
      if (keepTitle) aside.appendChild(keepTitle);
      if (posts.length) {
        aside.insertAdjacentHTML("beforeend", posts.slice(0, 5).map(function (post) {
          return '<a href="#' + escapeHtml(post.id) + '" data-custom-news-link data-ar="' + escapeHtml(post.titleAr) + '" data-en="' + escapeHtml(post.titleEn || post.titleAr) + '">' + escapeHtml(post.titleAr) + '</a>';
        }).join(""));
      } else {
        aside.insertAdjacentHTML("beforeend", '<span data-ar="لا توجد أخبار" data-en="No news">لا توجد أخبار</span>');
      }
    }
    window.dispatchEvent(new CustomEvent("nana:news-rendered"));
  }
  function renderLatestNews() {
    var grid = document.querySelector("[data-latest-news-list]");
    var posts = getPosts().slice(0, 3);
    if (!grid) return;
    grid.innerHTML = posts.length ? posts.map(function(post, index){ return latestCardMarkup(post, index); }).join("") : '<p data-ar="لا توجد أخبار منشورة" data-en="No published news">لا توجد أخبار منشورة</p>';
  }



  var DEFAULT_GALLERY = [
    { id: "event-1", imageUrl: "assets/images/event-1.jpg", captionAr: "وضع حجر الأساس لمجمع نانا سيكريت", captionEn: "Foundation stone for NANA SECRET Complex", displayMode: "grid", isPublished: 1 },
    { id: "event-2", imageUrl: "assets/images/event-2.jpg", captionAr: "كلمة خلال فعاليات الاحتفال", captionEn: "Speech during the celebration", displayMode: "grid", isPublished: 1 },
    { id: "event-3", imageUrl: "assets/images/event-3.jpg", captionAr: "عرض تقديمي لهوية نانا سيكريت", captionEn: "NANA SECRET identity presentation", displayMode: "grid", isPublished: 1 },
    { id: "event-4", imageUrl: "assets/images/event-4.jpg", captionAr: "لقاء الضيوف والشركاء", captionEn: "Guests and partners gathering", displayMode: "grid", isPublished: 1 },
    { id: "event-5", imageUrl: "assets/images/event-5.jpg", captionAr: "لحظة وضع حجر الأساس", captionEn: "Foundation stone moment", displayMode: "grid", isPublished: 1 },
    { id: "event-6", imageUrl: "assets/images/event-6.jpg", captionAr: "حضور من قادة الصناعة", captionEn: "Industry leaders attendance", displayMode: "grid", isPublished: 1 },
    { id: "event-7", imageUrl: "assets/images/event-7.jpg", captionAr: "مشاركة الشركاء في الاحتفالية", captionEn: "Partners participating in the event", displayMode: "grid", isPublished: 1 },
    { id: "event-8", imageUrl: "assets/images/event-8.jpg", captionAr: "استقبال الزوار داخل موقع الاحتفال", captionEn: "Welcoming visitors at the event site", displayMode: "grid", isPublished: 1 },
    { id: "event-9", imageUrl: "assets/images/event-9.jpg", captionAr: "صورة جماعية للضيوف", captionEn: "Group photo of guests", displayMode: "grid", isPublished: 1 }
  ];
  var galleryCache = [];
  function galleryItemMarkup(item) {
    var mode = item.displayMode === "wide" ? "wide" : "grid";
    return '<button class="gallery-item reveal is-' + mode + '" type="button" data-src="' + escapeHtml(item.imageUrl) + '" data-caption-ar="' + escapeHtml(item.captionAr || '') + '" data-caption-en="' + escapeHtml(item.captionEn || item.captionAr || '') + '"><img src="' + escapeHtml(item.imageUrl) + '" alt="' + escapeHtml(item.captionEn || item.captionAr || 'NANA SECRET gallery image') + '" loading="lazy"></button>';
  }
  function renderGallery() {
    var gallery = document.querySelector('[data-gallery]');
    if (!gallery) return;
    gallery.innerHTML = galleryCache.length ? galleryCache.map(galleryItemMarkup).join('') : '<p data-ar="لا توجد صور احتفالية منشورة" data-en="No published ceremony photos">لا توجد صور احتفالية منشورة</p>';
    Array.prototype.slice.call(gallery.querySelectorAll('.reveal')).forEach(function(el){ el.classList.add('is-visible'); });
    if (window.NanaMain && typeof window.NanaMain.initGallery === 'function') {
      window.NanaMain.initGallery();
    } else {
      window.dispatchEvent(new CustomEvent('nana:gallery-rendered'));
    }
  }
  async function fetchGallery() {
    var response = await fetch(API_BASE + '/api/gallery');
    if (!response.ok) throw new Error('Cannot load gallery');
    galleryCache = await response.json();
    if (!Array.isArray(galleryCache)) { galleryCache = []; }
    galleryCache = galleryCache.filter(function(item){ return item && item.id && item.imageUrl && Number(item.isPublished) !== 0; }).sort(function(a,b){
      var ao = Number(a.sortOrder || 0);
      var bo = Number(b.sortOrder || 0);
      if (ao || bo) return (ao || 999999) - (bo || 999999);
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
    renderGallery();
    return galleryCache.slice();
  }
  window.NanaNews = {
    adminPass: ADMIN_PASS,
    adminUser: ADMIN_USER,
    authKey: AUTH_KEY,
    defaultImage: DEFAULT_IMAGE,
    findPost: findPost,
    getPosts: getPosts,
    fetchPosts: fetchPosts,
    login: login,
    logout: logout,
    removePost: removePost,
    replacePosts: replacePosts,
    upsertPost: upsertPost,
    renderLatestNews: renderLatestNews,
    renderNewsPage: renderNewsPage,
    fetchGallery: fetchGallery,
    renderGallery: renderGallery
  };

  fetchPosts().catch(function () {
    // لو السيرفر غير متاح لا نمسح الأخبار الثابتة المعروضة في الصفحة.
    if (cache.length) { renderNewsPage(); renderLatestNews(); }
  });
  fetchGallery().catch(function () { galleryCache = DEFAULT_GALLERY.slice(); renderGallery(); });
})();
