// clone-theme — interações do storefront
// (1) Custom dropdown nos cards (variant picker com mini imagem)
// (2) Swatches no PDP (legacy, mantém pra compat)
(function () {
  'use strict';

  // === (1) Custom variant dropdown nos cards (bulk picker) ===
  document.addEventListener('click', function (e) {
    // Abrir/fechar dropdown
    var toggle = e.target.closest('[data-pick-toggle]');
    if (toggle) {
      e.preventDefault();
      var wrap = toggle.closest('[data-bulk-pick-wrap]');
      if (!wrap) return;
      var options = wrap.querySelector('[data-pick-options]');
      var willOpen = options.hidden;
      // Fecha todos
      document.querySelectorAll('[data-pick-options]').forEach(function (o) { o.hidden = true; });
      if (willOpen) options.hidden = false;
      return;
    }
    // Selecionar option
    var opt = e.target.closest('[data-pick-option]');
    if (opt) {
      e.preventDefault();
      var wrapO = opt.closest('[data-bulk-pick-wrap]');
      if (!wrapO) return;
      var hidden = wrapO.querySelector('[data-bulk-pick]');
      var currentLabel = wrapO.querySelector('[data-pick-current-label]');
      var currentImg = wrapO.querySelector('[data-pick-current-img]');
      if (hidden) hidden.value = opt.getAttribute('data-value');
      if (currentLabel) currentLabel.textContent = opt.getAttribute('data-label');
      if (currentImg) currentImg.src = opt.getAttribute('data-img');
      var optsList = wrapO.querySelector('[data-pick-options]');
      if (optsList) optsList.hidden = true;
      return;
    }
    // Click fora: fecha todos
    if (!e.target.closest('[data-bulk-pick-wrap]')) {
      document.querySelectorAll('[data-pick-options]').forEach(function (o) { o.hidden = true; });
    }
  });

  // === (2) Legacy swatches no PDP — kept pra retrocompat ===
  document.addEventListener('click', function (e) {
    var swatch = e.target.closest('.clone-grid__swatch');
    if (!swatch) return;

    e.preventDefault();

    var card = swatch.closest('.clone-grid__card');
    if (!card) return;

    // Active state: limpa outros swatches do mesmo card, ativa o clicado
    card.querySelectorAll('.clone-grid__swatch').forEach(function (s) {
      s.classList.remove('is-active');
    });
    swatch.classList.add('is-active');

    // Atualiza o variant-id no form do card (Add to cart)
    var variantId = swatch.getAttribute('data-variant-id');
    if (variantId) {
      var input = card.querySelector('.clone-grid__form input[name="id"]');
      if (input) input.value = variantId;
    }

    // Atualiza preço
    var newPrice = swatch.getAttribute('data-price');
    if (newPrice) {
      var priceStrong = card.querySelector('.clone-grid__price strong');
      if (priceStrong) priceStrong.textContent = newPrice;
    }

    // Atualiza compare-at (preço cortado) — mostra ou esconde
    var compare = swatch.getAttribute('data-compare-price');
    var compareEl = card.querySelector('.clone-grid__price-compare');
    if (compareEl) {
      if (compare && compare.trim() !== '') {
        compareEl.textContent = compare;
        compareEl.style.display = '';
      } else {
        compareEl.style.display = 'none';
      }
    }

    // Atualiza imagem (primary — secondary é a do hover, fica intocada)
    var newImage = swatch.getAttribute('data-image');
    if (newImage) {
      var img = card.querySelector('.clone-grid__img--primary')
             || card.querySelector('.clone-grid__media img');
      if (img) img.src = newImage;
    }

    // Atualiza BOGO sub-line se houver
    var bogoSub = card.querySelector('.clone-grid__bogo-sub');
    if (bogoSub && newPrice) {
      // bogoSub format: "(Just $X.XX each)"
      var priceNum = parseFloat(newPrice.replace(/[^0-9.,]/g, '').replace(',', '.'));
      if (!isNaN(priceNum)) {
        var each = (priceNum / 2).toFixed(2);
        var prefix = newPrice.match(/^[^\d]+/);
        var currency = prefix ? prefix[0] : '$';
        bogoSub.textContent = '(Just ' + currency + each + ' each)';
      }
    }
  });
})();
