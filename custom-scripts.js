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



/* ─────────────────────────────────────────────────────────────
   Mobile sort toggle – injects icon button, toggles dropdown
   feature/filter-breadcrumb-redesign
   ───────────────────────────────────────────────────────────── */
(function () {
    function initMobileSortToggle() {
        // Only on mobile
        if (window.innerWidth > 768) return;

        var listSorting = document.querySelector('.listSorting.js-listSorting');
        if (!listSorting) return;

        // Avoid double-init
        if (listSorting.querySelector('.yarmi-sort-toggle')) return;

        var controls = listSorting.querySelector('.listSorting__controls');
        if (!controls) return;

        // Create toggle icon button (sort/funnel SVG icon)
        var toggleBtn = document.createElement('button');
        toggleBtn.className = 'yarmi-sort-toggle';
        toggleBtn.setAttribute('aria-label', 'Radenie produktov');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18M6 12h12M10 19h4"/></svg>';

        // Insert toggle before controls list
        listSorting.insertBefore(toggleBtn, controls);

        // Toggle open/close
        toggleBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var isOpen = listSorting.classList.toggle('yarmi-sort-open');
            toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        // Close when a sort option is clicked (navigates away, but good UX)
        controls.querySelectorAll('.listSorting__control').forEach(function (btn) {
            btn.addEventListener('click', function () {
                listSorting.classList.remove('yarmi-sort-open');
                toggleBtn.setAttribute('aria-expanded', 'false');
            });
        });

        // Close when clicking outside
        document.addEventListener('click', function (e) {
            if (!listSorting.contains(e.target)) {
                listSorting.classList.remove('yarmi-sort-open');
                toggleBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileSortToggle);
    } else {
        initMobileSortToggle();
    }
})();
