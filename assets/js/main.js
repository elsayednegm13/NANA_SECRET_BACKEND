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
    var buttons = all("[data-expand-button]");
    if (!buttons.length) {
      return;
    }

    function setOpen(button, panel, isOpen) {
      panel.classList.toggle("is-open", isOpen);
      panel.style.maxHeight = isOpen ? panel.scrollHeight + "px" : "0px";
      updateExpandButtons();
    }

    buttons.forEach(function (button) {
      var article = button.closest(".article-card");
      var panel = article ? one("[data-expand-panel]", article) : null;
      if (!panel) {
        return;
      }

      button.addEventListener("click", function () {
        setOpen(button, panel, !panel.classList.contains("is-open"));
      });

      setOpen(button, panel, panel.classList.contains("is-open"));
    });

    window.addEventListener("resize", function () {
      all("[data-expand-panel].is-open").forEach(function (panel) {
        panel.style.maxHeight = panel.scrollHeight + "px";
      });
    });
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
      item.addEventListener("click", function () {
        openModal(index);
      });
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

    form.addEventListener("submit", function (event) {
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
        return;
      }

      message.textContent = currentLang === "ar"
        ? "تم تجهيز رسالتك بنجاح. يمكنك أيضًا التواصل مباشرة عبر الهاتف أو واتساب."
        : "Your message is ready. You can also contact us directly by phone or WhatsApp.";
      form.reset();
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
