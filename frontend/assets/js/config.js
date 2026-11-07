(function () {
  "use strict";

  // Local frontend (including a static server on :3000) talks to the API on :4000.
  // For production, change this default to your public API origin, for example
  // "https://api.example.com", or set window.NANA_API_BASE before loading this file.
  // Set it to "" for a same-origin reverse proxy routing /api and /uploads to the API.
  // This is public configuration, not a place for secrets. No Node server is required.
  if (typeof window.NANA_API_BASE !== "string") {
    window.NANA_API_BASE = "http://localhost:4000";
  }
  window.NANA_API_BASE = window.NANA_API_BASE.replace(/\/+$/, "");

  function apiUrl(path) {
    return window.NANA_API_BASE + "/" + String(path).replace(/^\/+/, "");
  }

  function mediaUrl(value) {
    if (typeof value !== "string") return value;
    // Only backend upload paths move origins; assets/images, absolute external
    // URLs, protocol-relative URLs, and data/blob URLs remain frontend-owned/as-is.
    var path = value.trim();
    return /^\/?uploads\//.test(path) ? apiUrl(path) : value;
  }

  window.NanaConfig = { apiUrl: apiUrl, mediaUrl: mediaUrl };
})();
