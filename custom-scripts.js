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
