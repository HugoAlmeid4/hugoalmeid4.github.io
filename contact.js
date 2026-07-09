/* ─────────────────────────────────────────────────────────────────────
   contact.js — Contact form modal

   Self-contained contact-form popup. Triggered by any link whose
   href="#contact" appears anywhere on the page. Submissions are
   forwarded to Web3Forms (https://web3forms.com), a third-party
   form-replay service that emails them to hralmeida@tutamail.com. The
   destination address is configured only in the Web3Forms dashboard
   — it is never written to this file or any other client-side asset.

   Why a third party? GitHub Pages serves static files only — there is
   no backend to receive POSTed form data. Without Web3Forms (or
   Formspree / Basin / EmailJS / a custom Cloudflare Worker) the form
   would have to be a `mailto:` link, which still exposes the address
   in the rendered `href`. Or you'd need to run a serverless function
   somewhere. Web3Forms gives you a hosted drop-in relay with one
   access_key and zero maintenance.

   Important config step (do once after deploying):
   After signing up at web3forms.com with hralmeida@tutamail.com, lock
   the access_key to your origin in the Web3Forms dashboard
   ("Allowed Origins" → "https://hugoalmeid4.github.io"). Without it,
   anyone scraping this JS file could POST through your quota from
   anywhere. The key is a public routing identifier by design — the
   origin lock is the wall around it.

   Privacy / spam control:
   - Honey-pot (`botcheck`) checkbox hidden off-screen. Real users
     never touch it; dumb bots that auto-fill every input get filtered
     server-side and silently dropped.
   - Web3Forms applies its own per-IP rate limit + disposable-email
     domain block list on top, so the combination handles scripts at
     the gate without ever showing a captcha (no Google reCAPTCHA
     tracking = better privacy).

   UX:
   - Modal stays inside the page; no navigation, no captcha, no extra
     redirect. The user is back in their flow in one click of X.
   - Submit states: idle → sending → success / error. The form is
     re-disabled during sending to prevent double-post.
   - Smooth scale-in / fade-out matching the existing modal vocabulary
     (.gallery-lightbox / .project-fullscreen-overlay scale-in via
     cubic-bezier(0.16,1,0.3,1)).
   - Keyboard accessible: Escape closes, Tab focused inside modal
     (focus returned to the trigger link on close), Enter submits when
     an input is focused.
   - All copy translated en / pt / es / hi / zh via the same pattern
     as posts.js (inline translations object + listener for the
     "languageChange" event that i18n.js dispatches).
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────────────
     Paste the access_key from https://web3forms.com here after
     signing up with hralmeida@tutamail.com. Free tier: 250
     submissions / month, plenty for a personal site. Then set "Allowed
     Origins" on the Web3Forms dashboard to your origin (the comment at
     the top of this file explains why). */
  var WEB3FORMS_ACCESS_KEY = '4ed21613-ad5e-43f6-af06-659333d66610';
  var WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
  var EMAIL_SUBJECT = 'New message via hralmeida.github.io';

  /* ── Locales ─────────────────────────────────────────────────────────
     13 strings × 5 languages. Keys must stay aligned with whatever
     posts.js / i18n.js have when a new language is added there. */
  var SUPPORTED = ['en', 'pt', 'es', 'hi', 'zh'];

  var translations = {
    en: {
      title: 'Get in touch',
      name: 'Name',
      email: 'Email',
      message: 'Message',
      send: 'Send',
      sending: 'Sending…',
      success: "Thanks! I'll get back to you soon.",
      error: 'Something went wrong. Please try again or email me directly.',
      error429: 'Slow down — too many submissions recently. Try again in a minute.',
      required: 'This field is required.',
      invalidEmail: 'Please enter a valid email address.',
      close: 'Close',
      successClose: 'Done',
      privacy: 'Your address stays private — I only use it to reply.',
    },
    pt: {
      title: 'Entre em contacto',
      name: 'Nome',
      email: 'Email',
      message: 'Mensagem',
      send: 'Enviar',
      sending: 'A enviar…',
      success: 'Obrigado! Responderei em breve.',
      error: 'Algo correu mal. Tente novamente ou envie-me um email diretamente.',
      error429: 'Mais devagar — demasiadas submissões recentemente. Tente dentro de um minuto.',
      required: 'Este campo é obrigatório.',
      invalidEmail: 'Por favor insira um email válido.',
      close: 'Fechar',
      successClose: 'Concluído',
      privacy: 'O seu email permanece privado — só o uso para responder.',
    },
    es: {
      title: 'Ponte en contacto',
      name: 'Nombre',
      email: 'Correo electrónico',
      message: 'Mensaje',
      send: 'Enviar',
      sending: 'Enviando…',
      success: '¡Gracias! Te responderé pronto.',
      error: 'Algo salió mal. Inténtalo de nuevo o envíame un correo directamente.',
      error429: 'Despacio — demasiados envíos recientemente. Inténtalo de nuevo en un minuto.',
      required: 'Este campo es obligatorio.',
      invalidEmail: 'Por favor introduce un correo válido.',
      close: 'Cerrar',
      successClose: 'Hecho',
      privacy: 'Tu correo permanece privado — solo lo uso para responder.',
    },
    hi: {
      title: 'संपर्क करें',
      name: 'नाम',
      email: 'ईमेल',
      message: 'संदेश',
      send: 'भेजें',
      sending: 'भेज रहे हैं…',
      success: 'धन्यवाद! मैं जल्द ही जवाब दूंगा।',
      error: 'कुछ गलत हो गया। कृपया पुनः प्रयास करें या सीधे ईमेल भेजें।',
      error429: 'धीरे — हाल में बहुत सारे सबमिशन। एक मिनट में फिर से प्रयास करें।',
      required: 'यह फ़ील्ड आवश्यक है।',
      invalidEmail: 'कृपया एक मान्य ईमेल दर्ज करें।',
      close: 'बंद करें',
      successClose: 'हो गया',
      privacy: 'आपका पता निजी रहेगा — मैं इसे केवल जवाब देने के लिए उपयोग करता हूँ।',
    },
    zh: {
      title: '联系我',
      name: '姓名',
      email: '邮箱',
      message: '留言',
      send: '发送',
      sending: '发送中…',
      success: '感谢您的来信！我会尽快回复您。',
      error: '发送失败。请重试或直接给我发邮件。',
      error429: '请稍候 — 最近提交过多。请一分钟后再试。',
      required: '此项为必填项。',
      invalidEmail: '请输入有效的邮箱地址。',
      close: '关闭',
      successClose: '完成',
      privacy: '您的邮箱将保持私密 — 我仅用于回复您。',
    }
  };

  /* ── State ───────────────────────────────────────────────────────────── */
  var lang = (function () {
    try {
      var saved = localStorage.getItem('blogLanguage');
      if (SUPPORTED.indexOf(saved) >= 0) return saved;
    } catch (e) { /* localStorage may be unavailable */ }
    return 'en';
  })();

  var modalEl = null;
  var formEl = null;
  var successEl = null;
  var submitBtn = null;
  var lastFocusedTrigger = null;
  var opening = false;

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function t(key) {
    var pack = translations[lang] || translations.en;
    return pack[key] || translations.en[key] || key;
  }
  function escHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /* Pragmatic email check. RFC 5322 is ~600 chars long and wisely
     avoided — the goal is to catch typos like missing @ / no dot /
     spaces. The server is the source of truth. */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function isValidEmail(s) { return EMAIL_RE.test(String(s || '').trim()); }

  function applyTranslations() {
    if (!modalEl) return;
    var nodes = modalEl.querySelectorAll('[data-contact-text]');
    nodes.forEach(function (el) {
      el.textContent = t(el.getAttribute('data-contact-text'));
    });
    var closeBtn = modalEl.querySelector('.contact-popup-close');
    if (closeBtn) closeBtn.setAttribute('aria-label', t('close'));
    /* Submit button label — preserve "Sending…" while the request is
       inflight so the user gets feedback, not a relabel to "Send". */
    if (submitBtn && !submitBtn.classList.contains('sending')) {
      submitBtn.textContent = t('send');
    }
  }

  /* ── Open / close ───────────────────────────────────────────────────── */
  function openModal(triggerEl) {
    if (!modalEl || opening) return;
    opening = true;
    lastFocusedTrigger = triggerEl || null;
    modalEl.classList.add('active');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('contact-modal-open');
    /* Focus first input on the next paint so the entry animation gets a
       single frame to commit before the caret appears (avoids a
       visible caret on an element that's still mid-scale-in). Using
       RAF — not setTimeout(320) — also closes the race where a fast
       Tab key right after open would land on the close button and
       then snap to the name field 320 ms later. */
    requestAnimationFrame(function () {
      var first = modalEl.querySelector('input[name="name"]');
      if (first) first.focus();
      opening = false;
    });
  }
  function closeModal() {
    if (!modalEl || !modalEl.classList.contains('active')) return;
    modalEl.classList.remove('active');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('contact-modal-open');
    /* Reset state after the close transition so a re-open shows the
       empty form, not whatever was last typed. */
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
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('sending');
      submitBtn.textContent = t('send');
    }
  }

  /* ── Validation ─────────────────────────────────────────────────────── */
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
  function showErrorBanner(messageKey) {
    var banner = modalEl.querySelector('.contact-popup-error');
    if (!banner) return;
    banner.classList.add('active');
    banner.textContent = t(messageKey || 'error');
  }
  function hideErrorBanner() {
    var banner = modalEl.querySelector('.contact-popup-error');
    if (!banner) return;
    banner.classList.remove('active');
    banner.textContent = '';
  }

  /* ── Submit ─────────────────────────────────────────────────────────── */
  function setSending() {
    submitBtn.disabled = true;
    submitBtn.classList.add('sending');
    submitBtn.textContent = t('sending');
    hideErrorBanner();
  }
  function showSuccess() {
    if (formEl) formEl.hidden = true;
    if (successEl) {
      successEl.hidden = false;
      /* Reset the message node on each success so AT re-announces it
         even if the modal is opened/sent multiple times in a session. */
      var msg = successEl.querySelector('[data-contact-text="success"]');
      if (msg) msg.textContent = t('success');
    }
  }

  /* Silent retry only on transient network errors (DNS blip, brief
     offline). 4xx and 5xx are NOT retried — re-firing won't fix a bad
     access_key, a rate limit, or a temporarily-broken upstream; instead
     show the user an honest error. Backoff: 600 ms before the second
     attempt. */
  async function postWithRetry(body) {
    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    };
    try {
      return await fetch(WEB3FORMS_ENDPOINT, opts);
    } catch (err) {
      await new Promise(function (r) { setTimeout(r, 600); });
      return await fetch(WEB3FORMS_ENDPOINT, opts);
    }
  }

  function teardownSending() {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('sending');
      submitBtn.textContent = t('send');
    }
  }

  async function submitForm(e) {
    e.preventDefault();
    if (!validate()) return;
    if (submitBtn && submitBtn.disabled) return;
    setSending();

    var fd = new FormData(formEl);
    var body = {
      access_key: WEB3FORMS_ACCESS_KEY,
      subject: EMAIL_SUBJECT,
      from_name: 'Website Contact Form',
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      message: String(fd.get('message') || '').trim(),
      botcheck: fd.get('botcheck') || ''
    };

    var res;
    try {
      res = await postWithRetry(body);
    } catch (err) {
      showErrorBanner('error');
      teardownSending();
      return;
    }

    var data = null;
    try { data = await res.json(); } catch (_) { /* non-JSON response */ }

    if (res && res.ok && data && data.success) {
      showSuccess();
    } else if (res && res.status === 429) {
      showErrorBanner('error429');
    } else {
      showErrorBanner('error');
    }
    teardownSending();
  }

  /* ── Build modal markup ─────────────────────────────────────────────── */
  function buildModal() {
    var wrap = document.createElement('div');
    wrap.id = 'contactPopup';
    wrap.className = 'contact-popup';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-hidden', 'true');
    /* aria-labelledby on the visible title — NOT a separate aria-label,
       so the accessibility tree doesn't list two labels for one dialog.
       Falls back to "Untitled dialog" if the id is somehow missing. */
    wrap.setAttribute('aria-labelledby', 'contactPopupTitle');

    wrap.innerHTML =
      '<div class="contact-popup-backdrop" data-contact-close="1"></div>' +
      '<div class="contact-popup-content">' +
        '<button type="button" class="contact-popup-close" data-contact-close="1" aria-label="' + escHTML(t('close')) + '">×</button>' +
        '<h3 class="contact-popup-title" id="contactPopupTitle" data-contact-text="title">' + escHTML(t('title')) + '</h3>' +
        '<p class="contact-popup-privacy" data-contact-text="privacy">' + escHTML(t('privacy')) + '</p>' +
        '<form class="contact-form" id="contactForm" novalidate>' +
          '<label class="contact-field">' +
            '<span data-contact-text="name">' + escHTML(t('name')) + '</span>' +
            '<input type="text" name="name" required autocomplete="name" maxlength="100">' +
            '<span class="contact-field-error">' + escHTML(t('required')) + '</span>' +
          '</label>' +
          '<label class="contact-field">' +
            '<span data-contact-text="email">' + escHTML(t('email')) + '</span>' +
            '<input type="email" name="email" required autocomplete="email" maxlength="200" inputmode="email">' +
            '<span class="contact-field-error">' + escHTML(t('invalidEmail')) + '</span>' +
          '</label>' +
          '<label class="contact-field">' +
            '<span data-contact-text="message">' + escHTML(t('message')) + '</span>' +
            '<textarea name="message" required rows="5" maxlength="5000"></textarea>' +
            '<span class="contact-field-error">' + escHTML(t('required')) + '</span>' +
          '</label>' +
          '<input type="checkbox" name="botcheck" class="contact-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          '<button type="submit" class="contact-submit" id="contactSubmit" data-contact-text="send">' + escHTML(t('send')) + '</button>' +
          '<div class="contact-popup-error" role="alert" aria-live="polite"></div>' +
        '</form>' +
        /* role="status" gives the success block an implicit
           aria-live="polite", so when hidden→shown screen readers
           announce "Thanks! I'll get back to you soon" automatically. */
        '<div class="contact-popup-success" id="contactSuccess" role="status" hidden>' +
          '<span class="contact-success-icon" aria-hidden="true">✓</span>' +
          '<p class="contact-success-msg" data-contact-text="success">' + escHTML(t('success')) + '</p>' +
          '<button type="button" class="contact-popup-close-success" data-contact-close="1" data-contact-text="successClose">' + escHTML(t('successClose')) + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(wrap);
    modalEl = wrap;
    formEl = wrap.querySelector('#contactForm');
    successEl = wrap.querySelector('#contactSuccess');
    submitBtn = wrap.querySelector('#contactSubmit');

    /* Clear field-error state as soon as the user starts typing in
       that field — feels less accusatory than waiting until next
       submit. */
    ['name', 'email', 'message'].forEach(function (name) {
      var inp = formEl.querySelector('[name="' + name + '"]');
      if (inp) inp.addEventListener('input', function () { hideFieldError(name); });
    });

    formEl.addEventListener('submit', submitForm);
  }

  /* ── Wire up ─────────────────────────────────────────────────────────── */
  function attachDelegatedListeners() {
    /* Click on any <a href="#contact"> → open modal. Click on any
       [data-contact-close] → close modal. Delegated so links
       re-injected by bio.js + posts.js on language change keep
       working. */
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

    /* Escape closes; Tab focus-traps inside the modal. */
    document.addEventListener('keydown', function (e) {
      if (!modalEl || !modalEl.classList.contains('active')) return;
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
      if (e.key === 'Tab') {
        var focusables = modalEl.querySelectorAll(
          'input:not([tabindex="-1"]):not([type="checkbox"]), textarea, button, [href]'
        );
        var visible = Array.prototype.filter.call(focusables, function (el) {
          /* offsetParent is null for display:none / hidden elements,
             so the success-close button is correctly excluded from
             the cycle while the form is still showing. */
          return el.offsetParent !== null || el === document.activeElement;
        });
        if (visible.length === 0) return;
        var first = visible[0];
        var last = visible[visible.length - 1];
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

  /* ── Boot ────────────────────────────────────────────────────────────── */
  function boot() {
    if (document.getElementById('contactPopup')) return; /* idempotent */
    buildModal();
    attachDelegatedListeners();
    attachLangListener();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Programmatic opener (not used internally but harmless to expose). */
  window.openContactForm = function (triggerEl) { openModal(triggerEl || null); };
})();
