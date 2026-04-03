/**
 * yarmi-cookie-banner-rebuild.js
 * JS-only rebuild cookies bannera pre yarmi.sk / Shoptet.
 *
 * Použitie v Shoptet HEAD template:
 * <script src="https://cdn.jsdelivr.net/gh/decado87/yarmi-styles@main/yarmi-cookie-banner-rebuild.js?v=20260403b" defer></script>
 *
 * Vlastnosti:
 * - beží samostatne, bez potreby HTML/CSS zásahu do šablóny
 * - schová pôvodný cookie banner, ak je na stránke stále aktívny
 * - ukladá consent do localStorage pod rovnakým kľúčom ako doterajší banner
 * - podporuje Google Consent Mode v2 + dataLayer event
 * - sprístupní window.yarmiOpenCookieSettings() pre neskoršie otvorenie nastavení
 */
(function () {
  'use strict';

  if (window.__yarmiCookieBannerRebuildLoaded) return;
  window.__yarmiCookieBannerRebuildLoaded = true;

  var CONFIG = {
    storageKey: 'yarmi_cookie_consent',
    version: '2',
    privacyUrl: '/podmienky-ochrany-osobnych-udajov/',
    cookiesUrl: '/podmienky-ochrany-osobnych-udajov/',
    defaultChecked: false,
    overlayId: 'yarmi-cookie-rebuild-overlay',
    styleId: 'yarmi-cookie-rebuild-style',
    hiddenAttr: 'data-yarmi-cookie-hidden',
    shoptetSyncDelay: 80,
    shoptetSyncRetryDelay: 220,
    shoptetSyncRetries: 12,
    debugStorageKey: 'yarmi_cookie_debug',
    trackerReadyRetryDelay: 250,
    trackerReadyRetries: 24
  };

  var KNOWN_BANNER_SELECTORS = [
    '#yarmi-cookie-overlay',
    '#yarmi-cookie-css',
    '.js-siteCookies',
    '.site-cookies',
    '.siteCookies',
    '.cc-window',
    '.cc-banner',
    '.cookie-consent-container',
    '.cookie-consent',
    '.cookie-bar',
    '.cookie-notice',
    '.cookies-window',
    '.js-cookies-window',
    '.cky-consent-container',
    '[data-cky-tag="notice"]',
    '#cookiebanner',
    '#cookie-banner',
    '#cookie-law-info-bar',
    '#cookiescript_injected',
    '[id*="cookie-consent"]',
    '[class*="cookie-consent"]'
  ];
  var PREHIDE_SELECTOR = KNOWN_BANNER_SELECTORS
    .filter(function (selector) { return selector !== '#yarmi-cookie-css'; })
    .concat('[' + CONFIG.hiddenAttr + '="1"]')
    .join(',');

  var bannerObserver = null;
  var scrollLock = null;
  var storedConsent = getConsent();
  var sentGaPageView = false;

  // Capture the original landing URL (with UTMs, fbclid, gclid) at script load time.
  // Prefer window.__yarmiPreCaptureUrl — set by a tiny inline script in Shoptet HEAD that
  // runs synchronously BEFORE any defer/async scripts (including ours) can execute. This
  // ensures we get the real URL even if Shoptet's inline scripts call history.replaceState
  // to strip fbclid/UTMs before our deferred script starts.
  // If the inline snippet is not installed, fall back to window.location.href as before.
  var capturedLandingUrl = window.__yarmiPreCaptureUrl || window.location.href;

  // Pre-capture Meta fbclid from the URL immediately — before Shoptet or any other script
  // might strip it via history.replaceState. Sets _fbc cookie so fbevents.js (which only
  // loads AFTER the user accepts cookies) can still attribute the visit to the correct Meta
  // ad even if fbclid is no longer in the URL at the time the pixel fires.
  //
  // We read from capturedLandingUrl (which prefers window.__yarmiPreCaptureUrl — set by a
  // tiny inline snippet in Shoptet HEAD that runs synchronously before any defer/async script).
  (function preCaptureMetaClickId() {
    try {
      var searchStr = capturedLandingUrl.indexOf('?') !== -1
        ? capturedLandingUrl.split('?')[1] : '';
      var fbclid = searchStr ? new URLSearchParams(searchStr).get('fbclid') : null;
      if (!fbclid) return;

      // Check existing _fbc cookie
      var existing = document.cookie.split(';').map(function(c){ return c.trim(); })
        .find(function(c){ return c.startsWith('_fbc='); });
      if (existing) {
        // Per Meta docs: update _fbc if the fbclid in the URL is different from the one
        // currently stored. Handles the case where the user clicks a new Meta ad (new fbclid)
        // while an older _fbc from a previous session is still present in the cookie.
        var existingVal = existing.split('=').slice(1).join('='); // full fb.1.TIMESTAMP.FBCLID
        var existingFbclid = existingVal.split('.').slice(3).join('.'); // strip "fb.1.TIMESTAMP."
        if (existingFbclid === fbclid) return; // same fbclid already stored — nothing to do
        // Different fbclid in URL — fall through and overwrite
      }

      var fbc = 'fb.1.' + Date.now() + '.' + fbclid;
      var exp = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString(); // 90 days
      var domain = location.hostname.replace(/^www\./, '');
      document.cookie = '_fbc=' + fbc + '; expires=' + exp + '; path=/; domain=.' + domain + '; SameSite=Lax';
    } catch (e) {}
  })();

  // Pre-generate _fbp (Meta Browser ID) if not already set.
  // fbevents.js normally creates _fbp, but it only loads AFTER cookie consent is given.
  // By pre-creating it at script init we ensure:
  //  1. Shoptet's server-side Conversions API can read _fbp from request cookies on this visit.
  //  2. fbevents.js will reuse the existing value rather than generating a new one.
  // Format per Meta spec: fb.{subdomain_index}.{creation_time_ms}.{random_number}
  // "Do not hash" — Meta docs, Customer Information Parameters.
  (function preCaptureMetaBrowserId() {
    try {
      var existing = document.cookie.split(';').map(function(c){ return c.trim(); })
        .find(function(c){ return c.startsWith('_fbp='); });
      if (existing) return; // already set — leave it untouched
      var random = String(Math.floor(Math.random() * 10000000000));
      var fbp = 'fb.1.' + Date.now() + '.' + random;
      var exp = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString(); // 90 days
      var domain = location.hostname.replace(/^www\./, '');
      document.cookie = '_fbp=' + fbp + '; expires=' + exp + '; path=/; domain=.' + domain + '; SameSite=Lax';
    } catch (e) {}
  })();

  // Inject Meta advanced matching (external_id) into the fbq queue at script init.
  // This MUST run before fbevents.js processes the queue so external_id is included
  // in PageView, ViewContent, ViewCategory — not just in later events.
  //
  // Shoptet queues fbq('init', pixelId) as a stub before fbevents.js loads.
  // We read the pixelId from that stub queue and queue another fbq('init') with
  // external_id immediately after. fbevents.js then processes both together.
  //
  // external_id: Shoptet's CookiesConsent cookieId (stable per user, no hashing needed
  // per Meta docs). Falls back to the pre-generated _fbp value.
  (function injectMetaExternalId() {
    try {
      if (typeof window.fbq !== 'function') return;
      // Read pixel ID from Shoptet's fbq stub queue
      var pixelId = null;
      // Method 1: read from Shoptet's fbq stub queue (works before fbevents.js loads)
      var queue = window.fbq.queue || [];
      for (var qi = 0; qi < queue.length; qi++) {
        if (queue[qi] && queue[qi][0] === 'init' && /^\d{10,16}$/.test(queue[qi][1])) {
          pixelId = String(queue[qi][1]);
          break;
        }
      }
      // Method 2: pixelsByID (populated once fbevents.js has already loaded + initialized)
      if (!pixelId && window._fbq && window._fbq.instance && window._fbq.instance.pixelsByID) {
        var pids = Object.keys(window._fbq.instance.pixelsByID);
        var numPid = pids.find(function(k){ return /^\d{10,16}$/.test(k); });
        if (numPid) pixelId = numPid;
      }
      if (!pixelId) return;
      // external_id source (no hashing required per Meta docs)
      var extId = null;
      var ccRaw = document.cookie.split(';').map(function(c){ return c.trim(); })
        .find(function(c){ return c.startsWith('CookiesConsent='); });
      if (ccRaw) {
        try {
          var ccObj = JSON.parse(decodeURIComponent(ccRaw.split('=').slice(1).join('=')));
          if (ccObj && ccObj.cookieId) extId = String(ccObj.cookieId);
        } catch(e2) {}
      }
      // Fallback: _fbp (just pre-generated above, stable per browser)
      if (!extId) {
        var fbpCk = document.cookie.split(';').map(function(c){ return c.trim(); })
          .find(function(c){ return c.startsWith('_fbp='); });
        if (fbpCk) extId = fbpCk.split('=').slice(1).join('=');
      }
      if (extId) {
        window.fbq('init', pixelId, { external_id: extId });
      }
    } catch(e) {}
  })();

  syncConsentMode(storedConsent || { analytics: false, marketing: false }, storedConsent ? 'update' : 'default');

  // Inject styles and suppress old banners as soon as possible
  injectStyles();
  suppressExistingBanners(document);
  
  // Aggressively hide old banners immediately in head/body
  if (document.body) {
    suppressExistingBanners(document.body);
  }
  if (document.head) {
    suppressExistingBanners(document.head);
  }
  
  // Add early suppression CSS to prevent FOUC (flash of unstyled content)
  var earlyStyle = document.createElement('style');
  earlyStyle.id = 'yarmi-cookie-early-hide';
  earlyStyle.textContent = '.js-siteCookies, .js-cookies-window, #yarmi-cookie-overlay, .cc-window {display:none!important;opacity:0!important;visibility:hidden!important;}';
  document.head.insertBefore(earlyStyle, document.head.firstChild);
  
  startBannerSuppressionObserver();
  installPublicApi();

  onReady(function () {
    if (storedConsent) {
      applyShoptetConsent(storedConsent);
      // Also sync Meta pixel advanced matching for returning users.
      // syncPixelConsent is normally called only from saveConsent (on button click).
      // For returning users consent is already stored — we must call it here explicitly
      // so external_id / advanced matching is injected on every page load, not just
      // the first time the user accepts.
      syncPixelConsent(storedConsent);
    }
    if (!storedConsent) {
      openBanner(getInitialPrefs(), false);
    }
  });

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  }

  function getConsent() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) {
        // Fallback: localStorage prázdny, ale CookiesConsent cookie môže existovať
        // (napr. Shoptetov natívny banner bol akceptovaný, alebo iný page load nastavil cookie).
        // Prečítame cookie a ak má consent, vrátime ho — tým zabránime tomu,
        // aby banner pushol DENIED do GTM pre používateľov ktorí už súhlasili.
        var fromCookie = getConsentFromShoptetCookie();
        if (fromCookie) {
          // Uložíme do localStorage aby sme to pri ďalšom loade nemuseli znova riešiť
          try {
            localStorage.setItem(CONFIG.storageKey, JSON.stringify({
              version: CONFIG.version,
              timestamp: new Date().toISOString(),
              necessary: true,
              analytics: fromCookie.analytics,
              marketing: fromCookie.marketing,
              source: 'shoptet-cookie-sync'
            }));
          } catch(e2) {}
        }
        return fromCookie;
      }

      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      return {
        version: String(parsed.version || '1'),
        timestamp: parsed.timestamp || null,
        necessary: true,
        analytics: !!parsed.analytics,
        marketing: !!parsed.marketing
      };
    } catch (error) {
      return null;
    }
  }

  // Prečíta consent zo Shoptetovho CookiesConsent cookie.
  // Formát: {"consent":"analytics,personalisation","cookieId":"..."}
  // "personalisation" = marketing consent.
  function getConsentFromShoptetCookie() {
    try {
      var ccCookie = document.cookie.split(';').map(function(c){ return c.trim(); })
        .find(function(c){ return c.startsWith('CookiesConsent='); });
      if (!ccCookie) return null;
      var ccObj = JSON.parse(decodeURIComponent(ccCookie.split('=').slice(1).join('=')));
      if (!ccObj || !ccObj.consent) return null;
      var parts = ccObj.consent.split(',').map(function(p){ return p.trim(); });
      return {
        version: CONFIG.version,
        timestamp: null,
        necessary: true,
        analytics: parts.indexOf('analytics') !== -1,
        marketing: parts.indexOf('personalisation') !== -1
      };
    } catch(e) {
      return null;
    }
  }

  function getInitialPrefs() {
    var consent = getConsent();
    if (consent) {
      return {
        analytics: !!consent.analytics,
        marketing: !!consent.marketing
      };
    }

    return {
      analytics: !!CONFIG.defaultChecked,
      marketing: !!CONFIG.defaultChecked
    };
  }

  function injectStyles() {
    if (document.getElementById(CONFIG.styleId)) return;

    var style = document.createElement('style');
    style.id = CONFIG.styleId;
    style.textContent = [
      PREHIDE_SELECTOR + '{display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important;}',
      '#' + CONFIG.overlayId + '{position:fixed;inset:0;z-index:2147483645;display:flex;align-items:flex-end;justify-content:center;padding:24px 18px;background:rgba(8,8,8,.52);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:yarmiCookieOverlayIn .28s ease forwards;}',
      '@keyframes yarmiCookieOverlayIn{from{opacity:0}to{opacity:1}}',
      '#' + CONFIG.overlayId + ' *{box-sizing:border-box;}',
      '.yrm-cookie{position:relative;width:min(100%,780px);padding:34px 36px 28px;border-radius:22px;background:linear-gradient(180deg,#151515 0%,#101010 100%);color:#fff;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.45),0 0 0 1px rgba(200,168,78,.14);font-family:Instrument Sans,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;animation:yarmiCookieCardUp .36s cubic-bezier(.22,1,.36,1) forwards;}',
      '@keyframes yarmiCookieCardUp{from{transform:translateY(42px);opacity:0}to{transform:translateY(0);opacity:1}}',
      '.yrm-cookie:before{content:"";position:absolute;inset:0 0 auto 0;height:3px;background:linear-gradient(90deg,transparent,rgba(200,168,78,.2) 10%,#c8a84e 35%,#f0d988 50%,#c8a84e 65%,rgba(200,168,78,.2) 90%,transparent);}',
      '.yrm-cookie:after{content:"";position:absolute;top:-110px;right:-90px;width:260px;height:260px;background:radial-gradient(circle,rgba(200,168,78,.12) 0%,rgba(200,168,78,.04) 38%,transparent 72%);pointer-events:none;}',
      '.yrm-cookie__eyebrow{margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.68);}',
      '.yrm-cookie__title{margin:0;font-family:Fraunces,Georgia,"Times New Roman",serif;font-size:30px;line-height:1.12;font-weight:300;letter-spacing:-.03em;max-width:560px;color:#c8a84e !important;}',
      '.yrm-cookie__title span{color:#c8a84e !important;}',
      '.yrm-cookie__text{margin:14px 0 0;max-width:620px;font-size:14px;line-height:1.72;color:rgba(255,255,255,.72);}',
      '.yrm-cookie__text strong{font-weight:600;color:#f3e2a2;}',
      '.yrm-cookie__summary{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 20px;padding:0;list-style:none;}',
      '.yrm-cookie__summary li{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid rgba(255,255,255,.08);border-radius:999px;background:rgba(255,255,255,.04);font-size:12px;color:rgba(255,255,255,.88);}',
      '.yrm-cookie__summary li strong{font-weight:600;color:#fff;}',
      '.yrm-cookie__summary li:before{content:"";width:8px;height:8px;border-radius:50%;background:#c8a84e;box-shadow:0 0 0 4px rgba(200,168,78,.14);}',
      '.yrm-cookie__prefs{display:grid;grid-template-rows:0fr;transition:grid-template-rows .28s ease,margin .28s ease;overflow:hidden;margin:0;}',
      '.yrm-cookie.is-open .yrm-cookie__prefs{grid-template-rows:1fr;margin:0 0 22px;}',
      '.yrm-cookie__prefs-inner{min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:12px;}',
      '.yrm-cookie__card{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:16px 18px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);}',
      '.yrm-cookie__card:hover{border-color:rgba(200,168,78,.26);}',
      '.yrm-cookie__card h3{margin:0 0 4px;font-size:14px;font-weight:600;color:#c8a84e !important;}',
      '.yrm-cookie__card p{margin:0;font-size:12px;line-height:1.58;color:rgba(255,255,255,.56);max-width:520px;}',
      '.yrm-cookie__badge{display:inline-flex;margin-top:8px;padding:3px 8px;border-radius:999px;border:1px solid rgba(200,168,78,.24);background:rgba(200,168,78,.11);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(243,226,162,.86);}',
      '.yrm-cookie__switch{position:relative;display:inline-flex;flex:0 0 auto;width:50px;height:28px;margin-top:2px;}',
      '.yrm-cookie__switch input{position:absolute;opacity:0;inset:0;cursor:pointer;}',
      '.yrm-cookie__switch-track{position:absolute;inset:0;border-radius:999px;background:rgba(255,255,255,.12);transition:background .22s ease;}',
      '.yrm-cookie__switch-track:after{content:"";position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.42);transition:transform .22s ease,background .22s ease;}',
      '.yrm-cookie__switch input:checked + .yrm-cookie__switch-track{background:#c8a84e;}',
      '.yrm-cookie__switch input:checked + .yrm-cookie__switch-track:after{transform:translateX(22px);background:#111;}',
      '.yrm-cookie__switch input:disabled + .yrm-cookie__switch-track{opacity:.62;cursor:not-allowed;}',
      '.yrm-cookie__actions{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;}',
      '.yrm-cookie__btn{appearance:none;border:0;border-radius:10px;padding:14px 20px;font:inherit;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,background .18s ease,color .18s ease,border-color .18s ease;text-align:center;}',
      '.yrm-cookie__btn:hover{transform:translateY(-1px);}',
      '.yrm-cookie__btn--primary{background:#c8a84e;color:#111;box-shadow:0 10px 28px rgba(200,168,78,.28);}',
      '.yrm-cookie__btn--primary:hover{background:#d4b660;box-shadow:0 14px 34px rgba(200,168,78,.34);}',
      '.yrm-cookie__btn--secondary{background:transparent;border:1px solid rgba(255,255,255,.16);color:rgba(255,255,255,.78);}',
      '.yrm-cookie__btn--secondary:hover{border-color:rgba(200,168,78,.44);color:#f3e2a2;background:rgba(200,168,78,.06);}',
      '.yrm-cookie__btn--ghost{background:transparent;color:rgba(255,255,255,.46);padding-inline:8px;text-transform:none;letter-spacing:.02em;text-decoration:underline;text-underline-offset:4px;}',
      '.yrm-cookie__btn--ghost:hover{color:rgba(255,255,255,.72);background:transparent;box-shadow:none;}',
      '.yrm-cookie__footer{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;margin-top:18px;font-size:11px;letter-spacing:.04em;color:rgba(255,255,255,.26);}',
      '.yrm-cookie__footer a{color:rgba(255,255,255,.34);text-decoration:none;transition:color .18s ease;}',
      '.yrm-cookie__footer a:hover{color:#c8a84e;}',
      '.yrm-cookie__divider{opacity:.2;}',
      '@media (max-width: 720px){',
      '  #' + CONFIG.overlayId + '{padding:0;align-items:flex-end;}',
      '  .yrm-cookie{width:100%;padding:28px 22px 24px;border-radius:20px 20px 0 0;}',
      '  .yrm-cookie__title{font-size:26px;max-width:none;}',
      '  .yrm-cookie__actions{grid-template-columns:1fr;}',
      '  .yrm-cookie__btn--ghost{padding:4px 8px;}',
      '}',
      '@media (max-width: 520px){',
      '  .yrm-cookie__card{padding:14px;gap:12px;}',
      '  .yrm-cookie__title{font-size:24px;}',
      '  .yrm-cookie__summary{gap:8px;}',
      '  .yrm-cookie__summary li{width:100%;justify-content:flex-start;}',
      '}'
    ].join('');

    document.head.appendChild(style);
  }

  function buildBannerHtml(prefs) {
    var analyticsChecked = prefs.analytics ? ' checked' : '';
    var marketingChecked = prefs.marketing ? ' checked' : '';

    return '' +
      '<div id="' + CONFIG.overlayId + '">' +
        '<section class="yrm-cookie" role="dialog" aria-modal="true" aria-labelledby="yarmi-cookie-rebuild-title">' +
          '<p class="yrm-cookie__eyebrow">Yarmi.sk · Cookies</p>' +
          '<h2 class="yrm-cookie__title" id="yarmi-cookie-rebuild-title">Môžeme ti web spríjemniť <span>cookies</span>?</h2>' +
          '<p class="yrm-cookie__text">Používame ich pre <strong>fungovanie košíka</strong>, meranie návštevnosti a relevantnejší marketing. Voliteľné cookies si vieš zapnúť zvlášť a kedykoľvek si výber zmeniť.</p>' +
          '<ul class="yrm-cookie__summary" aria-hidden="true">' +
            '<li><strong>Nevyhnutné</strong> pre chod e-shopu</li>' +
            '<li><strong>Analytika</strong> pre zlepšovanie webu</li>' +
            '<li><strong>Marketing</strong> pre relevantné kampane</li>' +
          '</ul>' +
          '<div class="yrm-cookie__prefs" id="yarmi-cookie-rebuild-prefs">' +
            '<div class="yrm-cookie__prefs-inner">' +
              '<div class="yrm-cookie__card">' +
                '<div>' +
                  '<h3>Nevyhnutné cookies</h3>' +
                  '<p>Košík, prihlásenie, bezpečnosť a technické fungovanie stránky. Bez nich e-shop nefunguje správne.</p>' +
                  '<span class="yrm-cookie__badge">Vždy aktívne</span>' +
                '</div>' +
                '<label class="yrm-cookie__switch" aria-label="Nevyhnutné cookies">' +
                  '<input type="checkbox" checked disabled>' +
                  '<span class="yrm-cookie__switch-track"></span>' +
                '</label>' +
              '</div>' +
              '<div class="yrm-cookie__card">' +
                '<div>' +
                  '<h3>Analytické cookies</h3>' +
                  '<p>Pomáhajú nám rozumieť tomu, čo na webe funguje, a vylepšovať nákupný zážitok bez hádania.</p>' +
                '</div>' +
                '<label class="yrm-cookie__switch" aria-label="Analytické cookies">' +
                  '<input type="checkbox" id="yarmi-cookie-rebuild-analytics"' + analyticsChecked + '>' +
                  '<span class="yrm-cookie__switch-track"></span>' +
                '</label>' +
              '</div>' +
              '<div class="yrm-cookie__card">' +
                '<div>' +
                  '<h3>Marketingové cookies</h3>' +
                  '<p>Umožnia zobrazovať relevantnejšie kampane a personalizovaný obsah aj mimo yarmi.sk.</p>' +
                '</div>' +
                '<label class="yrm-cookie__switch" aria-label="Marketingové cookies">' +
                  '<input type="checkbox" id="yarmi-cookie-rebuild-marketing"' + marketingChecked + '>' +
                  '<span class="yrm-cookie__switch-track"></span>' +
                '</label>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="yrm-cookie__actions">' +
            '<button type="button" class="yrm-cookie__btn yrm-cookie__btn--primary" id="yarmi-cookie-rebuild-accept">Prijať všetko</button>' +
            '<button type="button" class="yrm-cookie__btn yrm-cookie__btn--secondary" id="yarmi-cookie-rebuild-manage">Prispôsobiť</button>' +
            '<button type="button" class="yrm-cookie__btn yrm-cookie__btn--ghost" id="yarmi-cookie-rebuild-reject">Odmietnuť voliteľné</button>' +
          '</div>' +
          '<div class="yrm-cookie__footer">' +
            '<a href="' + CONFIG.privacyUrl + '" target="_blank" rel="noopener">Ochrana osobných údajov</a>' +
            '<span class="yrm-cookie__divider">·</span>' +
            '<a href="' + CONFIG.cookiesUrl + '" target="_blank" rel="noopener">Zásady cookies</a>' +
          '</div>' +
        '</section>' +
      '</div>';
  }

  function openBanner(prefs, openPreferences) {
    if (!document.body) return;

    removeBanner();
    suppressExistingBanners(document);

    var wrapper = document.createElement('div');
    wrapper.innerHTML = buildBannerHtml(prefs || getInitialPrefs());

    var overlay = wrapper.firstElementChild;
    document.body.appendChild(overlay);

    bindBannerEvents(overlay);
    setPreferencesOpen(overlay, !!openPreferences);
    lockScroll();

    var primaryButton = overlay.querySelector('#yarmi-cookie-rebuild-accept');
    if (primaryButton) primaryButton.focus();
  }

  function bindBannerEvents(overlay) {
    var acceptButton = overlay.querySelector('#yarmi-cookie-rebuild-accept');
    var manageButton = overlay.querySelector('#yarmi-cookie-rebuild-manage');
    var rejectButton = overlay.querySelector('#yarmi-cookie-rebuild-reject');

    if (acceptButton) {
      acceptButton.addEventListener('click', function () {
        var isOpen = isPreferencesOpen(overlay);
        var payload;
        if (isOpen) {
          payload = {
            analytics: !!overlay.querySelector('#yarmi-cookie-rebuild-analytics').checked,
            marketing: !!overlay.querySelector('#yarmi-cookie-rebuild-marketing').checked
          };
        } else {
          payload = { analytics: true, marketing: true };
        }
        emitUserAction('accept_click', payload);
        saveConsent(payload);
        closeBanner();
      });
    }

    if (manageButton) {
      manageButton.addEventListener('click', function () {
        var willOpen = !isPreferencesOpen(overlay);
        emitUserAction('manage_toggle', { open: willOpen });
        setPreferencesOpen(overlay, willOpen);
      });
    }

    if (rejectButton) {
      rejectButton.addEventListener('click', function () {
        emitUserAction('reject_click', { analytics: false, marketing: false });
        saveConsent({ analytics: false, marketing: false });
        closeBanner();
      });
    }
  }

  function isPreferencesOpen(overlay) {
    var card = overlay.querySelector('.yrm-cookie');
    return !!(card && card.classList.contains('is-open'));
  }

  function setPreferencesOpen(overlay, isOpen) {
    var card = overlay.querySelector('.yrm-cookie');
    var acceptButton = overlay.querySelector('#yarmi-cookie-rebuild-accept');
    var manageButton = overlay.querySelector('#yarmi-cookie-rebuild-manage');

    if (!card || !acceptButton || !manageButton) return;

    card.classList.toggle('is-open', !!isOpen);
    acceptButton.textContent = isOpen ? 'Uložiť výber' : 'Prijať všetko';
    manageButton.textContent = isOpen ? 'Zavrieť nastavenia' : 'Prispôsobiť';
  }

  function saveConsent(prefs) {
    var data = {
      version: CONFIG.version,
      timestamp: new Date().toISOString(),
      necessary: true,
      analytics: !!prefs.analytics,
      marketing: !!prefs.marketing,
      source: 'yarmi-cookie-banner-rebuild'
    };

    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
    } catch (error) {
      // no-op
    }

    storedConsent = data;
    // Set Shoptet's CookiesConsent cookie immediately so subsequent page loads
    // have fbevents.js available without waiting for applyShoptetConsent to succeed.
    setShoptetCookieConsent(data.analytics, data.marketing);
    applyShoptetConsent(data);
    syncConsentMode(data, 'update');
    dispatchConsentUpdate(data);

    // Send a page_view to GA4 immediately after consent is granted so the landing page
    // appears in reports right away (without requiring the user to navigate elsewhere).
    // The initial page_view fired at page-load had gcs=G100 (consent denied = only modeled
    // aggregate data). This G111 hit is the first "real" page_view for the session.
    triggerAnalyticsPageview(data);

    // Sync to Facebook pixel and other trackers
    syncPixelConsent(data);
  }
  
  function triggerAnalyticsPageview(data) {
    if (!data || !data.analytics) return;

    if (sentGaPageView) return;

    // Wait for both gtag (for Google Ads) AND the _ga cookie (confirms GA4 has
    // initialized with analytics_storage=granted and assigned a persistent client ID).
    runWhenAvailable(function () {
      if (typeof window.gtag !== 'function') return false;
      var gaCookie = document.cookie.split(';').map(function(c){ return c.trim(); })
        .find(function(c){ return c.startsWith('_ga=GA'); });
      return !!gaCookie;
    }, function (attempt) {
      if (sentGaPageView) return;

      sentGaPageView = true;

      // 1. Fire via GTM — reaches Google Ads remarketing tags
      try {
        window.gtag('event', 'page_view', {
          page_path: window.location.pathname + window.location.search,
          page_title: document.title
        });
      } catch (error) { /* non-fatal */ }

      // 2. Send directly to GA4 — GTM routes page_view to Google Ads only, NOT to GA4.
      //    A direct sendBeacon bypasses GTM and gives GA4 a real gcs=G111 page_view hit,
      //    which appears immediately in real-time reports and properly records the landing page.
      //    sendDirectGa4Pageview has its own internal try-catch so errors are contained.
      sendDirectGa4Pageview();

      emitUserAction('ga_page_view_sent', { attempt: attempt });
    }, {
      retries: CONFIG.trackerReadyRetries,
      delay: CONFIG.trackerReadyRetryDelay,
      onFailureAction: 'ga_page_view_not_sent'
    });
  }

  function sendDirectGa4Pageview() {
    // Parse client ID from _ga cookie (format: GA1.1.XXXXXXXXXX.XXXXXXXXXX)
    var cid = null;
    var gaCookie = document.cookie.split(';').map(function(c){ return c.trim(); })
      .find(function(c){ return c.startsWith('_ga='); });
    if (gaCookie) {
      var parts = gaCookie.split('=')[1].split('.');
      if (parts.length >= 4) cid = parts[2] + '.' + parts[3];
    }
    if (!cid) return;

    // Detect GA4 measurement ID (G-XXXXXXXX) from GTM container keys
    var ga4Id = null;
    try {
      var gtmKeys = window.google_tag_manager ? Object.keys(window.google_tag_manager) : [];
      for (var k = 0; k < gtmKeys.length; k++) {
        if (/^G-[A-Z0-9]+$/.test(gtmKeys[k])) { ga4Id = gtmKeys[k]; break; }
      }
    } catch (e) {}
    if (!ga4Id) return;

    // Parse session ID and count from _ga_XXXX session cookie
    // Format: GS2.1.s{SID}$o{SCT}$g{ENG}$...
    var sid = String(Math.floor(Date.now() / 1000));
    var sct = '1';
    try {
      var ssCookieName = '_ga_' + ga4Id.replace('G-', '') + '=';
      var ssCookie = document.cookie.split(';').map(function(c){ return c.trim(); })
        .find(function(c){ return c.startsWith(ssCookieName); });
      if (ssCookie) {
        var ssVal = ssCookie.split('=')[1];
        var sidMatch = ssVal.match(/\.s(\d{8,})/);
        var sctMatch = ssVal.match(/\$o(\d+)/);
        if (sidMatch) sid = sidMatch[1];
        if (sctMatch) sct = sctMatch[1];
      }
    } catch (e) {}

    // Parse UTM + gclid from the captured landing URL and pass as explicit
    // campaign parameters. Without these, GA4 ignores UTMs embedded in dl=
    // and falls back to HTTP referrer (→ shows l.facebook.com/referral instead
    // of facebook/cpc with the correct campaign name).
    var utmParams = [];
    try {
      var landingSearch = capturedLandingUrl.indexOf('?') !== -1
        ? capturedLandingUrl.split('?')[1]
        : '';
      if (landingSearch) {
        var usp = new URLSearchParams(landingSearch);
        var utmSource   = usp.get('utm_source');
        var utmMedium   = usp.get('utm_medium');
        var utmCampaign = usp.get('utm_campaign');
        var utmContent  = usp.get('utm_content');
        var utmTerm     = usp.get('utm_term');
        var utmId       = usp.get('utm_id');
        var gclid       = usp.get('gclid');
        if (utmSource)   utmParams.push('cs='    + encodeURIComponent(utmSource));
        if (utmMedium)   utmParams.push('cm='    + encodeURIComponent(utmMedium));
        if (utmCampaign) utmParams.push('cn='    + encodeURIComponent(utmCampaign));
        if (utmContent)  utmParams.push('cc='    + encodeURIComponent(utmContent));
        if (utmTerm)     utmParams.push('ck='    + encodeURIComponent(utmTerm));
        if (utmId)       utmParams.push('ci='    + encodeURIComponent(utmId));
        if (gclid)       utmParams.push('gclid=' + encodeURIComponent(gclid));
      }
    } catch (e) {}

    var params = [
      'v=2',
      'tid=' + encodeURIComponent(ga4Id),
      'cid=' + encodeURIComponent(cid),
      'en=page_view',
      'dl=' + encodeURIComponent(capturedLandingUrl),
      'dt=' + encodeURIComponent(document.title),
      'gcs=G111',
      'gcd=13r3r3r2r5l1',
      'npa=0',
      'dma=1',
      'dma_cps=a',
      'sid=' + encodeURIComponent(sid),
      'sct=' + encodeURIComponent(sct),
      'seg=1',
      '_s=1',
      'ul=' + encodeURIComponent((navigator.language || 'sk').toLowerCase()),
      'frm=0',
      'pscdl=noapi'
    ].concat(utmParams).join('&');

    navigator.sendBeacon(
      'https://region1.analytics.google.com/g/collect?' + params
    );
  }
  
  function syncPixelConsent(data) {
    if (data && data.marketing) {
      // If fbq not loaded (new user — Shoptet skips fbevents.js without CookiesConsent cookie),
      // load fbevents.js dynamically ourselves so PageView fires on THIS visit.
      // This is the fix for "Landing page views = 0" in Meta Ads Manager.
      if (typeof window.fbq !== 'function') {
        loadFbPixelDynamic(data);
        return;
      }
      runWhenAvailable(function () {
        return typeof window.fbq === 'function';
      }, function (attempt) {
        try {
          // Re-inject external_id after fbevents.js is fully loaded (belt-and-suspenders).
          // The init-time injection queued it for new events; this call ensures it's merged
          // into the live fbq instance state for any late-firing events.
          // Pixel ID: stored in _fbq.instance.pixelsByID (keyed by numeric pixel ID string).
          // Direct instance key scan and _fbq key scan are unreliable — pixelsByID is correct.
          try {
            var pixelId = null;
            // Primary: pixelsByID (correct location in all fbevents.js versions tested)
            if (window._fbq && window._fbq.instance && window._fbq.instance.pixelsByID) {
              var pidKeys = Object.keys(window._fbq.instance.pixelsByID);
              var pidNum = pidKeys.find(function(k){ return /^\d{10,16}$/.test(k); });
              if (pidNum) pixelId = pidNum;
            }
            // Fallback A: direct _fbq.instance numeric keys (older fbevents.js versions)
            if (!pixelId && window._fbq && window._fbq.instance) {
              var instKeys = Object.keys(window._fbq.instance);
              var numKey = instKeys.find(function(k){ return /^\d{10,16}$/.test(k); });
              if (numKey) pixelId = numKey;
            }
            // Fallback B: scan all _fbq keys
            if (!pixelId && window._fbq) {
              var fbqKeys = Object.keys(window._fbq);
              var numFallback = fbqKeys.find(function(k){ return /^\d{10,16}$/.test(k); });
              if (numFallback) pixelId = numFallback;
            }
            if (pixelId) {
              var extId = null;
              var ccRaw2 = document.cookie.split(';').map(function(c){ return c.trim(); })
                .find(function(c){ return c.startsWith('CookiesConsent='); });
              if (ccRaw2) {
                try {
                  var ccObj2 = JSON.parse(decodeURIComponent(ccRaw2.split('=').slice(1).join('=')));
                  if (ccObj2 && ccObj2.cookieId) extId = String(ccObj2.cookieId);
                } catch(e2) {}
              }
              if (!extId) {
                var fbpCk2 = document.cookie.split(';').map(function(c){ return c.trim(); })
                  .find(function(c){ return c.startsWith('_fbp='); });
                if (fbpCk2) extId = fbpCk2.split('=').slice(1).join('=');
              }
              if (extId) {
                window.fbq('init', pixelId, { external_id: extId });
              }
            }
          } catch(e3) {}

          // CookieConsent custom event for analytics (optional, for tracking consent actions)
          window.fbq('trackCustom', 'CookieConsent', {
            necessary: true,
            analytics: !!data.analytics,
            marketing: !!data.marketing,
            timestamp: new Date().toISOString()
          });
          // NOTE: We do NOT call fbq('track','PageView') here.
          // Shoptet loads fbevents.js after CookiesConsent cookie is set, and
          // fbevents.js automatically fires PageView on init. A manual call here
          // would cause a duplicate PageView in Meta Pixel / Ads Manager.
        } catch (error) {
          return;
        }

        emitUserAction('fb_pixel_sent', { attempt: attempt });
      }, {
        retries: CONFIG.trackerReadyRetries,
        delay: CONFIG.trackerReadyRetryDelay,
        onFailureAction: 'fb_pixel_not_sent'
      });
    }
    
    // Generic pixel tracking - emit event that custom code can listen to
    emitPixelEvent('cookie_consent', {
      necessary: true,
      analytics: !!data.analytics,
      marketing: !!data.marketing
    });
    
    // Push to dataLayer for any pixel listening there
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'pixel_cookie_consent',
      consent: {
        necessary: true,
        analytics: !!data.analytics,
        marketing: !!data.marketing
      }
    });
  }

  function runWhenAvailable(checkFn, callback, options) {
    var retries = options && options.retries ? options.retries : 1;
    var delay = options && options.delay ? options.delay : 50;
    var onFailureAction = options && options.onFailureAction;
    var attempt = 0;

    function tryRun() {
      attempt += 1;

      if (checkFn()) {
        callback(attempt);
        return;
      }

      if (attempt < retries) {
        window.setTimeout(tryRun, delay);
        return;
      }

      if (onFailureAction) {
        emitUserAction(onFailureAction, { attempt: attempt });
      }
    }

    tryRun();
  }
  
  function emitPixelEvent(eventName, detail) {
    try {
      window.dispatchEvent(new CustomEvent('yarmi:pixel-event', {
        detail: {
          event: eventName,
          data: detail,
          timestamp: new Date().toISOString()
        }
      }));
    } catch (error) {
      // no-op
    }
  }

  // Set Shoptet's CookiesConsent cookie directly.
  // Format: {"consent":"analytics,personalisation","cookieId":"<id>"}
  // "analytics" = analytics tracking, "personalisation" = marketing/ads tracking.
  // Shoptet checks this cookie to decide whether to load fbevents.js and similar scripts.
  function setShoptetCookieConsent(analytics, marketing) {
    try {
      // Reuse existing cookieId if available, otherwise derive from _fbp or generate one
      var cookieId = null;
      var existingCC = document.cookie.split(';').map(function(c){ return c.trim(); })
        .find(function(c){ return c.startsWith('CookiesConsent='); });
      if (existingCC) {
        try {
          var ex = JSON.parse(decodeURIComponent(existingCC.split('=').slice(1).join('=')));
          if (ex && ex.cookieId) cookieId = ex.cookieId;
        } catch(e) {}
      }
      if (!cookieId) {
        var fbpCk = document.cookie.split(';').map(function(c){ return c.trim(); })
          .find(function(c){ return c.startsWith('_fbp='); });
        cookieId = fbpCk ? fbpCk.split('=').slice(1).join('=') :
          ('yc.' + Date.now() + '.' + Math.floor(Math.random() * 1000000000));
      }
      var cats = [];
      if (analytics) cats.push('analytics');
      if (marketing) cats.push('personalisation');
      var ccVal = JSON.stringify({ consent: cats.join(','), cookieId: cookieId });
      var exp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      var domain = location.hostname.replace(/^www\./, '');
      document.cookie = 'CookiesConsent=' + encodeURIComponent(ccVal) +
        '; expires=' + exp + '; path=/; domain=.' + domain + '; SameSite=Lax';
    } catch(e) {}
  }

  // Dynamically load fbevents.js when Shoptet hasn't loaded it (new user, no CookiesConsent cookie).
  // Creates the fbq stub, inits the pixel with external_id, fires PageView, then loads fbevents.js.
  // This fires the PageView on the CURRENT visit so it counts as a Meta Landing page view.
  function loadFbPixelDynamic(data) {
    try {
      // Detect pixel ID from Shoptet's noscript tag (always present if pixel configured)
      var pixelId = null;
      Array.from(document.querySelectorAll('noscript')).forEach(function(n) {
        if (!pixelId) {
          var m = n.innerHTML.match(/facebook\.com\/tr[^"']*[?&]id=(\d{10,16})/);
          if (m) pixelId = m[1];
        }
      });
      // Fallback: search inline scripts
      if (!pixelId) {
        Array.from(document.querySelectorAll('script:not([src])')).forEach(function(s) {
          if (!pixelId) {
            var m = s.textContent.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{10,16})['"]/);
            if (m) pixelId = m[1];
          }
        });
      }
      if (!pixelId) return;

      // Create fbq stub if missing
      if (typeof window.fbq !== 'function') {
        var fbqFn = function() {
          fbqFn.callMethod ?
            fbqFn.callMethod.apply(fbqFn, arguments) :
            fbqFn.queue.push(arguments);
        };
        fbqFn.push    = fbqFn;
        fbqFn.loaded  = true;
        fbqFn.version = '2.0';
        fbqFn.queue   = [];
        window.fbq = fbqFn;
        if (!window._fbq) window._fbq = fbqFn;
      }

      // Get external_id from CookiesConsent cookie (just set by setShoptetCookieConsent)
      var extId = null;
      var ccRaw = document.cookie.split(';').map(function(c){ return c.trim(); })
        .find(function(c){ return c.startsWith('CookiesConsent='); });
      if (ccRaw) {
        try {
          var ccObj = JSON.parse(decodeURIComponent(ccRaw.split('=').slice(1).join('=')));
          if (ccObj && ccObj.cookieId) extId = String(ccObj.cookieId);
        } catch(e2) {}
      }
      if (!extId) {
        var fbpCk = document.cookie.split(';').map(function(c){ return c.trim(); })
          .find(function(c){ return c.startsWith('_fbp='); });
        if (fbpCk) extId = fbpCk.split('=').slice(1).join('=');
      }

      // Init pixel + queue PageView — fbevents.js will process queue when it loads
      var dynEventId = 'ypv.' + Date.now() + '.' + Math.random().toString(36).substring(2, 10);
      window.fbq('init', pixelId, extId ? { external_id: extId } : {});
      window.fbq('track', 'PageView', {}, { eventID: dynEventId });

      // Load fbevents.js dynamically
      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);

      emitUserAction('fb_pixel_dynamic_loaded', { pixelId: pixelId, hasExtId: !!extId });
    } catch(e) {}
  }

  function applyShoptetConsent(consent) {
    var analytics = !!(consent && consent.analytics);
    var marketing = !!(consent && consent.marketing);
    var attempt = 0;
    var startedAt = Date.now();

    function syncAttempt() {
      attempt += 1;

      // First try to update Shoptet API directly
      var apiMethod = tryShoptetApiSync(analytics, marketing);
      if (apiMethod) {
        emitUserAction('shoptet_sync_success', {
          method: apiMethod,
          attempt: attempt,
          elapsedMs: Date.now() - startedAt,
          analytics: analytics,
          marketing: marketing
        });
        return;
      }

      // Then try DOM methods (click buttons)
      var domMethod = tryShoptetDomSync(analytics, marketing);
      if (domMethod) {
        emitUserAction('shoptet_sync_success', {
          method: domMethod,
          attempt: attempt,
          elapsedMs: Date.now() - startedAt,
          analytics: analytics,
          marketing: marketing
        });
        return;
      }

      // Try custom Shoptet methods if available
      var customMethod = tryCustomShoptetMethods(analytics, marketing);
      if (customMethod) {
        emitUserAction('shoptet_sync_success', {
          method: customMethod,
          attempt: attempt,
          elapsedMs: Date.now() - startedAt,
          analytics: analytics,
          marketing: marketing
        });
        return;
      }

      if (attempt < CONFIG.shoptetSyncRetries) {
        window.setTimeout(syncAttempt, CONFIG.shoptetSyncRetryDelay);
        return;
      }

      emitUserAction('shoptet_sync_failed', {
        attempt: attempt,
        elapsedMs: Date.now() - startedAt,
        analytics: analytics,
        marketing: marketing
      });
    }

    window.setTimeout(syncAttempt, CONFIG.shoptetSyncDelay);
  }

  function tryCustomShoptetMethods(analytics, marketing) {
    try {
      // Try to trigger consent using window functions
      if (typeof window.setCookieConsent === 'function') {
        window.setCookieConsent({
          necessary: true,
          analytics: analytics,
          marketing: marketing
        });
        return 'window.setCookieConsent';
      }

      // Try common consent management patterns
      if (analytics && marketing) {
        if (typeof window.acceptAllCookies === 'function') {
          window.acceptAllCookies();
          return 'window.acceptAllCookies';
        }
      } else if (!analytics && !marketing) {
        if (typeof window.rejectOptionalCookies === 'function') {
          window.rejectOptionalCookies();
          return 'window.rejectOptionalCookies';
        }
      }

      // Try to find and trigger any Shoptet global cookie handler
      if (window.shoptet && typeof window.shoptet.confirmConsent === 'function') {
        var result = window.shoptet.confirmConsent({
          necessary: true,
          analytics: analytics,
          marketing: marketing
        });
        if (result) return 'shoptet.confirmConsent';
      }
    } catch (error) {
      // no-op
    }

    return '';
  }

  function tryShoptetApiSync(analytics, marketing) {
    try {
      // NOTE: shoptet.consent.cookiesConsentSubmit() does NOT trigger sendBeacon server-side
      // when called programmatically (confirmed via live debugging — no beacon fires, no CookiesConsent
      // cookie is set, and Meta Pixel never loads). We intentionally skip it here and let
      // tryShoptetDomSync click the real DOM button instead, which DOES trigger the beacon.

      // Fallback: legacy shoptet.cookies API (older Shoptet versions)
      var api = window.shoptet && window.shoptet.cookies;
      if (!api) return false;

      var payload = {
        necessary: true,
        analytics: analytics,
        statistical: analytics,
        statistics: analytics,
        marketing: marketing,
        ad_storage: marketing
      };

      if (typeof api.setConsent === 'function') {
        api.setConsent(payload);
        return 'api.setConsent';
      }
      if (typeof api.setCookiesConsent === 'function') {
        api.setCookiesConsent(payload);
        return 'api.setCookiesConsent';
      }
      if (typeof api.setConsentSettings === 'function') {
        api.setConsentSettings(payload);
        return 'api.setConsentSettings';
      }
      if (analytics && marketing && typeof api.acceptAll === 'function') {
        api.acceptAll();
        return 'api.acceptAll';
      }
      if (!analytics && !marketing && typeof api.rejectOptional === 'function') {
        api.rejectOptional();
        return 'api.rejectOptional';
      }
    } catch (error) {
      // no-op
    }

    return '';
  }

  function tryShoptetDomSync(analytics, marketing) {
    var root = document;

    setOptionalCategoryInputs(root, analytics, marketing);

    if (analytics && marketing) {
      // Shoptet hides .js-siteCookies via display:none after the banner is dismissed.
      // .js-cookiesConsentSubmit lives inside .js-siteCookies, and some browsers/Shoptet
      // event handlers require the element (or its ancestors) to be visible for .click()
      // to trigger the beacon call that saves consent server-side and loads Meta Pixel.
      // We temporarily force-show the container, click the button, then re-hide it.
      var shoptetBtn = document.querySelector('.js-cookiesConsentSubmit');
      if (shoptetBtn) {
        // Collect ancestors that are currently hidden so we can restore them
        var hiddenAncestors = [];
        var node = shoptetBtn.parentElement;
        while (node && node !== document.body) {
          var cs = window.getComputedStyle(node);
          if (cs.display === 'none' || node.style.display === 'none') {
            hiddenAncestors.push({ el: node, inlineDisplay: node.style.display });
            node.style.setProperty('display', 'block', 'important');
          }
          node = node.parentElement;
        }
        try {
          shoptetBtn.click();
        } catch (e) { /* no-op */ }
        // Re-hide immediately — the beacon is async so consent is still sent
        for (var hi = 0; hi < hiddenAncestors.length; hi++) {
          hiddenAncestors[hi].el.style.display = hiddenAncestors[hi].inlineDisplay;
        }
        return 'dom.acceptAll.shoptetBtn';
      }

      if (clickFirst(root, [
        '.js-cookies-accept',
        '.js-siteCookies [type="submit"]',
        '.siteCookies button[type="submit"]',
        '.siteCookies .js-button-accept',
        '.js-siteCookies .js-button-accept',
        '[data-testid="cookies-accept-all"]',
        '[data-cookies="accept-all"]',
        '[data-cc="accept-all"]',
        '.cookie-consent__accept-all'
      ])) {
        return 'dom.acceptAll';
      }

      // Try to find button by text content
      if (clickFirstByText(root, ['Súhlasím', 'súhlasím', 'Accept', 'Accept all'])) {
        return 'dom.acceptAllByText';
      }

      return '';
    }

    if (!analytics && !marketing) {
      if (clickFirst(root, [
        '.js-cookies-reject',
        '.js-cookies-decline',
        '.siteCookies .js-button-reject',
        '.js-siteCookies .js-button-reject',
        '[data-testid="cookies-reject-all"]',
        '[data-cookies="reject-all"]',
        '[data-cc="reject-all"]',
        '.cookie-consent__reject-all'
      ])) {
        return 'dom.rejectAll';
      }
      return '';
    }

    // Custom consent (e.g. analytics yes / marketing no) -> save selected categories.
    if (clickFirst(root, [
      '.js-cookies-save',
      '.js-cookies-confirm',
      '.siteCookies .js-button-confirm',
      '.js-siteCookies .js-button-confirm',
      '[data-testid="cookies-save"]',
      '[data-cookies="save"]',
      '[data-cc="save"]',
      '.cookie-consent__save'
    ])) {
      return 'dom.saveSelection';
    }

    return '';
  }

  function clickFirstByText(root, textOptions) {
    var buttons = collectMatches(root, 'button, input[type="button"], input[type="submit"]');
    for (var i = 0; i < buttons.length; i += 1) {
      var button = buttons[i];
      if (!button || button.disabled) continue;
      
      var buttonText = (button.textContent || button.value || '').trim().toLowerCase();
      for (var j = 0; j < textOptions.length; j += 1) {
        if (buttonText.indexOf(textOptions[j].toLowerCase()) !== -1) {
          try {
            button.click();
            return true;
          } catch (error) {
            // no-op
          }
        }
      }
    }
    return false;
  }

  function setOptionalCategoryInputs(root, analytics, marketing) {
    var inputs = collectMatches(root, 'input[type="checkbox"], input[type="radio"]');

    for (var i = 0; i < inputs.length; i += 1) {
      var input = inputs[i];
      if (!input || input.disabled) continue;

      var key = normalizeText([
        input.name,
        input.id,
        input.value,
        input.getAttribute('data-category'),
        input.getAttribute('data-cookie-category'),
        input.className,
        input.getAttribute('aria-label')
      ].join(' '));

      if (!key) continue;

      if (/(analytics|analyt|statistic|meranie|measurement)/.test(key)) {
        input.checked = !!analytics;
        triggerInputChange(input);
      }

      if (/(marketing|remarketing|ads|reklam|ad_storage|personaliz)/.test(key)) {
        input.checked = !!marketing;
        triggerInputChange(input);
      }
    }
  }

  function triggerInputChange(input) {
    try {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (error) {
      // no-op
    }
  }

  function clickFirst(root, selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      var nodes = collectMatches(root, selectors[i]);
      for (var j = 0; j < nodes.length; j += 1) {
        var node = nodes[j];
        if (!node || node.disabled) continue;
        try {
          node.click();
          return true;
        } catch (error) {
          // no-op
        }
      }
    }
    return false;
  }

  function dispatchConsentUpdate(data) {
    try {
      window.dispatchEvent(new CustomEvent('yarmi:cookie-consent-updated', {
        detail: data
      }));
    } catch (error) {
      // no-op
    }
  }

  function emitUserAction(action, detail) {
    var payload = detail || {};

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'yarmi_cookie_action',
      action: action,
      analytics: payload.analytics,
      marketing: payload.marketing,
      method: payload.method,
      attempt: payload.attempt,
      elapsed_ms: payload.elapsedMs,
      open: payload.open
    });

    if (isDebugEnabled()) {
      try {
        console.info('[Yarmi Cookie]', action, payload);
      } catch (error) {
        // no-op
      }
    }
  }

  function isDebugEnabled() {
    try {
      if (window.location && /[?&]yarmiCookieDebug=1(?:&|$)/.test(window.location.search)) {
        return true;
      }
      return localStorage.getItem(CONFIG.debugStorageKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function syncConsentMode(consent, mode) {
    var payload = {
      analytics_storage: consent && consent.analytics ? 'granted' : 'denied',
      ad_storage: consent && consent.marketing ? 'granted' : 'denied',
      ad_user_data: consent && consent.marketing ? 'granted' : 'denied',
      ad_personalization: consent && consent.marketing ? 'granted' : 'denied'
    };

    if (mode === 'default') {
      payload.wait_for_update = 500;
    }

    runWhenAvailable(function () {
      return typeof window.gtag === 'function';
    }, function () {
      try {
        window.gtag('consent', mode === 'default' ? 'default' : 'update', payload);
      } catch (error) {
        // no-op
      }

      // Push dataLayer event AFTER gtag consent call so GTM re-fires tags
      // only once consent is actually granted (not before)
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: mode === 'default' ? 'yarmi_cookie_consent_default' : 'cookie_consent_update',
        analytics_storage: payload.analytics_storage,
        ad_storage: payload.ad_storage,
        ad_user_data: payload.ad_user_data,
        ad_personalization: payload.ad_personalization
      });
    }, {
      retries: CONFIG.trackerReadyRetries,
      delay: CONFIG.trackerReadyRetryDelay,
      onFailureAction: mode === 'default' ? 'gtag_default_not_sent' : 'gtag_update_not_sent'
    });
  }

  function closeBanner() {
    var overlay = document.getElementById(CONFIG.overlayId);
    if (!overlay) return;

    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.transition = 'opacity .22s ease';

    window.setTimeout(function () {
      removeBanner();
      unlockScroll();
      suppressExistingBanners(document);
    }, 220);
  }

  function removeBanner() {
    var overlay = document.getElementById(CONFIG.overlayId);
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function lockScroll() {
    if (scrollLock) return;

    scrollLock = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyPaddingRight: document.body.style.paddingRight
    };

    var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = scrollbarWidth + 'px';
    }
  }

  function unlockScroll() {
    if (!scrollLock) return;

    document.documentElement.style.overflow = scrollLock.htmlOverflow;
    document.body.style.overflow = scrollLock.bodyOverflow;
    document.body.style.paddingRight = scrollLock.bodyPaddingRight;
    scrollLock = null;
  }

  function installPublicApi() {
    window.yarmiOpenCookieSettings = function () {
      openBanner(getInitialPrefs(), true);
    };

    // Intercept clicks on Shoptet's native "manage cookie settings" link
    // (.js-cookies-settings / [data-testid="cookiesSettings"]).
    // Shoptet's own JS would try to open the native banner — which our
    // MutationObserver immediately suppresses. We catch the click first
    // (capture phase) and open our banner instead.
    document.addEventListener('click', function (e) {
      var target = e.target;
      while (target && target !== document) {
        if (target.classList && (
          target.classList.contains('js-cookies-settings') ||
          target.classList.contains('cookies-settings') ||
          target.getAttribute('data-testid') === 'cookiesSettings'
        )) {
          e.preventDefault();
          e.stopPropagation();
          openBanner(getInitialPrefs(), true);
          return;
        }
        target = target.parentElement;
      }
    }, true); // capture = true so we run before Shoptet's bubbling handler

    window.yarmiResetCookieConsent = function () {
      try {
        localStorage.removeItem(CONFIG.storageKey);
      } catch (error) {
        // no-op
      }

      storedConsent = null;
      syncConsentMode({ analytics: false, marketing: false }, 'default');
      openBanner(getInitialPrefs(), true);
    };
  }

  function startBannerSuppressionObserver() {
    if (bannerObserver || !window.MutationObserver) return;

    bannerObserver = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var mutation = mutations[i];
        if (!mutation.addedNodes || !mutation.addedNodes.length) continue;

        for (var j = 0; j < mutation.addedNodes.length; j += 1) {
          suppressExistingBanners(mutation.addedNodes[j]);
        }
      }
    });

    bannerObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
    });
  }

  function suppressExistingBanners(root) {
    suppressKnownSelectors(root);
    suppressHeuristicBanners(root);
  }

  function suppressKnownSelectors(root) {
    for (var i = 0; i < KNOWN_BANNER_SELECTORS.length; i += 1) {
      var selector = KNOWN_BANNER_SELECTORS[i];
      var matches = collectMatches(root, selector);
      for (var j = 0; j < matches.length; j += 1) {
        hideNode(matches[j]);
      }
    }
  }

  function suppressHeuristicBanners(root) {
    var candidates = collectMatches(root, 'div,section,aside,[role="dialog"],[aria-modal="true"]');
    for (var i = 0; i < candidates.length; i += 1) {
      if (looksLikeCookieBanner(candidates[i])) {
        hideNode(candidates[i]);
      }
    }
  }

  function collectMatches(root, selector) {
    var result = [];

    if (!root || root.nodeType !== 1 && root.nodeType !== 9) {
      return result;
    }

    if (root.nodeType === 1 && typeof root.matches === 'function' && root.matches(selector)) {
      result.push(root);
    }

    if (typeof root.querySelectorAll === 'function') {
      var found = root.querySelectorAll(selector);
      for (var i = 0; i < found.length; i += 1) {
        if (result.indexOf(found[i]) === -1) {
          result.push(found[i]);
        }
      }
    }

    return result;
  }

  function hideNode(node) {
    if (!node || node.nodeType !== 1 || isOurNode(node)) return;

    if (node.id === 'yarmi-cookie-css') {
      if (node.parentNode) node.parentNode.removeChild(node);
      return;
    }

    node.setAttribute(CONFIG.hiddenAttr, '1');
    node.style.setProperty('display', 'none', 'important');
    node.style.setProperty('visibility', 'hidden', 'important');
    node.style.setProperty('opacity', '0', 'important');
    node.style.setProperty('pointer-events', 'none', 'important');
  }

  function isOurNode(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.id === CONFIG.overlayId || node.id === CONFIG.styleId) return true;
    return node.closest && node.closest('#' + CONFIG.overlayId) ? true : false;
  }

  function looksLikeCookieBanner(node) {
    if (!node || node.nodeType !== 1 || isOurNode(node)) return false;
    if (node.getAttribute(CONFIG.hiddenAttr) === '1') return false;

    var combinedLabel = normalizeText((node.id || '') + ' ' + (node.className || '') + ' ' + (node.textContent || ''));
    if (!combinedLabel) return false;

    var mentionsCookies = /(cookie|cookies|consent|privacy|ochrana osobnych udajov|ochrana sukromia|zasady cookies)/.test(combinedLabel);
    if (!mentionsCookies) return false;

    var style = window.getComputedStyle ? window.getComputedStyle(node) : null;
    if (!style) return false;

    var fixedLike = style.position === 'fixed' || style.position === 'sticky';
    var modalLike = node.getAttribute('role') === 'dialog' || node.getAttribute('aria-modal') === 'true';
    var zIndex = parseInt(style.zIndex, 10);
    if (isNaN(zIndex)) zIndex = 0;

    var visibleEnough = node.offsetWidth >= 260 && node.offsetHeight >= 56;
    var highPriorityLayer = fixedLike || modalLike || zIndex >= 1000;
    var edgeAnchored = style.bottom !== 'auto' || style.top !== 'auto';

    return visibleEnough && highPriorityLayer && edgeAnchored;
  }

  function normalizeText(value) {
    var text = String(value || '').toLowerCase();
    try {
      text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (error) {
      // no-op
    }
    return text.replace(/\s+/g, ' ').trim();
  }
})();
