// clone-theme — storefront interactions
// 1) Swatch picker: clique nos swatches (color pills) muda variant + preço + imagem

(function () {
  function updateSwatchSelection(swatch) {
    var card = swatch.closest('.clone-grid__card');
    if (!card) return;

    // Active state
    card.querySelectorAll('.clone-grid__swatch').forEach(function (s) {
      s.classList.remove('is-active');
    });
    swatch.classList.add('is-active');

    // Update form variant.id
    var form = card.querySelector('.clone-grid__form');
    var idInput = form && form.querySelector('input[name="id"]');
    if (idInput && swatch.dataset.variantId) {
      idInput.value = swatch.dataset.variantId;
    }

    // Update price
    var priceEl = card.querySelector('.clone-grid__price strong');
    if (priceEl && swatch.dataset.price) {
      priceEl.textContent = swatch.dataset.price;
    }

    // Update compare-at price
    var compareEl = card.querySelector('.clone-grid__price-compare');
    if (compareEl) {
      var cp = swatch.dataset.comparePrice;
      if (cp) {
        compareEl.textContent = cp;
        compareEl.style.display = '';
      } else {
        compareEl.style.display = 'none';
      }
    }

    // Update product image
    var imgEl = card.querySelector('.clone-grid__media img');
    if (imgEl && swatch.dataset.image) {
      imgEl.src = swatch.dataset.image;
      imgEl.srcset = '';
    }
  }

  document.addEventListener('click', function (e) {
    var swatch = e.target.closest && e.target.closest('.clone-grid__swatch');
    if (!swatch) return;
    e.preventDefault();
    updateSwatchSelection(swatch);
  });
})();
