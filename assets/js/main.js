(function () {
  "use strict";

  var body = document.body;
  var root = document.documentElement;
  var currentLang = localStorage.getItem("nana-secret-lang") || "ar";
  var galleryState = {
    items: [],
    index: 0,
    lastFocus: null
  };

  body.classList.add("enhanced");

  function all(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function one(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function getLangValue(element, prefix, lang) {
    var key = prefix + (lang === "ar" ? "Ar" : "En");
    return element.dataset[key] || "";
  }

  function formatNumber(value) {
    try {
      return new Intl.NumberFormat(currentLang === "ar" ? "ar-EG" : "en-US").format(value);
    } catch (error) {
      return String(value);
    }
  }

  function updateExpandButtons() {
    all("[data-expand-button]").forEach(function (button) {
      var article = button.closest(".article-card");
      var panel = article ? one("[data-expand-panel]", article) : null;
      var isOpen = panel && panel.classList.contains("is-open");
      var key = isOpen ? "close" : "open";
      var value = button.dataset[key + (currentLang === "ar" ? "Ar" : "En")];
      if (value) {
        button.textContent = value;
      }
      button.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  function applyLanguage(lang) {
    currentLang = lang === "en" ? "en" : "ar";
    var isArabic = currentLang === "ar";

    root.lang = currentLang;
    root.dir = isArabic ? "rtl" : "ltr";
    body.classList.toggle("lang-en", !isArabic);
    localStorage.setItem("nana-secret-lang", currentLang);

    all("[data-ar][data-en]").forEach(function (element) {
      element.textContent = element.dataset[currentLang] || element.textContent;
    });

    all("[data-placeholder-ar][data-placeholder-en]").forEach(function (element) {
      element.placeholder = getLangValue(element, "placeholder", currentLang);
    });

    all("[data-lang-label]").forEach(function (element) {
      element.textContent = isArabic ? "EN" : "AR";
    });

    updateExpandButtons();
    refreshGalleryCaption();
    refreshCounters();
    window.dispatchEvent(new CustomEvent("nana:language", {
      detail: { lang: currentLang }
    }));
  }

  function setupHeader() {
    var header = one("[data-site-header]");
    var toggle = one("[data-menu-toggle]");
    var navPanel = one("[data-nav-panel]");

    function setHeaderState() {
      if (header) {
        header.classList.toggle("is-scrolled", window.scrollY > 6);
      }
    }

    setHeaderState();
    window.addEventListener("scroll", setHeaderState, { passive: true });

    if (toggle && navPanel) {
      toggle.addEventListener("click", function () {
        var isOpen = body.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });

      all(".nav-link", navPanel).forEach(function (link) {
        link.addEventListener("click", function () {
          body.classList.remove("nav-open");
          toggle.setAttribute("aria-expanded", "false");
        });
      });
    }
  }

  function setupLanguageToggle() {
    all("[data-lang-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        applyLanguage(currentLang === "ar" ? "en" : "ar");
      });
    });

    applyLanguage(currentLang);
  }

  function setupSlider() {
    var slider = one("[data-slider]");
    if (!slider) {
      return;
    }

    var slides = all(".hero-slide", slider);
    var dotsWrap = one("[data-slider-dots]", slider);
    var next = one("[data-slider-next]", slider);
    var prev = one("[data-slider-prev]", slider);
    var index = 0;
    var timer = null;

    function activate(nextIndex) {
      index = (nextIndex + slides.length) % slides.length;
      slides.forEach(function (slide, slideIndex) {
        slide.classList.toggle("is-active", slideIndex === index);
      });
      all(".slider-dot", dotsWrap).forEach(function (dot, dotIndex) {
        dot.classList.toggle("is-active", dotIndex === index);
        dot.setAttribute("aria-current", dotIndex === index ? "true" : "false");
      });
    }

    function start() {
      stop();
      timer = window.setInterval(function () {
        activate(index + 1);
      }, 5600);
    }

    function stop() {
      if (timer) {
        window.clearInterval(timer);
      }
    }

    slides.forEach(function (_, slideIndex) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "slider-dot";
      dot.setAttribute("aria-label", "Go to slide " + (slideIndex + 1));
      dot.addEventListener("click", function () {
        activate(slideIndex);
        start();
      });
      dotsWrap.appendChild(dot);
    });

    if (next) {
      next.addEventListener("click", function () {
        activate(index + 1);
        start();
      });
    }

    if (prev) {
      prev.addEventListener("click", function () {
        activate(index - 1);
        start();
      });
    }

    slider.addEventListener("mouseenter", stop);
    slider.addEventListener("mouseleave", start);
    slider.addEventListener("focusin", stop);
    slider.addEventListener("focusout", start);

    activate(0);
    start();
  }

  function setupReveal() {
    var revealItems = all(".reveal");

    if (!("IntersectionObserver" in window)) {
      revealItems.forEach(function (item) {
        item.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.14
    });

    revealItems.forEach(function (item) {
      observer.observe(item);
    });
  }

  function refreshCounters() {
    all(".counter").forEach(function (counter) {
      if (counter.dataset.done === "true") {
        counter.textContent = formatNumber(Number(counter.dataset.target || "0"));
      }
    });
  }

  function animateCounter(counter) {
    var target = Number(counter.dataset.target || "0");
    var duration = 1500;
    var startTime = null;

    function tick(timestamp) {
      if (!startTime) {
        startTime = timestamp;
      }
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = Math.floor(target * eased);
      counter.textContent = formatNumber(value);

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      } else {
        counter.dataset.done = "true";
        counter.textContent = formatNumber(target);
      }
    }

    window.requestAnimationFrame(tick);
  }

  function setupCounters() {
    var counters = all(".counter");
    if (!counters.length) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      counters.forEach(animateCounter);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.target.dataset.done !== "true") {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.45
    });

    counters.forEach(function (counter) {
      observer.observe(counter);
    });
  }

  function setupExpandableNews() {
    function getArticleFromButton(button) {
      return button ? button.closest(".article-card") : null;
    }

    function getPanelFromButton(button) {
      var article = getArticleFromButton(button);
      return article ? one("[data-expand-panel]", article) : null;
    }

    function setOpen(button, panel, isOpen) {
      if (!button || !panel) {
        return;
      }
      panel.classList.toggle("is-open", isOpen);
      panel.style.maxHeight = isOpen ? panel.scrollHeight + "px" : "0px";
      button.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    function closeOtherPanels(currentPanel) {
      all("[data-expand-panel].is-open").forEach(function (panel) {
        if (panel === currentPanel) {
          return;
        }
        var article = panel.closest(".article-card");
        var button = article ? one("[data-expand-button]", article) : null;
        setOpen(button, panel, false);
      });
    }

    function refreshPanels() {
      all("[data-expand-button]").forEach(function (button) {
        var panel = getPanelFromButton(button);
        if (!panel) {
          return;
        }
        setOpen(button, panel, panel.classList.contains("is-open"));
      });
      updateExpandButtons();
    }

    document.addEventListener("click", function (event) {
      var button = event.target.closest("[data-expand-button]");
      if (!button) {
        return;
      }

      var panel = getPanelFromButton(button);
      if (!panel) {
        return;
      }

      var shouldOpen = !panel.classList.contains("is-open");
      closeOtherPanels(panel);
      setOpen(button, panel, shouldOpen);
      updateExpandButtons();
    });

    window.addEventListener("resize", function () {
      all("[data-expand-panel].is-open").forEach(function (panel) {
        panel.style.maxHeight = panel.scrollHeight + "px";
      });
    });

    window.addEventListener("nana:news-rendered", refreshPanels);
    refreshPanels();
  }

  function refreshGalleryCaption() {
    var modal = one("[data-gallery-modal]");
    var caption = one("[data-gallery-caption]");
    if (!modal || !caption || !modal.classList.contains("is-open") || !galleryState.items.length) {
      return;
    }
    var item = galleryState.items[galleryState.index];
    caption.textContent = item.dataset[currentLang === "ar" ? "captionAr" : "captionEn"] || "";
  }

  function setupGallery() {
    var modal = one("[data-gallery-modal]");
    var modalImage = one("[data-gallery-image]");
    var caption = one("[data-gallery-caption]");
    var closeButtons = all("[data-gallery-close]");
    var prev = one("[data-gallery-prev]");
    var next = one("[data-gallery-next]");
    galleryState.items = all(".gallery-item");

    if (!modal || !modalImage || !caption || !galleryState.items.length) {
      return;
    }

    function renderImage() {
      var item = galleryState.items[galleryState.index];
      modalImage.src = item.dataset.src;
      modalImage.alt = item.querySelector("img").alt || "NANA SECRET gallery image";
      caption.textContent = item.dataset[currentLang === "ar" ? "captionAr" : "captionEn"] || "";
    }

    function openModal(index) {
      galleryState.index = index;
      galleryState.lastFocus = document.activeElement;
      renderImage();
      modal.classList.remove("is-closing");
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      body.classList.add("modal-open");
      var close = one(".modal-close", modal);
      if (close) {
        close.focus();
      }
    }

    function closeModal() {
      modal.classList.add("is-closing");
      window.setTimeout(function () {
        modal.classList.remove("is-open", "is-closing");
        modal.setAttribute("aria-hidden", "true");
        body.classList.remove("modal-open");
        if (galleryState.lastFocus) {
          galleryState.lastFocus.focus();
        }
      }, 210);
    }

    function move(step) {
      galleryState.index = (galleryState.index + step + galleryState.items.length) % galleryState.items.length;
      renderImage();
    }

    galleryState.items.forEach(function (item, index) {
      item.onclick = function () { openModal(index); };
    });

    closeButtons.forEach(function (button) {
      button.addEventListener("click", closeModal);
    });

    if (prev) {
      prev.addEventListener("click", function () {
        move(-1);
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        move(1);
      });
    }

    document.addEventListener("keydown", function (event) {
      if (!modal.classList.contains("is-open")) {
        return;
      }
      if (event.key === "Escape") {
        closeModal();
      }
      if (event.key === "ArrowRight") {
        move(root.dir === "rtl" ? -1 : 1);
      }
      if (event.key === "ArrowLeft") {
        move(root.dir === "rtl" ? 1 : -1);
      }
    });
  }

  function setupContactForm() {
    var form = one("[data-contact-form]");
    var message = one("[data-form-message]");
    if (!form || !message) {
      return;
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var fields = all("input, textarea", form);
      var valid = true;

      fields.forEach(function (field) {
        var fieldValid = true;
        if (field.required && !field.value.trim()) {
          fieldValid = false;
        }
        if (field.type === "email" && field.value.trim() && !field.validity.valid) {
          fieldValid = false;
        }

        field.classList.toggle("is-invalid", !fieldValid);
        if (!fieldValid) {
          valid = false;
        }
      });

      if (!valid) {
        message.textContent = currentLang === "ar"
          ? "من فضلك أكمل البيانات المطلوبة بشكل صحيح."
          : "Please complete the required fields correctly.";
        message.dataset.type = "error";
        return;
      }

      var button = one('button[type="submit"]', form);
      var originalText = button ? button.textContent : "";
      if (button) {
        button.disabled = true;
        button.textContent = currentLang === "ar" ? "جاري الإرسال..." : "Sending...";
      }
      message.textContent = currentLang === "ar" ? "جاري إرسال الرسالة..." : "Sending your message...";
      message.dataset.type = "info";

      try {
        var formData = new FormData(form);
        var payload = {
          name: String(formData.get("name") || "").trim(),
          phone: String(formData.get("phone") || "").trim(),
          email: String(formData.get("email") || "").trim(),
          message: String(formData.get("message") || "").trim()
        };
        var response = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        var result = await response.json().catch(function () { return {}; });
        if (!response.ok) {
          throw new Error(result.error || "Failed to send message");
        }
        message.textContent = currentLang === "ar"
          ? "تم إرسال رسالتك بنجاح. سنقوم بالتواصل معك قريبًا."
          : "Your message has been sent successfully. We will contact you soon.";
        message.dataset.type = "success";
        form.reset();
      } catch (error) {
        console.error(error);
        message.textContent = currentLang === "ar"
          ? "تعذر إرسال الرسالة الآن. من فضلك حاول لاحقًا أو تواصل عبر واتساب."
          : "Could not send the message now. Please try again later or contact us via WhatsApp.";
        message.dataset.type = "error";
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    });
  }

  function setupScrollTop() {
    var button = one("[data-scroll-top]");
    if (!button) {
      return;
    }

    function toggleVisibility() {
      button.classList.toggle("is-visible", window.scrollY > 520);
    }

    button.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    toggleVisibility();
    window.addEventListener("scroll", toggleVisibility, { passive: true });
  }

  function setupYear() {
    all("[data-year]").forEach(function (element) {
      element.textContent = new Date().getFullYear();
    });
  }


  window.addEventListener("nana:gallery-rendered", function(){
    all(".gallery-grid .reveal").forEach(function(item){ item.classList.add("is-visible"); });
    setupGallery();
  });

  window.NanaMain = { initGallery: setupGallery, refreshGalleryCaption: refreshGalleryCaption };

  setupYear();
  setupHeader();
  setupLanguageToggle();
  setupSlider();
  setupReveal();
  setupCounters();
  setupExpandableNews();
  setupGallery();
  setupContactForm();
  setupScrollTop();
})();
