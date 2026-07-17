(function () {
  'use strict';

  var ACCESS_KEY = '04d76c82-63c8-4a5d-93d0-51577a104203';
  var ENDPOINT = 'https://api.web3forms.com/submit';
  var CONTACT_EMAIL = 'hralmeid4@gmail.com';
  var EMAIL_SUBJECT = 'New message via hralmeida.github.io';

  var SUPPORTED = ['en', 'pt', 'es', 'hi', 'zh'];

  var translations = {
    en: {
      title: 'Get in touch',
      name: 'Name',
      email: 'Email',
      message: 'Message',
      send: 'Send',
      sending: 'Sending\u2026',
      success: "Thanks! I'll get back to you soon.",
      mailtoFallback: "Couldn't reach the server \u2014 opened your email client instead. Hit Send there to deliver.",
      error: 'Something went wrong. Please try again or email me directly.',
      error429: 'Slow down \u2014 too many submissions recently. Try again in a minute.',
      required: 'This field is required.',
      invalidEmail: 'Please enter a valid email address.',
      close: 'Close',
      successClose: 'Done',
      privacy: 'Your address stays private \u2014 I only use it to reply.',
    },
    pt: {
      title: 'Entre em contacto',
      name: 'Nome',
      email: 'Email',
      message: 'Mensagem',
      send: 'Enviar',
      sending: 'A enviar\u2026',
      success: 'Obrigado! Responderei em breve.',
      mailtoFallback: 'N\u00e3o foi poss\u00edvel contactar o servidor \u2014 abri o seu cliente de email. Carregue em Enviar para entregar.',
      error: 'Algo correu mal. Tente novamente ou envie-me um email diretamente.',
      error429: 'Mais devagar \u2014 demasiadas submiss\u00f5es recentemente. Tente dentro de um minuto.',
      required: 'Este campo \u00e9 obrigat\u00f3rio.',
      invalidEmail: 'Por favor insira um email v\u00e1lido.',
      close: 'Fechar',
      successClose: 'Conclu\u00eddo',
      privacy: 'O seu email permanece privado \u2014 s\u00f3 o uso para responder.',
    },
    es: {
      title: 'Ponte en contacto',
      name: 'Nombre',
      email: 'Correo electr\u00f3nico',
      message: 'Mensaje',
      send: 'Enviar',
      sending: 'Enviando\u2026',
      success: '\u00a1Gracias! Te responder\u00e9 pronto.',
      mailtoFallback: 'No se pudo contactar el servidor \u2014 abr\u00ed tu cliente de correo. Pulsa Enviar para entregar.',
      error: 'Algo sali\u00f3 mal. Int\u00e9ntalo de nuevo o env\u00edame un correo directamente.',
      error429: 'Despacio \u2014 demasiados env\u00edos recientemente. Int\u00e9ntalo de nuevo en un minuto.',
      required: 'Este campo es obligatorio.',
      invalidEmail: 'Por favor introduce un correo v\u00e1lido.',
      close: 'Cerrar',
      successClose: 'Hecho',
      privacy: 'Tu correo permanece privado \u2014 solo lo uso para responder.',
    },
    hi: {
      title: '\u0938\u0902\u092a\u0930\u094d\u0915 \u0915\u0930\u0947\u0902',
      name: '\u0928\u093e\u092e',
      email: '\u0908\u092e\u0947\u0932',
      message: '\u0938\u0902\u0926\u0947\u0936',
      send: '\u092d\u0947\u091c\u0947\u0902',
      sending: '\u092d\u0947\u091c \u0930\u0939\u0947 \u0939\u0948\u0902\u2026',
      success: '\u0927\u0928\u094d\u092f\u0935\u093e\u0926! \u092e\u0948\u0902 \u091c\u0932\u094d\u0926 \u0939\u0940 \u091c\u0935\u093e\u092c \u0926\u0942\u0902\u0917\u093e\u0964',
      mailtoFallback: '\u0938\u0930\u094d\u0935\u0930 \u0924\u0915 \u0928\u0939\u0940\u0902 \u092a\u0939\u0941\u0901\u091a\u093e \u2014 \u0906\u092a\u0915\u093e \u0908\u092e\u0947\u0932 \u0915\u094d\u0932\u093e\u0907\u0902\u091f \u0916\u094b\u0932 \u0926\u093f\u092f\u093e \u0917\u092f\u093e \u0939\u0948\u0964 \u0935\u093f\u0924\u0930\u093f\u0924 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u0935\u0939\u093e\u0901 \u092d\u0947\u091c\u0947\u0902 \u0926\u092c\u093e\u090f\u0902\u0964',
      error: '\u0915\u0941\u091b \u0917\u0932\u0924 \u0939\u094b \u0917\u092f\u093e\u0964 \u0915\u0943\u092a\u092f\u093e \u092a\u0941\u0928\u0903 \u092a\u094d\u0930\u092f\u093e\u0938 \u0915\u0930\u0947\u0902 \u092f\u093e \u0938\u0940\u0927\u0947 \u0908\u092e\u0947\u0932 \u092d\u0947\u091c\u0947\u0902\u0964',
      error429: '\u0927\u0940\u0930\u0947 \u2014 \u0939\u093e\u0932 \u092e\u0947\u0902 \u092c\u0939\u0941\u0924 \u0938\u093e\u0930\u0947 \u0938\u092c\u092e\u093f\u0936\u0928\u0964 \u090f\u0915 \u092e\u093f\u0928\u091f \u092e\u0947\u0902 \u092b\u093f\u0930 \u0938\u0947 \u092a\u094d\u0930\u092f\u093e\u0938 \u0915\u0930\u0947\u0902\u0964',
      required: '\u092f\u0939 \u092b\u093c\u0940\u0932\u094d\u0921 \u0906\u0935\u0936\u094d\u092f\u0915 \u0939\u0948\u0964',
      invalidEmail: '\u0915\u0943\u092a\u092f\u093e \u090f\u0915 \u092e\u093e\u0928\u094d\u092f \u0908\u092e\u0947\u0932 \u0926\u0930\u094d\u091c \u0915\u0930\u0947\u0902\u0964',
      close: '\u092c\u0902\u0926 \u0915\u0930\u0947\u0902',
      successClose: '\u0939\u094b \u0917\u092f\u093e',
      privacy: '\u0906\u092a\u0915\u093e \u092a\u0924\u093e \u0928\u093f\u091c\u0940 \u0930\u0939\u0947\u0917\u093e \u2014 \u092e\u0948\u0902 \u0907\u0938\u0947 \u0915\u0947\u0935\u0932 \u091c\u0935\u093e\u092c \u0926\u0947\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u0909\u092a\u092f\u094b\u0917 \u0915\u0930\u0924\u093e \u0939\u0942\u0901\u0964',
    },
    zh: {
      title: '\u8054\u7cfb\u6211',
      name: '\u59d3\u540d',
      email: '\u90ae\u7bb1',
      message: '\u7559\u8a00',
      send: '\u53d1\u9001',
      sending: '\u53d1\u9001\u4e2d\u2026',
      success: '\u611f\u8c22\u60a8\u7684\u6765\u4fe1\uff01\u6211\u4f1a\u5c3d\u5feb\u56de\u590d\u60a8\u3002',
      mailtoFallback: '\u65e0\u6cd5\u8fde\u63a5\u670d\u52a1\u5668 \u2014 \u5df2\u6253\u5f00\u60a8\u7684\u90ae\u4ef6\u5ba2\u6237\u7aef\u3002\u5728\u90a3\u91cc\u70b9\u51fb\u201c\u53d1\u9001\u201d\u5373\u53ef\u6295\u9012\u3002',
      error: '\u53d1\u9001\u5931\u8d25\u3002\u8bf7\u91cd\u8bd5\u6216\u76f4\u63a5\u7ed9\u6211\u53d1\u90ae\u4ef6\u3002',
      error429: '\u8bf7\u7a0d\u5019 \u2014 \u6700\u8fd1\u63d0\u4ea4\u8fc7\u591a\u3002\u8bf7\u4e00\u5206\u949f\u540e\u518d\u8bd5\u3002',
      required: '\u6b64\u9879\u4e3a\u5fc5\u586b\u9879\u3002',
      invalidEmail: '\u8bf7\u8f93\u5165\u6709\u6548\u7684\u90ae\u7bb1\u5730\u5740\u3002',
      close: '\u5173\u95ed',
      successClose: '\u5b8c\u6210',
      privacy: '\u60a8\u7684\u90ae\u7bb1\u5c06\u4fdd\u6301\u79c1\u5bc6 \u2014 \u6211\u4ec5\u7528\u4e8e\u56de\u590d\u60a8\u3002',
    }
  };

  var lang = (function () {
    try {
      var saved = localStorage.getItem('blogLanguage');
      if (SUPPORTED.indexOf(saved) >= 0) return saved;
    } catch (e) { /* */ }
    return 'en';
  })();

  var modalEl, formEl, successEl, submitBtn, lastFocusedTrigger;

  function t(key) {
    var pack = translations[lang] || translations.en;
    return pack[key] || translations.en[key] || key;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function isValidEmail(s) { return EMAIL_RE.test(String(s || '').trim()); }

  function applyTranslations() {
    if (!modalEl) return;
    var isFallback = successEl && successEl.dataset && successEl.dataset.fallback === '1';
    var nodes = modalEl.querySelectorAll('[data-contact-text]');
    nodes.forEach(function (el) {
      var key = el.getAttribute('data-contact-text');
      if (key === 'success' && isFallback) {
        el.textContent = t('mailtoFallback');
      } else {
        el.textContent = t(key);
      }
    });
    var closeBtn = modalEl.querySelector('.contact-popup-close');
    if (closeBtn) closeBtn.setAttribute('aria-label', t('close'));
    if (submitBtn && !submitBtn.classList.contains('sending')) {
      submitBtn.textContent = t('send');
    }
  }

  function openModal(triggerEl) {
    if (!modalEl) return;
    lastFocusedTrigger = triggerEl || null;
    modalEl.classList.add('active');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('contact-modal-open');
    requestAnimationFrame(function () {
      var first = modalEl.querySelector('input[name="name"]');
      if (first) first.focus();
    });
  }

  function closeModal() {
    if (!modalEl || !modalEl.classList.contains('active')) return;
    modalEl.classList.remove('active');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('contact-modal-open');
    setTimeout(function () {
      resetForm();
      if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === 'function') {
        lastFocusedTrigger.focus();
      }
    }, 260);
  }

  function resetForm() {
    if (!formEl) return;
    formEl.reset();
    hideFieldError('name');
    hideFieldError('email');
    hideFieldError('message');
    hideErrorBanner();
    if (successEl) successEl.hidden = true;
    if (formEl) formEl.hidden = false;
    if (successEl && successEl.dataset) delete successEl.dataset.fallback;
    teardownSending();
  }

  function showFieldError(name) {
    var input = formEl.querySelector('[name="' + name + '"]');
    if (input && input.parentElement) input.parentElement.classList.add('has-error');
  }
  function hideFieldError(name) {
    var input = formEl.querySelector('[name="' + name + '"]');
    if (input && input.parentElement) input.parentElement.classList.remove('has-error');
  }

  function validate() {
    var ok = true;
    var name = formEl.querySelector('[name="name"]').value.trim();
    var email = formEl.querySelector('[name="email"]').value.trim();
    var message = formEl.querySelector('[name="message"]').value.trim();
    if (!name) { showFieldError('name'); ok = false; } else { hideFieldError('name'); }
    if (!email || !isValidEmail(email)) { showFieldError('email'); ok = false; } else { hideFieldError('email'); }
    if (!message) { showFieldError('message'); ok = false; } else { hideFieldError('message'); }
    return ok;
  }

  function showErrorBanner(msg) {
    var banner = modalEl.querySelector('.contact-popup-error');
    if (!banner) return;
    banner.classList.add('active');
    banner.textContent = msg || '';
  }
  function hideErrorBanner() {
    var banner = modalEl.querySelector('.contact-popup-error');
    if (!banner) return;
    banner.classList.remove('active');
    banner.textContent = '';
  }

  function setSending() {
    submitBtn.disabled = true;
    submitBtn.classList.add('sending');
    submitBtn.textContent = t('sending');
    hideErrorBanner();
  }
  function teardownSending() {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('sending');
      submitBtn.textContent = t('send');
    }
  }

  function showSuccess() {
    if (formEl) formEl.hidden = true;
    if (successEl) {
      successEl.hidden = false;
      var msg = successEl.querySelector('[data-contact-text="success"]');
      if (msg) msg.textContent = t('success');
    }
  }

  function toFormData(body) {
    var fd = new FormData();
    Object.keys(body).forEach(function (k) {
      var v = body[k];
      if (v != null) fd.append(k, String(v));
    });
    return fd;
  }

  function mailtoUrl(name, email, message) {
    var body = 'From: ' + name + ' <' + email + '>\n\n' + message;
    return 'mailto:' + CONTACT_EMAIL +
      '?subject=' + encodeURIComponent(EMAIL_SUBJECT) +
      '&body=' + encodeURIComponent(body);
  }

  function handOffToMailto(name, email, message) {
    window.location.href = mailtoUrl(name, email, message);
    showSuccess();
    if (successEl && successEl.dataset) successEl.dataset.fallback = '1';
    var msg = successEl && successEl.querySelector('[data-contact-text="success"]');
    if (msg) msg.textContent = t('mailtoFallback');
  }

  async function submitForm(e) {
    e.preventDefault();
    if (!validate()) return;
    if (submitBtn && submitBtn.disabled) return;

    var name = formEl.querySelector('[name="name"]').value.trim();
    var email = formEl.querySelector('[name="email"]').value.trim();
    var message = formEl.querySelector('[name="message"]').value.trim();
    var botcheck = '';

    var payload = {
      access_key: ACCESS_KEY,
      subject: EMAIL_SUBJECT,
      from_name: 'Website Contact Form',
      name: name,
      email: email,
      message: message,
      botcheck: botcheck
    };

    setSending();

    var res, data;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: toFormData(payload)
      });
    } catch (err) {
      console.warn('[contact] Network error:', err);
      handOffToMailto(name, email, message);
      return;
    }

    try {
      data = await res.json();
    } catch (parseErr) {
      console.warn('[contact] Non-JSON response (status ' + res.status + '):', parseErr);
      handOffToMailto(name, email, message);
      return;
    }

    if (res.ok && data && data.success) {
      showSuccess();
      return;
    }

    if (res.status === 429) {
      showErrorBanner(t('error429'));
      teardownSending();
      return;
    }

    if (data && data.message) {
      showErrorBanner(String(data.message).slice(0, 240));
      teardownSending();
      return;
    }

    showErrorBanner(t('error'));
    teardownSending();
  }

  function buildModal() {
    var wrap = document.createElement('div');
    wrap.id = 'contactPopup';
    wrap.className = 'contact-popup';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.setAttribute('aria-labelledby', 'contactPopupTitle');

    wrap.innerHTML =
      '<div class="contact-popup-backdrop" data-contact-close="1"></div>' +
      '<div class="contact-popup-content">' +
        '<button type="button" class="contact-popup-close" data-contact-close="1" aria-label="' + esc(t('close')) + '">\u00d7</button>' +
        '<h3 class="contact-popup-title" id="contactPopupTitle" data-contact-text="title">' + esc(t('title')) + '</h3>' +
        '<p class="contact-popup-privacy" data-contact-text="privacy">' + esc(t('privacy')) + '</p>' +
        '<form class="contact-form" id="contactForm" novalidate>' +
          '<label class="contact-field">' +
            '<span data-contact-text="name">' + esc(t('name')) + '</span>' +
            '<input type="text" name="name" required autocomplete="name" maxlength="100">' +
            '<span class="contact-field-error">' + esc(t('required')) + '</span>' +
          '</label>' +
          '<label class="contact-field">' +
            '<span data-contact-text="email">' + esc(t('email')) + '</span>' +
            '<input type="email" name="email" required autocomplete="email" maxlength="200" inputmode="email">' +
            '<span class="contact-field-error">' + esc(t('invalidEmail')) + '</span>' +
          '</label>' +
          '<label class="contact-field">' +
            '<span data-contact-text="message">' + esc(t('message')) + '</span>' +
            '<textarea name="message" required rows="5" maxlength="5000"></textarea>' +
            '<span class="contact-field-error">' + esc(t('required')) + '</span>' +
          '</label>' +
          '<input type="text" name="botcheck" class="contact-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          '<button type="submit" class="contact-submit" id="contactSubmit" data-contact-text="send">' + esc(t('send')) + '</button>' +
          '<div class="contact-popup-error" role="alert" aria-live="polite"></div>' +
        '</form>' +
        '<div class="contact-popup-success" id="contactSuccess" role="status" hidden>' +
          '<span class="contact-success-icon" aria-hidden="true">\u2713</span>' +
          '<p class="contact-success-msg" data-contact-text="success">' + esc(t('success')) + '</p>' +
          '<button type="button" class="contact-popup-close-success" data-contact-close="1" data-contact-text="successClose">' + esc(t('successClose')) + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(wrap);
    modalEl = wrap;
    formEl = wrap.querySelector('#contactForm');
    successEl = wrap.querySelector('#contactSuccess');
    submitBtn = wrap.querySelector('#contactSubmit');

    ['name', 'email', 'message'].forEach(function (name) {
      var inp = formEl.querySelector('[name="' + name + '"]');
      if (inp) inp.addEventListener('input', function () { hideFieldError(name); });
    });

    formEl.addEventListener('submit', function (e) {
      var bot = formEl.querySelector('[name="botcheck"]');
      if (bot && bot.value.trim() !== '') { e.preventDefault(); return; }
      submitForm(e);
    });
  }

  function attachDelegatedListeners() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('a[href="#contact"]');
      if (link) {
        e.preventDefault();
        openModal(link);
        return;
      }
      var closeBtn = e.target.closest && e.target.closest('[data-contact-close]');
      if (closeBtn) { closeModal(); return; }
    });

    document.addEventListener('keydown', function (e) {
      if (!modalEl || !modalEl.classList.contains('active')) return;
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
      if (e.key === 'Tab') {
        var focusables = modalEl.querySelectorAll(
          'input:not([tabindex="-1"]):not([type="checkbox"]), textarea, button, [href], iframe'
        );
        var visible = Array.prototype.filter.call(focusables, function (el) {
          return el.offsetParent !== null || el === document.activeElement;
        });
        if (visible.length === 0) return;
        var first = visible[0], last = visible[visible.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    });
  }

  function attachLangListener() {
    window.addEventListener('languageChange', function (e) {
      var l = e && e.detail && e.detail.lang;
      if (SUPPORTED.indexOf(l) >= 0) lang = l;
      applyTranslations();
    });
  }

  function boot() {
    if (document.getElementById('contactPopup')) return;
    buildModal();
    attachDelegatedListeners();
    attachLangListener();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.openContactForm = function (triggerEl) { openModal(triggerEl || null); };
})();
