"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.join(__dirname, "..");
const scripts = path.join(root, "assets", "js");
const source = (name) => fs.readFileSync(path.join(scripts, name), "utf8");

class MockEvent {
  constructor(type, options = {}) {
    Object.assign(this, { type, defaultPrevented: false }, options);
  }
  preventDefault() { this.defaultPrevented = true; }
}

function invokeHandlers(target, event) {
  event.target = event.target || target;
  event.currentTarget = target;
  const handlers = (target.listeners[event.type] || []).slice();
  if (typeof target["on" + event.type] === "function") handlers.push(target["on" + event.type]);
  return handlers.map((handler) => handler.call(target, event));
}

// Browser dispatch is synchronous; this test helper also waits for async handlers.
// It does not simulate propagation, layout, navigation, or browser networking.
async function dispatch(target, type, options = {}) {
  const event = new MockEvent(type, options);
  await Promise.all(invokeHandlers(target, event));
  return event;
}

function element() {
  return {
    dataset: {}, style: { setProperty() {} }, classList: { add() {}, toggle() {} },
    textContent: "", innerHTML: "", value: "", listeners: {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener(name, callback) {
      const handlers = this.listeners[name] || (this.listeners[name] = []);
      if (!handlers.includes(callback)) handlers.push(callback);
    },
    dispatchEvent(event) { invokeHandlers(this, event); return !event.defaultPrevented; },
    setAttribute(name, value) { this[name] = value; }, closest() { return null; }
  };
}

function storage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function browser(base, nodes = {}, fetchImpl = async () => ({ ok: true, json: async () => [] }), configure = true) {
  const document = Object.assign(element(), {
    body: element(), documentElement: Object.assign(element(), { lang: "ar" }),
    querySelector(selector) { return nodes[selector] || null; }
  });
  const window = Object.assign(element(), {
    document, fetch: fetchImpl, location: { pathname: "/", href: "" },
    localStorage: storage(), sessionStorage: storage(),
    Event: MockEvent, CustomEvent: MockEvent,
    FormData: class {
      constructor(form) {
        this.values = new Map(form.querySelectorAll("input, textarea")
          .filter((field) => field.name && !field.disabled)
          .map((field) => [field.name, field.value]));
      }
      get(key) { return this.values.has(key) ? this.values.get(key) : null; }
    }
  });
  window.window = window;
  if (base !== undefined) window.NANA_API_BASE = base;
  const context = vm.createContext(window);
  if (configure) vm.runInContext(source("config.js"), context);
  assert.equal(context.fetch, fetchImpl, "config must preserve global fetch");
  assert.equal(context.window.fetch, fetchImpl, "window.fetch must alias global fetch");
  return context;
}

// Expose closure functions in the test VM only; production scripts remain unchanged.
function load(context, name, exports = "") {
  const code = source(name).replace(/\}\)\(\);\s*$/, "window.testHooks = {" + exports + "};\n})();");
  const originalFetch = context.fetch;
  vm.runInContext(code, context, { filename: name });
  assert.equal(context.fetch, originalFetch, name + " must preserve global fetch");
  assert.equal(context.window.fetch, originalFetch, name + " must preserve window.fetch");
  return context.window.testHooks;
}

function loadHtmlScripts(context, html, page) {
  const originalFetch = context.fetch;
  const loaded = [];
  for (const [index, match] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].entries()) {
    const attributes = match[1];
    // Current pages use synchronous classic scripts; fail rather than model async/module ordering incorrectly.
    assert.doesNotMatch(attributes, /\b(?:async|defer)\b|\btype\s*=\s*["']module["']/i);
    const src = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    const filename = src ? src[1] : page + ":inline-" + index;
    const code = src ? fs.readFileSync(path.join(root, src[1]), "utf8") : match[2];
    vm.runInContext(code, context, { filename });
    assert.equal(context.fetch, originalFetch, filename + " must preserve global fetch");
    assert.equal(context.window.fetch, originalFetch, filename + " must preserve window.fetch");
    loaded.push(filename);
  }
  return loaded;
}

for (const [name, base, expected] of [
  ["local default", undefined, "http://localhost:4000"],
  ["production", "https://api.example.com///", "https://api.example.com"],
  ["same-origin proxy", "", ""]
]) {
  test("API and upload URLs: " + name, () => {
    const context = browser(base);
    const { apiUrl, mediaUrl } = context.window.NanaConfig;
    assert.equal(context.window.NANA_API_BASE, expected);
    assert.equal(apiUrl("/api/products?all=1"), expected + "/api/products?all=1");
    assert.equal(apiUrl("api/login"), expected + "/api/login");
    for (const upload of ["/uploads/photo.jpg", "uploads/photo.jpg", " uploads/photo.jpg "]) {
      assert.equal(mediaUrl(upload), expected + "/uploads/photo.jpg");
    }
    assert.equal(mediaUrl("uploads/a%20b.jpg?size=2#preview"), expected + "/uploads/a%20b.jpg?size=2#preview");
    for (const value of ["assets/images/logo.webp", "/assets/images/logo.webp", "https://cdn.example.com/uploads/a.jpg", "//cdn.example.com/a.jpg", "data:image/png;base64,abc", "blob:https://example.com/id", "images/uploads/a.jpg", "", null]) {
      assert.equal(mediaUrl(value), value);
    }
    assert.equal(context.window.fetch, context.fetch);
  });
}

test("every functional HTML page loads config first; all JS parses", () => {
  let functionalPages = 0;
  for (const page of fs.readdirSync(root).filter((name) => name.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    const tags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((match) => match[1]);
    if (!tags.length) continue; // Google verification is not a functional page.
    functionalPages += 1;
    assert.equal(tags[0], "assets/js/config.js", page);
    assert.equal(tags.filter((src) => src === "assets/js/config.js").length, 1, page);
    for (const src of tags) assert.ok(fs.existsSync(path.join(root, src)), src);
    assert.doesNotMatch(html, /fetch\("\/"/);
  }
  assert.equal(functionalPages, 8);
  for (const name of fs.readdirSync(scripts).filter((name) => name.endsWith(".js"))) {
    assert.doesNotThrow(() => new vm.Script(source(name), { filename: name }));
  }
});

test("news covers, latest news, video links and gallery resolve uploads without changing saved records", () => {
  const context = browser();
  const hooks = load(context, "news-store.js", "articleMarkup, latestCardMarkup, galleryItemMarkup");
  const post = { id: "1", titleAr: "News", imageUrl: "uploads/news.jpg", videoUrl: "/uploads/video.mp4" };
  assert.match(hooks.articleMarkup(post), /src="http:\/\/localhost:4000\/uploads\/news.jpg"/);
  assert.match(hooks.articleMarkup(post), /href="http:\/\/localhost:4000\/uploads\/video.mp4"/);
  assert.match(hooks.latestCardMarkup(post, 0), /src="http:\/\/localhost:4000\/uploads\/news.jpg"/);
  const gallery = hooks.galleryItemMarkup({ imageUrl: "/uploads/gallery.jpg" });
  assert.match(gallery, /data-src="http:\/\/localhost:4000\/uploads\/gallery.jpg"/);
  assert.match(gallery, /<img src="http:\/\/localhost:4000\/uploads\/gallery.jpg"/);
  assert.equal(post.imageUrl, "uploads/news.jpg");
});

test("public product rendering resolves media and uses the shared API base", async () => {
  const list = element(), calls = [];
  const context = browser("https://api.example.com/", { "[data-products-list]": list }, async (url) => {
    calls.push(url);
    return { ok: true, json: async () => [{ ar: "Product", imageUrl: "uploads/product.jpg" }] };
  });
  const hooks = load(context, "products.js", "loadProducts");
  await hooks.loadProducts();
  assert.equal(calls[0], "https://api.example.com/api/products");
  assert.match(list.innerHTML, /src="https:\/\/api.example.com\/uploads\/product.jpg"/);
});

test("site-content image overrides resolve saved ar upload paths", async () => {
  const image = element();
  image.getAttribute = () => "assets/images/original.jpg";
  const context = browser(undefined, {}, async () => ({ ok: true, json: async () => [{ key: "home-img-0", ar: "uploads/home.jpg", en: "Cover" }] }));
  context.document.querySelectorAll = () => [image];
  const hooks = load(context, "site-content.js", "loadImageOverrides");
  await hooks.loadImageOverrides("home", "main img", "home-img-");
  assert.equal(image.src, "http://localhost:4000/uploads/home.jpg");
  assert.equal(image.alt, "Cover");
});

test("dashboard previews and lists resolve uploads but retain raw input values", () => {
  const box = element(), productList = element(), newsList = element(), galleryList = element();
  const context = browser(undefined, {
    "[data-products-list]": productList, "[data-news-list]": newsList, "[data-gallery-list]": galleryList
  });
  const hooks = load(context, "dashboard.js", "renderEditorFields, bindEditor, renderProducts, renderNews, renderGalleryAdmin, setItems: function(items) { products = news = gallery = items; }");
  const holder = element();
  holder.querySelector = (selector) => selector === "[data-editor-fields]" ? box : null;
  const item = { key: "home-img-0", type: "image", ar: "uploads/cover.jpg", en: "Cover" };
  hooks.renderEditorFields(holder, "home", [item], "");
  assert.match(box.innerHTML, /src="http:\/\/localhost:4000\/uploads\/cover.jpg"/);
  assert.match(box.innerHTML, /value="uploads\/cover.jpg"/);
  hooks.bindEditor(holder, "home", [item]);
  const preview = element(), field = element(), input = element();
  field.querySelector = () => preview;
  Object.assign(input, { value: "/uploads/new.jpg", dataset: { key: item.key, lang: "ar" }, closest: () => field });
  holder.dispatchEvent(new MockEvent("input", { target: { closest: () => input } }));
  assert.equal(preview.src, "http://localhost:4000/uploads/new.jpg");
  assert.equal(item.ar, "/uploads/new.jpg");
  hooks.setItems([{ id: "1", ar: "Product", titleAr: "News", imageUrl: "uploads/item.jpg" }]);
  hooks.renderProducts(); hooks.renderNews(); hooks.renderGalleryAdmin();
  for (const list of [productList, newsList, galleryList]) {
    assert.match(list.innerHTML, /src="http:\/\/localhost:4000\/uploads\/item.jpg"/);
  }
});

test("legacy admin image previews resolve typed upload paths", () => {
  const preview = element(), input = Object.assign(element(), { value: "uploads/legacy.jpg" });
  const context = browser(undefined, { "[data-image-preview]": preview, "#news-image-url": input });
  context.window.NanaNews = { defaultImage: "assets/images/news-chairman.svg", getPosts() { return []; } };
  const hooks = load(context, "admin.js", "updateImagePreview");
  hooks.updateImagePreview("");
  assert.equal(preview.src, "http://localhost:4000/uploads/legacy.jpg");
  assert.equal(input.value, "uploads/legacy.jpg");
});

test("legacy product admin resolves uploads and fetches from the shared base", async () => {
  const list = element(), calls = [];
  const context = browser("https://api.example.com", { "[data-admin-products-list]": list }, async (url) => {
    calls.push(url);
    return { ok: true, json: async () => [{ ar: "Product", imageUrl: "/uploads/legacy-product.jpg" }] };
  });
  const hooks = load(context, "admin-products.js", "loadProducts");
  await hooks.loadProducts();
  assert.equal(calls[0], "https://api.example.com/api/products");
  assert.match(list.innerHTML, /src="https:\/\/api.example.com\/uploads\/legacy-product.jpg"/);
});

test("event mock dispatches multiple listeners and the onsubmit property", async () => {
  const form = element(), calls = [];
  form.addEventListener("submit", async function (event) {
    assert.equal(this, form);
    assert.equal(event.target, form);
    event.preventDefault();
    calls.push("first");
    await Promise.resolve();
    calls.push("completed");
  });
  form.addEventListener("submit", () => calls.push("second"));
  form.onsubmit = () => calls.push("property");
  const event = await dispatch(form, "submit");
  assert.deepEqual(calls, ["first", "second", "property", "completed"]);
  assert.equal(event.defaultPrevented, true);
});

async function checkContactSubmission(html) {
  const form = element(), message = element(), button = element(), calls = [];
  let resets = 0;
  const values = { name: " Name ", phone: "123", email: "name@example.com", message: " Hello " };
  const fields = Object.entries(values).map(([name, value]) => Object.assign(element(), {
    name, value, required: name !== "email", type: name === "email" ? "email" : "text", validity: { valid: true }
  }));
  form.querySelectorAll = (selector) => selector === "input, textarea" ? fields : [];
  form.querySelector = (selector) => selector === 'button[type="submit"]' ? button : null;
  form.reset = () => { resets += 1; };
  const context = browser("https://api.example.com/", {
    "form": form, "[data-contact-form]": form, "[data-form-message]": message
  }, async (url, options = {}) => {
    calls.push({ url, options });
    return { ok: true, json: async () => options.method === "POST" ? { ok: true } : [] };
  }, false);
  context.document.body.dataset.page = "contact";
  const originalFetch = context.fetch;
  const loaded = loadHtmlScripts(context, html, "contact.html");
  assert.ok(loaded.includes("assets/js/main.js"));
  await dispatch(context.document, "DOMContentLoaded");
  const event = await dispatch(form, "submit");
  const submissions = calls.filter((call) => call.options.method === "POST");
  assert.equal(submissions.length, 1, "one submission across all page scripts");
  assert.equal(submissions[0].url, "https://api.example.com/api/contact");
  assert.equal(submissions[0].options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(submissions[0].options.body), {
    name: "Name", phone: "123", email: "name@example.com", message: "Hello"
  });
  assert.equal(event.defaultPrevented, true);
  assert.equal(message.dataset.type, "success");
  assert.equal(button.disabled, false);
  assert.equal(resets, 1);
  assert.equal(context.fetch, originalFetch);
  assert.equal(context.window.fetch, originalFetch);
}

test("contact page scripts submit once to the configured JSON API", async () => {
  await checkContactSubmission(fs.readFileSync(path.join(root, "contact.html"), "utf8"));
});

test("contact page test detects an additional inline submit handler", async () => {
  const html = fs.readFileSync(path.join(root, "contact.html"), "utf8");
  const duplicate = '<script>document.querySelector("form").addEventListener("submit", function(event) { event.preventDefault(); return fetch("/", { method: "POST" }); });</script>';
  await assert.rejects(() => checkContactSubmission(html.replace("</body>", duplicate + "</body>")), /one submission across all page scripts/);
});

test("HTML script loader preserves inline and external DOM order and detects fetch replacement", () => {
  const context = browser();
  context.order = [];
  const html = '<script>window.order.push("before"); window.NANA_API_BASE = "https://api.example.com///";</script>' +
    '<script src="assets/js/config.js"></script>' +
    '<script>window.order.push(window.NANA_API_BASE);</script>';
  loadHtmlScripts(context, html, "fixture.html");
  assert.deepEqual(context.order, ["before", "https://api.example.com"]);
  assert.throws(() => loadHtmlScripts(context, '<script>window.fetch = function() {};</script>', "fixture.html"), /must preserve global fetch/);
});

test("dashboard login stores its token, authorizes initialization and fetches frontend HTML for base items", async () => {
  const form = element(), dashboard = element(), userName = element(), calls = [];
  const nodes = {
    "[data-login-form]": form,
    "#admin-username": Object.assign(element(), { value: " admin " }),
    "#admin-password": Object.assign(element(), { value: " password " }),
    "[data-user-name]": userName
  };
  const html = '<main><img src="assets/images/cover.jpg" alt="Cover"></main>';
  const context = browser("https://api.example.com/", nodes, async (url, options = {}) => {
    calls.push({ url, options });
    if (url === "index.html") return { ok: true, text: async () => html };
    const responses = {
      "https://api.example.com/api/login": { token: "test-token" },
      "https://api.example.com/api/me": { user: "admin", name: "Administrator" },
      "https://api.example.com/api/stats": {},
      "https://api.example.com/api/users": []
    };
    assert.ok(Object.hasOwn(responses, url), "unexpected dashboard request: " + url);
    return { ok: true, text: async () => JSON.stringify(responses[url]) };
  });
  const originalFetch = context.fetch;
  const hooks = load(context, "dashboard.js", "initSession, getBaseItems");
  await dispatch(context.document, "DOMContentLoaded");
  assert.equal(calls.length, 0, "logged-out initialization must not issue authorized requests");
  await dispatch(form, "submit");
  assert.equal(calls[0].url, "https://api.example.com/api/login");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].options.body), { username: "admin", password: "password" });
  assert.equal(context.sessionStorage.getItem("nana-secret-admin-token"), "test-token");
  assert.equal(context.location.href, "admin.html");

  delete nodes["[data-login-form]"];
  nodes["[data-dashboard]"] = dashboard;
  await hooks.initSession();
  for (const endpoint of ["me", "stats", "users"]) {
    const call = calls.find((entry) => entry.url === "https://api.example.com/api/" + endpoint);
    assert.ok(call, endpoint + " must be requested during initialization");
    assert.equal(call.options.headers.Authorization, "Bearer test-token");
  }
  assert.equal(context.sessionStorage.getItem("nana-secret-admin-token"), "test-token");
  assert.equal(userName.textContent, "Administrator");
  assert.equal(dashboard.hidden, false);

  const parsed = [];
  const image = Object.assign(element(), {
    getAttribute(name) { return { src: "assets/images/cover.jpg", alt: "Cover" }[name] || null; }
  });
  // Stub the parser boundary, not HTML parsing itself: verify its input and the
  // selector/extraction wiring against the returned document-shaped fixture.
  context.DOMParser = class {
    parseFromString(input, type) {
      parsed.push({ input, type });
      return { querySelectorAll(selector) { assert.equal(selector, "main img, footer img"); return [image]; } };
    }
  };
  const items = await hooks.getBaseItems("home");
  assert.deepEqual(parsed, [{ input: html, type: "text/html" }]);
  assert.deepEqual(JSON.parse(JSON.stringify(items)), [{ key: "home-img-0", type: "image", ar: "assets/images/cover.jpg", en: "Cover" }]);
  assert.equal(calls.at(-1).url, "index.html", "base HTML must remain on the frontend, not the API origin");
  assert.equal(calls.at(-1).options.headers, undefined, "frontend HTML fetch must not send the API bearer token");
  assert.equal(context.fetch, originalFetch);
  assert.equal(context.window.fetch, originalFetch);
});

test("dev server exposes HTML and assets only", async (t) => {
  const app = require("../server");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const origin = "http://127.0.0.1:" + server.address().port;
  for (const page of ["/", ...fs.readdirSync(root).filter((name) => name.endsWith(".html")).map((name) => "/" + name)]) {
    const response = await fetch(origin + page);
    assert.equal(response.status, 200, page);
    assert.match(response.headers.get("content-type"), /text\/html/);
    await response.arrayBuffer();
  }
  for (const asset of ["/assets/js/config.js", "/assets/css/styles.css", "/assets/images/logo.webp"]) {
    const response = await fetch(origin + asset);
    assert.equal(response.status, 200, asset);
    await response.arrayBuffer();
  }
  for (const hidden of ["/package.json", "/package-lock.json", "/server.js", "/node_modules/express/package.json", "/tests/frontend.test.js", "/.gitignore", "/api/products", "/uploads/photo.jpg", "/assets", "/assets/", "/assets/../server.js", "/assets/%2e%2e%2fserver.js", "/assets/.gitignore", "/missing.html"]) {
    const response = await fetch(origin + hidden);
    assert.equal(response.status, 404, hidden);
    await response.arrayBuffer();
  }
  assert.equal((await fetch(origin + "/", { method: "POST" })).status, 404);
});
