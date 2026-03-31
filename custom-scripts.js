// document.addEventListener('DOMContentLoaded', function() {
//     document.querySelectorAll('.btn.btn-primary').forEach(btn => {
//       // Nájdi spoločného parenta (div.p)
//       const productCard = btn.closest('.p');
      
//       if (productCard) {
//         // Nájdi widget-parameter-list v rámci tohto produktu
//         const parameterList = productCard.querySelector('.widget-parameter-list');
        
//         if (parameterList) {
//           // Získaj všetky veľkosti
//           const sizes = Array.from(parameterList.querySelectorAll('li a'))
//             .map(a => a.textContent.trim())
//             .join(', ');
          
//           if (sizes) {
//             btn.textContent = sizes;
//             btn.style.whiteSpace = 'nowrap';
//             btn.style.overflow = 'hidden';
//             btn.style.textOverflow = 'ellipsis';
//           }
//         }
//       }
//     });
//   });
  
  (function() {
    function replaceImages() {
      document.querySelectorAll("img").forEach(img => {
        if (img.src.match(/\/shop\/(detail|related)\//)) {
          img.src = img.src.replace(/\/shop\/(detail|related)\//, "/shop/big/");
        }
        if (img.dataset.src && img.dataset.src.match(/\/shop\/(detail|related)\//)) {
          img.dataset.src = img.dataset.src.replace(/\/shop\/(detail|related)\//, "/shop/big/");
        }
        if (img.dataset.next && img.dataset.next.match(/\/shop\/(detail|related)\//)) {
          img.dataset.next = img.dataset.next.replace(/\/shop\/(detail|related)\//, "/shop/big/");
        }
      });
      console.log("✅ Obrázky prepísané na /shop/big/ (" + window.location.pathname + ")");
    }
  
    document.addEventListener("DOMContentLoaded", replaceImages);
  
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        replaceImages();
      }
    }).observe(document, {subtree: true, childList: true});
  })();

document.addEventListener('DOMContentLoaded', moveSizeUnderPrice);
document.addEventListener('shoptet.content.reloaded', moveSizeUnderPrice);

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    moveSizeUnderPrice();
  }
}).observe(document, {subtree: true, childList: true});

function moveSizeUnderPrice() {
  // všetky produktové karty + detail
  const cards = document.querySelectorAll(
      '.p, .product, .product-card, .product-inner, .box, .product-item, .p-in, .detail, .product-detail'
  );

  cards.forEach(card => {
    let param = card.querySelector(
        '.widget-parameter-wrapper.justified[data-parameter-name="Veľkosť"],' +
        '.widget-parameter-wrapper[data-parameter-name="Veľkosť"]'
    );

    let bottom = card.querySelector('.p-bottom.single-button, .p-bottom, .product__bottom');
    let pricesWrap = card.querySelector('.prices, .product__prices, .detail-info .prices');
    let priceEl = card.querySelector('.price.price-final');

    function placeUnderPrice(el) {
      if (!el) return;

      if (bottom && priceEl && bottom.contains(priceEl)) {
        priceEl.insertAdjacentElement('afterend', el);
      }

      else if (bottom) {
        const innerPrices = bottom.querySelector('.prices') || pricesWrap;
        if (innerPrices) {
          innerPrices.appendChild(el);
        } else {
          bottom.insertAdjacentElement('afterbegin', el);
        }
      }

      else if (pricesWrap) {
        const priceInWrap = pricesWrap.querySelector('.price.price-final') || pricesWrap.firstElementChild;
        if (priceInWrap) {
          priceInWrap.insertAdjacentElement('afterend', el);
        } else {
          pricesWrap.appendChild(el);
        }
      } else {
        const anyPrice = card.querySelector('.price.price-final, .price');
        if (anyPrice) {
          anyPrice.insertAdjacentElement('afterend', el);
        }
      }
    }

    if (param) {
      if (param.classList.contains('moved-under-price')) return;
      placeUnderPrice(param);
      param.classList.add('moved-under-price');
    }

    else {
      if (card.querySelector('.widget-parameter-placeholder')) return; // už tam je
      if (location.href.includes("objednavka")) {
        return;
      }

      const placeholder = document.createElement('div');
      placeholder.className = 'widget-parameter-wrapper moved-under-price justified widget-parameter-placeholder';
      placeholder.setAttribute('data-parameter-name', 'Veľkosť');
      placeholder.setAttribute('data-parameter-id', '5');
      placeholder.setAttribute('data-parameter-single', 'true');

      placeholder.innerHTML = `
    <ul class="widget-parameter-list">
        <li class="widget-parameter-value">
            <a title="Veľkosť: One Size">One Size</a>
        </li>
    </ul>
    <div class="widget-parameter-more no-display">
        <span>+ ďalšie</span>
    </div>
`;
      placeUnderPrice(placeholder);
    }
  });

  (function () {
    const BRAND_COLOR = '#c8a84e';

    function recolorButtons() {
      document.querySelectorAll('.btn-conversion').forEach(btn => {
        btn.style.backgroundColor = BRAND_COLOR;
        btn.style.color = '#000';
        btn.style.border = 'none';
      });
    }

    // pri načítaní stránky
    document.addEventListener('DOMContentLoaded', recolorButtons);

    // sleduje dynamické zmeny (popup / quick view)
    const observer = new MutationObserver(recolorButtons);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  })();

  (function () {
    var bar = document.getElementById('topInfoBar');
    if (!bar) return;

    var key = 'yarmi_top_info_bar_closed_v1';

    // ak už bolo zavreté, skry
    if (localStorage.getItem(key) === '1') {
      bar.classList.add('is-hidden');
      // na mobile vráť header hore (fallback)
      document.documentElement.style.setProperty('--topbar-height', '0px');
      return;
    }

    var btn = bar.querySelector('.top-info-bar__close');
    if (!btn) return;

    btn.addEventListener('click', function () {
      bar.classList.add('is-hidden');
      localStorage.setItem(key, '1');

      // na mobile vráť header hore (fallback)
      document.documentElement.style.setProperty('--topbar-height', '0px');

      // ak chceš, aby sa po X dňoch znovu zobrazil, napíš a doplním expiráciu
    });
  })();

  (function () {
    // NEspúšťaj na checkout (inak si sám prepisuješ ceny)
    if (location.pathname.includes('/objednavka')) return;

    const CHECKOUT_URL = '/objednavka/krok-1/?_=' + Date.now(); // cache-bust

    function normalizePriceText(t){
      return (t || '')
          .replace(/\s+/g, '')
          .replace('€', '')
          .trim();
    }

    async function syncPricesFromCheckout(){
      try{
        const res = await fetch(CHECKOUT_URL, { credentials:'same-origin' });
        if (!res.ok) return;

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // shipping
        document.querySelectorAll('.payment-shipping-price[data-shipping-price-id]').forEach(el=>{
          const id = el.getAttribute('data-shipping-price-id');
          const src = doc.querySelector('.payment-shipping-price[data-shipping-price-id="'+id+'"]');
          if (src) el.textContent = normalizePriceText(src.textContent);
        });

        // billing (dobierka)
        document.querySelectorAll('.payment-shipping-price[data-billing-price-id]').forEach(el=>{
          const id = el.getAttribute('data-billing-price-id');
          const src = doc.querySelector('.payment-shipping-price[data-billing-price-id="'+id+'"]');
          if (src) el.textContent = normalizePriceText(src.textContent);
        });

      } catch(e){}
    }

    document.addEventListener('DOMContentLoaded', syncPricesFromCheckout);
  })();
}

// ──── Podobné produkty pod popisom ────────────────────────────────────────────
function showSimilarProductsBelow() {
  if (document.querySelector('.yarmi-similar-section')) return;

  const altTab = document.querySelector('#productsAlternative');
  if (!altTab) return;

  const products = altTab.querySelectorAll('.p');
  if (!products.length) return;

  // Skry tab "Podobné" v navigácii
  const podobneTabLi = document.querySelector('[data-testid="tabAlternativeProducts"]');
  if (podobneTabLi) podobneTabLi.style.display = 'none';

  // Vytvor sekciu
  const section = document.createElement('section');
  section.className = 'yarmi-similar-section';

  const heading = document.createElement('h2');
  heading.className = 'yarmi-similar-section__title';
  heading.textContent = 'Mohlo by sa vám páčiť';

  const inner = document.createElement('div');
  inner.className = 'container yarmi-similar-inner';
  inner.appendChild(heading);
  inner.appendChild(altTab);
  section.appendChild(inner);

  // Zobraz obsah tabu
  altTab.classList.add('in', 'active');

  // Vlož za .p-detail-tabs-wrapper
  const tabsWrapper = document.querySelector('.p-detail-tabs-wrapper');
  if (tabsWrapper && tabsWrapper.parentElement) {
    tabsWrapper.parentElement.insertBefore(section, tabsWrapper.nextSibling);
  }

  // Nastav top šípok dynamicky podľa stredu fotiek
  requestAnimationFrame(function () {
    const altRect = altTab.getBoundingClientRect();
    const imgRect = altTab.querySelector('.p .image')?.getBoundingClientRect();
    if (altRect && imgRect && altRect.height > 0) {
      const arrowTop = Math.round(imgRect.top - altRect.top + imgRect.height / 2 - 20);
      document.documentElement.style.setProperty('--yarmi-arrow-top', arrowTop + 'px');
    }
  });

  // Počkaj, kým Shoptet inicializuje vlastný carousel, potom ho prevezmeme
  setTimeout(function () { initYarmiSimilarCarousel(altTab); }, 250);
}

// Vlastný carousel pre sekciu "Mohlo by sa vám páčiť"
// Shoptet na mobile skryje produkty 2-5 cez .related-sm-screen-hide – obídeme to
function initYarmiSimilarCarousel(altTab) {
  var productWrappers = Array.from(altTab.querySelectorAll('.product'));
  if (!productWrappers.length) return;

  // Zruš Shoptet mobile obmedzenie
  productWrappers.forEach(function (p) {
    p.classList.remove('related-sm-screen-hide', 'related-sm-screen-show');
  });

  var currentPage = 0;

  function getPerPage() {
    return window.innerWidth >= 992 ? 4 : 2;
  }

  function getTotalPages() {
    return Math.ceil(productWrappers.length / getPerPage());
  }

  function showPage(page) {
    var perPage = getPerPage();
    var total = getTotalPages();
    page = Math.max(0, Math.min(page, total - 1));
    currentPage = page;

    productWrappers.forEach(function (p, i) {
      var visible = i >= page * perPage && i < (page + 1) * perPage;
      p.style.display = visible ? '' : 'none';
      p.classList.toggle('active', visible);
      p.classList.toggle('inactive', !visible);
    });

    var prevBtn = altTab.querySelector('.p-prev');
    var nextBtn = altTab.querySelector('.p-next');
    if (prevBtn) prevBtn.classList.toggle('inactive', page === 0);
    if (nextBtn) nextBtn.classList.toggle('inactive', page >= total - 1);
  }

  // Prevezmeme kliknutia na šípky (capture fáza pred Shoptet delegáciou)
  var prevBtn = altTab.querySelector('.p-prev');
  var nextBtn = altTab.querySelector('.p-next');

  if (prevBtn) {
    prevBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      showPage(currentPage - 1);
    }, true);
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      showPage(currentPage + 1);
    }, true);
  }

  // Pri zmene veľkosti okna prepočítaj
  window.addEventListener('resize', function () {
    showPage(Math.min(currentPage, getTotalPages() - 1));
  });

  // Zobraz prvú stranu
  showPage(0);
}

document.addEventListener('DOMContentLoaded', showSimilarProductsBelow);

// ──── Cookie Consent Banner ───────────────────────────────────────────────────
// Verzia: 1.0 | 2026-03-31
// GDPR súlad: granulárny súhlas, odmietnuť = 1 klik, Google Consent Mode v2
(function() {
  'use strict';

  var CONFIG = {
    storageKey:  'yarmi_cookie_consent',
    version:     '1',
    privacyUrl:  '/ochrana-osobnych-udajov/',
    cookiesUrl:  '/cookies-zasady/',
    defaultChecked: true
  };

  function getConsent() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return null;
      var data = JSON.parse(raw);
      return (data && data.version === CONFIG.version) ? data : null;
    } catch(e) { return null; }
  }

  if (getConsent()) return;

  var css = `
    #yarmi-cookie-overlay{position:fixed!important;inset:0!important;background:rgba(17,17,17,0.55)!important;backdrop-filter:blur(4px)!important;-webkit-backdrop-filter:blur(4px)!important;z-index:999999!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;padding:0 16px 24px!important;animation:yck-overlay-in 0.4s ease forwards!important;}
    @keyframes yck-overlay-in{from{opacity:0}to{opacity:1}}
    #yarmi-cookie-banner{background:#111!important;color:#fff!important;border-radius:16px!important;max-width:760px!important;width:100%!important;padding:36px 40px 32px!important;position:relative!important;overflow:hidden!important;animation:yck-banner-up 0.45s cubic-bezier(0.22,1,0.36,1) forwards!important;box-shadow:0 24px 80px rgba(0,0,0,0.45),0 0 0 1px rgba(200,168,78,0.15)!important;font-family:'Instrument Sans',sans-serif!important;}
    @keyframes yck-banner-up{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}
    #yarmi-cookie-banner::before{content:''!important;position:absolute!important;top:0!important;left:0!important;right:0!important;height:3px!important;background:linear-gradient(90deg,transparent,#c8a84e 30%,#e6c96e 50%,#c8a84e 70%,transparent)!important;}
    #yarmi-cookie-banner::after{content:''!important;position:absolute!important;top:-80px!important;right:-80px!important;width:260px!important;height:260px!important;background:radial-gradient(circle,rgba(200,168,78,0.08) 0%,transparent 70%)!important;pointer-events:none!important;}
    .yck-header{display:flex!important;align-items:flex-start!important;gap:16px!important;margin-bottom:20px!important;}
    .yck-icon{font-size:36px!important;line-height:1!important;flex-shrink:0!important;margin-top:2px!important;filter:drop-shadow(0 2px 8px rgba(200,168,78,0.4))!important;}
    .yck-title{font-family:'Fraunces',serif!important;font-weight:300!important;font-size:26px!important;line-height:1.2!important;color:#fff!important;letter-spacing:-0.02em!important;}
    .yck-title span{color:#c8a84e!important;}
    .yck-subtitle{font-size:13px!important;color:rgba(255,255,255,0.5)!important;margin-top:4px!important;letter-spacing:0.05em!important;text-transform:uppercase!important;}
    .yck-body{font-size:14px!important;line-height:1.65!important;color:rgba(255,255,255,0.72)!important;margin-bottom:28px!important;max-width:580px!important;}
    .yck-body strong{color:#c8a84e!important;font-weight:500!important;}
    .yck-categories{display:none!important;flex-direction:column!important;gap:12px!important;margin-bottom:28px!important;}
    .yck-categories.open{display:flex!important;}
    .yck-cat-item{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:16px!important;background:rgba(255,255,255,0.04)!important;border:1px solid rgba(255,255,255,0.08)!important;border-radius:10px!important;padding:14px 16px!important;transition:border-color 0.2s!important;}
    .yck-cat-item:hover{border-color:rgba(200,168,78,0.25)!important;}
    .yck-cat-info h4{font-size:13px!important;font-weight:600!important;color:#fff!important;margin-bottom:4px!important;}
    .yck-cat-info p{font-size:12px!important;color:rgba(255,255,255,0.5)!important;line-height:1.5!important;}
    .yck-badge{font-size:10px!important;font-weight:600!important;letter-spacing:0.08em!important;text-transform:uppercase!important;color:rgba(200,168,78,0.8)!important;background:rgba(200,168,78,0.1)!important;border:1px solid rgba(200,168,78,0.2)!important;border-radius:4px!important;padding:2px 7px!important;margin-top:4px!important;display:inline-block!important;}
    .yck-toggle{position:relative!important;flex-shrink:0!important;width:44px!important;height:24px!important;margin-top:2px!important;}
    .yck-toggle input{opacity:0!important;width:0!important;height:0!important;position:absolute!important;}
    .yck-toggle-track{position:absolute!important;inset:0!important;border-radius:12px!important;background:rgba(255,255,255,0.12)!important;cursor:pointer!important;transition:background 0.25s!important;}
    .yck-toggle-track::after{content:''!important;position:absolute!important;top:3px!important;left:3px!important;width:18px!important;height:18px!important;border-radius:50%!important;background:rgba(255,255,255,0.4)!important;transition:transform 0.25s,background 0.25s!important;}
    .yck-toggle input:checked+.yck-toggle-track{background:#c8a84e!important;}
    .yck-toggle input:checked+.yck-toggle-track::after{transform:translateX(20px)!important;background:#111!important;}
    .yck-toggle input:disabled+.yck-toggle-track{opacity:0.6!important;cursor:not-allowed!important;}
    .yck-actions{display:flex!important;align-items:center!important;gap:12px!important;flex-wrap:wrap!important;}
    .yck-btn{font-family:'Instrument Sans',sans-serif!important;font-size:13px!important;font-weight:600!important;letter-spacing:0.06em!important;border:none!important;border-radius:8px!important;cursor:pointer!important;padding:13px 26px!important;transition:all 0.2s ease!important;white-space:nowrap!important;}
    .yck-btn-primary{background:#c8a84e!important;color:#111!important;box-shadow:0 4px 20px rgba(200,168,78,0.35)!important;flex:1!important;text-align:center!important;}
    .yck-btn-primary:hover{background:#d4b660!important;box-shadow:0 6px 28px rgba(200,168,78,0.5)!important;transform:translateY(-1px)!important;}
    .yck-btn-secondary{background:transparent!important;color:rgba(255,255,255,0.75)!important;border:1px solid rgba(255,255,255,0.18)!important;}
    .yck-btn-secondary:hover{border-color:rgba(200,168,78,0.5)!important;color:#c8a84e!important;background:rgba(200,168,78,0.05)!important;}
    .yck-btn-reject{background:transparent!important;color:rgba(255,255,255,0.35)!important;border:none!important;padding:13px 8px!important;font-size:12px!important;font-weight:400!important;cursor:pointer!important;font-family:'Instrument Sans',sans-serif!important;text-decoration:underline!important;text-underline-offset:3px!important;transition:color 0.2s!important;}
    .yck-btn-reject:hover{color:rgba(255,255,255,0.6)!important;}
    .yck-footer{margin-top:20px!important;display:flex!important;align-items:center!important;gap:16px!important;}
    .yck-footer a{font-size:11px!important;color:rgba(255,255,255,0.25)!important;text-decoration:none!important;letter-spacing:0.04em!important;transition:color 0.2s!important;}
    .yck-footer a:hover{color:rgba(200,168,78,0.7)!important;}
    .yck-footer span{font-size:11px!important;color:rgba(255,255,255,0.1)!important;}
    @media(max-width:600px){
      #yarmi-cookie-overlay{padding:0!important;}
      #yarmi-cookie-banner{padding:28px 24px 24px!important;border-radius:16px 16px 0 0!important;max-width:100%!important;}
      .yck-title{font-size:22px!important;}
      .yck-actions{flex-direction:column!important;}
      .yck-btn,.yck-btn-reject{width:100%!important;text-align:center!important;}
      .yck-btn-reject{padding:8px!important;}
    }
  `;

  var chk = CONFIG.defaultChecked ? 'checked' : '';
  var html = '<div id="yarmi-cookie-overlay" role="dialog" aria-modal="true" aria-labelledby="yarmi-cck-title">' +
    '<div id="yarmi-cookie-banner">' +
      '<div class="yck-header">' +
        '<div class="yck-icon" aria-hidden="true">\uD83C\uDF6A</div>' +
        '<div>' +
          '<h2 class="yck-title" id="yarmi-cck-title">Trochu <span>sladk\u0161ie</span> nakupovanie?</h2>' +
          '<p class="yck-subtitle">Cookies &amp; Ochrana s\u00fakromia</p>' +
        '</div>' +
      '</div>' +
      '<p class="yck-body">Pou\u017e\u00edvame cookies, aby sme ti uk\u00e1zali <strong>presne to, \u010do \u0165a zau\u00edma</strong> \u2013 spr\u00e1vnu ve\u013ekos\u0165, ob\u013e\u00faben\u00e9 \u0161t\u00faly a akcie u\u0161it\u00e9 na mieru. V\u010faka nim nakupuje\u0161 r\u00fdchlej\u0161ie a pohodlnej\u0161ie. V\u017edy m\u00f4\u017ee\u0161 nastavenie zmeni\u0165.</p>' +
      '<div class="yck-categories" id="yarmi-cookie-prefs">' +
        '<div class="yck-cat-item"><div class="yck-cat-info"><h4>Nevyhnutn\u00e9 cookies</h4><p>Ko\u0161\u00edk, prihl\u00e1senie, zabezpe\u010denie. Bez nich e-shop nefunguje.</p><span class="yck-badge">V\u017edy akt\u00edvne</span></div><label class="yck-toggle"><input type="checkbox" checked disabled><span class="yck-toggle-track"></span></label></div>' +
        '<div class="yck-cat-item"><div class="yck-cat-info"><h4>Analytick\u00e9 cookies</h4><p>Pom\u00e1haj\u00fa n\u00e1m pochopi\u0165, \u010do z\u00e1kazn\u00edkov bav\u00ed, a zlep\u0161ova\u0165 str\u00e1nku.</p></div><label class="yck-toggle"><input type="checkbox" id="yarmi-analytics" ' + chk + '><span class="yck-toggle-track"></span></label></div>' +
        '<div class="yck-cat-item"><div class="yck-cat-info"><h4>Marketingov\u00e9 cookies</h4><p>Zobrazuj\u00fa ti relevantn\u00e9 reklamy a personalizovan\u00fd obsah na in\u00fdch platform\u00e1ch.</p></div><label class="yck-toggle"><input type="checkbox" id="yarmi-marketing" ' + chk + '><span class="yck-toggle-track"></span></label></div>' +
      '</div>' +
      '<div class="yck-actions">' +
        '<button class="yck-btn yck-btn-primary" id="yarmi-cck-accept">\u2728 Prija\u0165 v\u0161etko</button>' +
        '<button class="yck-btn yck-btn-secondary" id="yarmi-cck-manage">Nastavi\u0165</button>' +
        '<button class="yck-btn yck-btn-reject" id="yarmi-cck-reject">Odmietnu\u0165 voli\u0165e\u013en\u00e9</button>' +
      '</div>' +
      '<div class="yck-footer"><a href="' + CONFIG.privacyUrl + '" target="_blank" rel="noopener">Ochrana osobn\u00fdch \u00fadajov</a><span>\u00b7</span><a href="' + CONFIG.cookiesUrl + '" target="_blank" rel="noopener">Z\u00e1sady cookies</a></div>' +
    '</div>' +
  '</div>';

  var styleEl = document.createElement('style');
  styleEl.id = 'yarmi-cookie-css';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  var container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container.firstElementChild);

  var prefsOpen = false;

  document.getElementById('yarmi-cck-accept').addEventListener('click', function() {
    if (prefsOpen) {
      saveConsent({ analytics: document.getElementById('yarmi-analytics').checked, marketing: document.getElementById('yarmi-marketing').checked });
    } else {
      saveConsent({ analytics: true, marketing: true });
    }
    closeOverlay();
  });

  document.getElementById('yarmi-cck-manage').addEventListener('click', function() {
    prefsOpen = !prefsOpen;
    var prefs = document.getElementById('yarmi-cookie-prefs');
    var manageBtn = document.getElementById('yarmi-cck-manage');
    var acceptBtn = document.getElementById('yarmi-cck-accept');
    if (prefsOpen) {
      prefs.classList.add('open');
      manageBtn.textContent = 'Zavrie\u0165';
      acceptBtn.textContent = '\u2714 Ulo\u017ei\u0165 v\u00fdber';
    } else {
      prefs.classList.remove('open');
      manageBtn.textContent = 'Nastavi\u0165';
      acceptBtn.textContent = '\u2728 Prija\u0165 v\u0161etko';
    }
  });

  document.getElementById('yarmi-cck-reject').addEventListener('click', function() {
    saveConsent({ analytics: false, marketing: false });
    closeOverlay();
  });

  function saveConsent(prefs) {
    var data = { version: CONFIG.version, timestamp: new Date().toISOString(), necessary: true, analytics: !!prefs.analytics, marketing: !!prefs.marketing };
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(data)); } catch(e) {}
    if (window.gtag) { window.gtag('consent', 'update', { analytics_storage: data.analytics ? 'granted' : 'denied', ad_storage: data.marketing ? 'granted' : 'denied', ad_user_data: data.marketing ? 'granted' : 'denied', ad_personalization: data.marketing ? 'granted' : 'denied' }); }
    if (window.dataLayer) { window.dataLayer.push({ event: 'cookie_consent_update', analytics_storage: data.analytics ? 'granted' : 'denied', ad_storage: data.marketing ? 'granted' : 'denied' }); }
  }

  function closeOverlay() {
    var overlay = document.getElementById('yarmi-cookie-overlay');
    overlay.style.transition = 'opacity 0.3s ease';
    overlay.style.opacity = '0';
    setTimeout(function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      var s = document.getElementById('yarmi-cookie-css');
      if (s) s.parentNode.removeChild(s);
    }, 320);
  }
})();
