/**
 * yarmi-rebuild.js
 * Replaces Shoptet's default homepage HTML with a fully custom design.
 * All product/banner data is extracted from Shoptet's rendered DOM.
 */
(function () {
  'use strict';

  /* ── Config: static text & category links ──────────────────────────────── */
  var CFG = {
    hero: {
      eyebrow: 'Jar / Leto 2026',
      title: 'Elegancia<br>v každom <em>detaile</em>',
      desc: 'Objavte novú kolekciu dámskej módy inšpirovanej jemnosťou a nadčasovým štýlom.',
      cta1: { text: 'Nová kolekcia', href: '/kabaty/' },
      cta2: { text: 'Výpredaj',      href: '/vypredaj/' }
    },
    categories: [
      {
        name: 'Kabáty',
        href: '/kabaty/',
        img: 'https://cdn.myshoptet.com/usr/www.yarmi.sk/user/shop/big/62-3_damsky-kratky-bezovy-kabat-na-jar-a-jesen.jpg?69831738'
      },
      {
        name: 'Šaty',
        href: '/saty/',
        img: 'https://cdn.myshoptet.com/usr/www.yarmi.sk/user/shop/big/273_damske-saty-cream-chic.jpg?69831738'
      },
      {
        name: 'Súpravy',
        href: '/supravy/',
        img: 'https://cdn.myshoptet.com/usr/www.yarmi.sk/user/shop/big/122_damska-zamatova-suprava-wine-casual.jpg?69831738'
      },
      {
        name: 'Svetre & Šaty',
        href: '/svetre/',
        img: 'https://cdn.myshoptet.com/usr/www.yarmi.sk/user/shop/big/285_damske-svetrove-bezove-saty.jpg?69831738'
      }
    ],
    brandImgs: [
      'https://cdn.myshoptet.com/usr/www.yarmi.sk/user/shop/big/65-3_damsky-kratky-cierny-kabat-na-jar-a-jesen.jpg?69831738',
      'https://cdn.myshoptet.com/usr/www.yarmi.sk/user/shop/big/128_hneda-teplakova-suprava.jpg?69831738',
      'https://cdn.myshoptet.com/usr/www.yarmi.sk/user/shop/big/125_damska-bezova-teplakova-suprava.jpg?69831738'
    ],
    aboutUrl:       '/o-nas/',
    allProductsUrl: '/kabaty/',
    lookbookUrl:    '/vypredaj/'
  };

  /* ── Helpers ────────────────────────────────────────────────────────────── */
  function qs(sel, ctx)  { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function esc(str)      { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ── Data extraction ────────────────────────────────────────────────────── */
  function extractHeroImage() {
    var img = qs('.banners-row img');
    return img ? (img.src || img.dataset.src || '') : '';
  }

  function extractBenefitItems() {
    return qsa('.benefitBanner__item').map(function (el) {
      return {
        img:   qs('img', el) ? qs('img', el).src : '',
        title: qs('.benefitBanner__title', el) ? qs('.benefitBanner__title', el).textContent.trim() : '',
        text:  qs('.benefitBanner__data', el)  ? qs('.benefitBanner__data', el).textContent.trim()  : ''
      };
    });
  }

  function extractProducts() {
    var tabs = qsa('.shp-tabs a').map(function (a) {
      return {
        id:    (a.dataset.target || a.getAttribute('href') || '').replace('#', ''),
        label: a.textContent.trim()
      };
    });

    var products = qsa('.swiper-slide.product').map(function (slide, idx) {
      var tabPane  = slide.closest('[id^="homepageProducts"]');
      var imgs     = qsa('img.swap-image', slide);
      var priceStd = qs('.price-standard', slide);
      var priceFin = qs('.price-final', slide) || qs('.price', slide);
      var priceSav = qs('.price-save', slide);
      var nameEl   = qs('a.name', slide);
      var linkEl   = qs('a.image', slide);

      var priceOld   = priceStd ? priceStd.textContent.trim() : '';
      var priceFinal = priceFin ? priceFin.textContent.trim() : '';
      var priceSave  = priceSav ? priceSav.textContent.trim() : '';
      var isSale     = !!priceOld && priceOld !== priceFinal;

      return {
        idx:        idx,
        tabId:      tabPane ? tabPane.id : '',
        url:        linkEl  ? linkEl.href : '#',
        imgMain:    imgs[0] ? (imgs[0].src || imgs[0].dataset.src || '') : '',
        imgHover:   imgs[1] ? (imgs[1].src || imgs[1].dataset.src || '') : (imgs[0] ? imgs[0].src : ''),
        name:       nameEl  ? nameEl.textContent.trim() : '',
        priceOld:   priceOld,
        priceFinal: priceFinal,
        priceSave:  priceSave,
        isSale:     isSale,
        sizes:      qsa('.widget-parameter-value', slide).map(function (s) { return s.textContent.trim(); })
      };
    });

    return { tabs: tabs, products: products };
  }

  function extractWelcome() {
    var w = qs('.yarmi-welcome');
    if (!w) return null;
    var intro   = qs('.yarmi-welcome__intro', w);
    var slogans = intro ? qsa('h2.yarmi-welcome__slogan', intro) : [];
    var titleDiv = intro ? qs('div.yarmi-welcome__text', intro) : null;
    var bodyDiv  = qs('.yarmi-welcome__inner > .yarmi-welcome__text', w);
    return {
      eyebrow:  slogans[0] ? slogans[0].textContent.trim() : '',
      title:    titleDiv   ? titleDiv.textContent.trim()   : '',
      tagline:  slogans[1] ? slogans[1].textContent.trim() : '',
      bodyHTML: bodyDiv    ? bodyDiv.innerHTML              : ''
    };
  }

  /* ── Render helpers ─────────────────────────────────────────────────────── */
  function renderPrice(p) {
    if (p.isSale && p.priceOld) {
      return '<span class="yr-price-old">' + esc(p.priceOld) + '</span>'
           + esc(p.priceFinal)
           + (p.priceSave ? ' <span class="yr-badge-sale">' + esc(p.priceSave) + '</span>' : '');
    }
    return esc(p.priceFinal);
  }

  function renderSizes(sizes) {
    if (!sizes || !sizes.length) return '';
    return '<div class="yr-sizes">'
      + sizes.map(function (s) { return '<span class="yr-size">' + esc(s) + '</span>'; }).join('')
      + '</div>';
  }

  function renderProductCard(p) {
    var hasHover = p.imgHover && p.imgHover !== p.imgMain;
    return '<a class="yr-card" href="' + esc(p.url) + '" data-idx="' + p.idx + '">'
      + '<div class="yr-card-img">'
      + '<img src="' + esc(p.imgMain) + '" alt="' + esc(p.name) + '" loading="lazy"'
      + (hasHover ? ' data-hover="' + esc(p.imgHover) + '"' : '') + '>'
      + (p.isSale ? '<span class="yr-badge yr-badge--sale">' + esc(p.priceSave || 'SALE') + '</span>' : '')
      + '<div class="yr-card-actions"><span class="yr-card-cta">Zobraziť detail</span></div>'
      + '</div>'
      + '<div class="yr-card-info">'
      + '<div class="yr-card-name">' + esc(p.name) + '</div>'
      + renderSizes(p.sizes)
      + '<div class="yr-card-price">' + renderPrice(p) + '</div>'
      + '</div>'
      + '</a>';
  }

  /* ── Section builders ───────────────────────────────────────────────────── */
  function buildHero(heroImg) {
    return '<section class="yr-hero">'
      + '<img src="' + esc(heroImg) + '" alt="Yarmi kolekcia">'
      + '<div class="yr-hero-overlay"></div>'
      + '<div class="yr-hero-content">'
      + '<p class="yr-hero-eyebrow">' + CFG.hero.eyebrow + '</p>'
      + '<h1 class="yr-hero-title">' + CFG.hero.title + '</h1>'
      + '<p class="yr-hero-desc">' + CFG.hero.desc + '</p>'
      + '<div class="yr-hero-btns">'
      + '<a href="' + CFG.hero.cta1.href + '" class="yr-btn-primary">' + CFG.hero.cta1.text + '</a>'
      + '<a href="' + CFG.hero.cta2.href + '" class="yr-btn-outline yr-btn-outline--white">' + CFG.hero.cta2.text + '</a>'
      + '</div>'
      + '</div>'
      + '</section>';
  }

  function buildBenefitStrip(items) {
    var cols = Math.min(items.length, 4);
    var html = '<div class="yr-benefits yr-benefits--' + cols + '">';
    items.slice(0, cols).forEach(function (item) {
      html += '<div class="yr-benefit">'
        + '<div class="yr-benefit-icon"><img src="' + esc(item.img) + '" alt="' + esc(item.title) + '"></div>'
        + '<div class="yr-benefit-text"><strong>' + esc(item.title) + '</strong><span>' + esc(item.text) + '</span></div>'
        + '</div>';
    });
    html += '</div>';
    return html;
  }

  function buildCategories() {
    var html = '<section class="yr-categories">'
      + '<div class="yr-container">'
      + '<div class="yr-section-hd">'
      + '<p class="yr-eyebrow">Nakupovať podľa kategórie</p>'
      + '<h2 class="yr-section-title">Váš štýl, <em>vaše pravidlá</em></h2>'
      + '<div class="yr-divider"></div>'
      + '</div></div>'
      + '<div class="yr-cat-grid">';
    CFG.categories.forEach(function (cat) {
      html += '<a class="yr-cat-card" href="' + cat.href + '">'
        + '<img src="' + cat.img + '" alt="' + esc(cat.name) + '" loading="lazy">'
        + '<div class="yr-cat-overlay"></div>'
        + '<div class="yr-cat-label">'
        + '<div class="yr-cat-name">' + esc(cat.name) + '</div>'
        + '<div class="yr-cat-link">Zobraziť</div>'
        + '</div>'
        + '</a>';
    });
    html += '</div></section>';
    return html;
  }

  function buildProducts(data) {
    var tabs = data.tabs;
    var products = data.products;

    // Tab navigation
    var tabsNav = '<div class="yr-tabs-nav">'
      + tabs.map(function (tab, i) {
          return '<button class="yr-tab' + (i === 0 ? ' yr-tab--active' : '') + '" data-tab="' + tab.id + '">'
            + esc(tab.label) + '</button>';
        }).join('')
      + '</div>';

    // Tab panes
    var panes = tabs.map(function (tab, i) {
      var tabProds = products.filter(function (p) { return p.tabId === tab.id; });
      return '<div class="yr-tab-pane' + (i === 0 ? ' yr-tab-pane--active' : '') + '" id="yr-pane-' + tab.id + '">'
        + '<div class="yr-products-grid">'
        + tabProds.map(renderProductCard).join('')
        + '</div></div>';
    }).join('');

    return '<section class="yr-products">'
      + '<div class="yr-container">'
      + '<div class="yr-section-hd">'
      + '<p class="yr-eyebrow">Zákazníčky milujú</p>'
      + '<h2 class="yr-section-title">Najpredávanejšie <em>kúsky</em></h2>'
      + '<div class="yr-divider"></div>'
      + '</div>'
      + tabsNav
      + '</div>'
      + panes
      + '<div class="yr-products-more">'
      + '<a href="' + CFG.allProductsUrl + '" class="yr-btn-outline">Zobraziť všetky produkty</a>'
      + '</div>'
      + '</section>';
  }

  function buildBrandStory(welcome) {
    var eyebrow = (welcome && welcome.eyebrow) ? welcome.eyebrow : 'O nás';
    var title   = (welcome && welcome.title)   ? welcome.title   : 'Móda, ktorá hovorí za vás';
    var tagline = (welcome && welcome.tagline) ? welcome.tagline : '';
    var body    = (welcome && welcome.bodyHTML) ? welcome.bodyHTML : '';

    return '<section class="yr-brand">'
      + '<div class="yr-brand-inner">'
      + '<div class="yr-brand-imgs">'
      + '<div class="yr-brand-img-main"><img src="' + CFG.brandImgs[0] + '" alt="" loading="lazy"></div>'
      + '<div class="yr-brand-img-s1"><img src="' + CFG.brandImgs[1] + '" alt="" loading="lazy"></div>'
      + '<div class="yr-brand-img-s2"><img src="' + CFG.brandImgs[2] + '" alt="" loading="lazy"></div>'
      + '</div>'
      + '<div class="yr-brand-text">'
      + '<div class="yr-section-hd yr-section-hd--left">'
      + '<p class="yr-eyebrow">' + esc(eyebrow) + '</p>'
      + '<h2 class="yr-section-title">' + esc(title) + '</h2>'
      + '<div class="yr-divider yr-divider--left"></div>'
      + '</div>'
      + '<div class="yr-brand-body">' + body + '</div>'
      + (tagline ? '<p class="yr-brand-tagline">' + esc(tagline) + '</p>' : '')
      + '<div class="yr-brand-values">'
      + '<div class="yr-brand-val"><span class="yr-val-num">500+</span><span class="yr-val-lbl">produktov</span></div>'
      + '<div class="yr-brand-val"><span class="yr-val-num">4,9★</span><span class="yr-val-lbl">hodnotenie</span></div>'
      + '<div class="yr-brand-val"><span class="yr-val-num">3 000+</span><span class="yr-val-lbl">zákazníčok</span></div>'
      + '</div>'
      + '<a href="' + CFG.aboutUrl + '" class="yr-btn-primary yr-btn-primary--mt">Spoznajte nás</a>'
      + '</div>'
      + '</div>'
      + '</section>';
  }

  function buildLookbook(heroImg) {
    return '<section class="yr-lookbook">'
      + '<img src="' + esc(heroImg) + '" alt="Yarmi výpredaj" loading="lazy">'
      + '<div class="yr-lookbook-overlay">'
      + '<p class="yr-eyebrow yr-eyebrow--gold">Jar 2026</p>'
      + '<h2 class="yr-lookbook-title">Výpredaj až<br><em>−40 %</em> na vybranú kolekciu</h2>'
      + '<a href="' + CFG.lookbookUrl + '" class="yr-btn-primary">Zobraziť výpredaj</a>'
      + '</div>'
      + '</section>';
  }

  function buildNewsletter() {
    return '<section class="yr-newsletter">'
      + '<div class="yr-newsletter-inner">'
      + '<p class="yr-eyebrow">Buďte prvé</p>'
      + '<h2 class="yr-newsletter-title">Novinky priamo <em>do vašej</em> schránky</h2>'
      + '<p class="yr-newsletter-desc">Prihláste sa k odberu a dostávajte ako prvé informácie o nových kolekciách, výpredajoch a špeciálnych ponukách.</p>'
      + '<form class="yr-newsletter-form" action="/newsletter/prihlasenie/" method="post">'
      + '<input type="email" name="email" placeholder="Váš e-mail" required>'
      + '<button type="submit">Prihlásiť</button>'
      + '</form>'
      + '</div>'
      + '</section>';
  }

  /* ── Image hover interaction ────────────────────────────────────────────── */
  function initHover() {
    document.addEventListener('mouseover', function (e) {
      var card = e.target.closest && e.target.closest('.yr-card');
      if (!card) return;
      var img = qs('.yr-card-img img', card);
      if (img && img.dataset.hover) {
        if (!img._orig) img._orig = img.src;
        img.src = img.dataset.hover;
      }
    });
    document.addEventListener('mouseout', function (e) {
      var card = e.target.closest && e.target.closest('.yr-card');
      if (!card) return;
      var img = qs('.yr-card-img img', card);
      if (img && img._orig) img.src = img._orig;
    });
  }

  /* ── Tab switching ──────────────────────────────────────────────────────── */
  function initTabs() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.yr-tab');
      if (!btn) return;
      var tabId = btn.dataset.tab;
      qsa('.yr-tab').forEach(function (b) {
        b.classList.toggle('yr-tab--active', b === btn);
      });
      qsa('.yr-tab-pane').forEach(function (p) {
        p.classList.toggle('yr-tab-pane--active', p.id === 'yr-pane-' + tabId);
      });
    });
  }

  /* ── Main rebuild ───────────────────────────────────────────────────────── */
  function rebuild() {
    // Run only on homepage
    if (!qs('.index-content-wrapper')) return;

    // Extract Shoptet data
    var heroImg  = extractHeroImage();
    var benefits = extractBenefitItems();
    var prodData = extractProducts();
    var welcome  = extractWelcome();

    // Build HTML
    var html = [
      buildHero(heroImg),
      buildBenefitStrip(benefits),
      buildCategories(),
      buildProducts(prodData),
      buildBrandStory(welcome),
      buildLookbook(heroImg),
      buildNewsletter()
    ].join('\n');

    // Create wrapper and insert before Shoptet hero
    var wrapper = document.createElement('div');
    wrapper.id = 'yr-hp';
    wrapper.innerHTML = html;

    var heroRow = qs('.banners-row');
    if (heroRow && heroRow.parentNode) {
      heroRow.parentNode.insertBefore(wrapper, heroRow);
    } else {
      var footer = qs('#footer, footer, .footer');
      if (footer) document.body.insertBefore(wrapper, footer);
      else document.body.appendChild(wrapper);
    }

    // Hide Shoptet original sections
    ['.banners-row', '.container--bannersBenefit', '.index-content-wrapper'].forEach(function (sel) {
      var el = qs(sel);
      if (el) el.setAttribute('hidden', '');
    });

    // Interactions
    initHover();
    initTabs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rebuild);
  } else {
    rebuild();
  }

}());
