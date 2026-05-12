(function () {
  "use strict";

  var API_BASE = window.NANA_API_BASE || (window.location.protocol === "file:" ? "http://localhost:4000" : "");
  var AUTH_KEY = "nana-secret-admin-token";
  var DEFAULT_IMAGE = "assets/images/news-chairman.svg";
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
      videoUrl: String(source.videoUrl || "").trim()
    };
  }
  function sortPosts(posts) {
    return (posts || []).filter(function (post) {
      return post && post.id && post.titleAr;
    }).sort(function (a, b) {
      return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
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
        '<div class="article-cover"><img src="' + escapeHtml(post.imageUrl || DEFAULT_IMAGE) + '" alt="' + escapeHtml(post.titleEn || post.titleAr) + '" loading="lazy"></div>' +
        '<p class="meta" data-ar="' + escapeHtml(metaText(post, "ar")) + '" data-en="' + escapeHtml(metaText(post, "en")) + '">' + escapeHtml(metaText(post, "ar")) + '</p>' +
        '<h2 data-ar="' + escapeHtml(post.titleAr) + '" data-en="' + escapeHtml(post.titleEn || post.titleAr) + '">' + escapeHtml(post.titleAr) + '</h2>' +
        '<p data-ar="' + escapeHtml(post.excerptAr) + '" data-en="' + escapeHtml(post.excerptEn || post.excerptAr) + '">' + escapeHtml(post.excerptAr) + '</p>' +
        video + '<div class="news-actions">' + videoButton + '<button class="expand-button" type="button" aria-expanded="false" data-expand-button data-open-ar="قراءة التفاصيل" data-close-ar="إخفاء التفاصيل" data-open-en="Read details" data-close-en="Hide details">قراءة التفاصيل</button></div>' +
        '<div class="news-detail" data-expand-panel>' + bodyMarkup(post) + '</div>' +
      '</article>';
  }
  function latestCardMarkup(post) {
    return '' +
      '<article class="latest-news-card is-visible" data-custom-latest-news>' +
        '<img src="' + escapeHtml(post.imageUrl || DEFAULT_IMAGE) + '" alt="' + escapeHtml(post.titleEn || post.titleAr) + '" loading="lazy">' +
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
      Array.prototype.slice.call(list.querySelectorAll("[data-custom-news]")).forEach(function (item) { item.remove(); });
      if (posts.length) list.insertAdjacentHTML("afterbegin", posts.map(articleMarkup).join(""));
    }
    if (aside) {
      Array.prototype.slice.call(aside.querySelectorAll("[data-custom-news-link]")).forEach(function (item) { item.remove(); });
      if (posts.length) {
        aside.insertAdjacentHTML("afterbegin", posts.slice(0, 5).map(function (post) {
          return '<a href="#' + escapeHtml(post.id) + '" data-custom-news-link data-ar="' + escapeHtml(post.titleAr) + '" data-en="' + escapeHtml(post.titleEn || post.titleAr) + '">' + escapeHtml(post.titleAr) + '</a>';
        }).join(""));
      }
    }
  }
  function renderLatestNews() {
    var grid = document.querySelector("[data-latest-news-list]");
    var posts = getPosts().slice(0, 3);
    if (!grid) return;
    Array.prototype.slice.call(grid.querySelectorAll("[data-custom-latest-news]")).forEach(function (item) { item.remove(); });
    if (posts.length) grid.insertAdjacentHTML("afterbegin", posts.map(latestCardMarkup).join(""));
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
    renderNewsPage: renderNewsPage
  };

  fetchPosts().catch(function () {
    renderNewsPage();
    renderLatestNews();
  });
})();
