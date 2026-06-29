/**
 * Lever — Jersey Mockup
 * Renderiza nome+número live no overlay da camisa (snippet jersey-mockup-overlay).
 * Move o overlay pra dentro do PRIMEIRO <li class="product__media-item"> no init —
 * assim ele herda position e dimensões corretas do slide nativo.
 */
(function () {
  if (window.__leverJerseyMockupBound) return;
  window.__leverJerseyMockupBound = true;

  const SEL = {
    overlay: '[data-jersey-mockup-overlay]',
    nameBox: '[data-jersey-name]',
    numberBox: '[data-jersey-number]',
    nameInput: '#campo-personalizacao',
    numberInput: '#personalizar-numero',
    toggleSelected: 'input[value="Personalizar"]:checked',
    toggleAny: 'input[value="Personalizar"], input[value="Não Personalizar"]',
    firstSlide: '.product__media-list .product__media-item',
  };

  function isActive() {
    return !!document.querySelector(SEL.toggleSelected);
  }

  function fitTextToBox(el) {
    if (!el || !el.textContent) return;
    const box = el.getBoundingClientRect();
    if (box.height < 4 || box.width < 4) return;
    let size = box.height;
    el.style.fontSize = size + 'px';
    let guard = 60;
    while (el.scrollWidth > box.width + 1 && size > 6 && guard-- > 0) {
      size *= 0.95;
      el.style.fontSize = size + 'px';
    }
  }

  /** Move overlay pra dentro do primeiro slide pra herdar positioning correto. */
  function repositionOverlay() {
    const overlay = document.querySelector(SEL.overlay);
    if (!overlay) return;
    const firstSlide = document.querySelector(SEL.firstSlide);
    if (!firstSlide) return;
    if (overlay.parentElement !== firstSlide) {
      firstSlide.insertBefore(overlay, firstSlide.firstChild);
    }
  }

  function update() {
    repositionOverlay();
    const overlay = document.querySelector(SEL.overlay);
    if (!overlay) return;

    const active = isActive();
    overlay.setAttribute('data-jersey-active', active ? '1' : '0');
    overlay.setAttribute('aria-hidden', active ? 'false' : 'true');
    if (!active) return;

    const nameInput = document.querySelector(SEL.nameInput);
    const numberInput = document.querySelector(SEL.numberInput);
    const nameBox = overlay.querySelector(SEL.nameBox);
    const numberBox = overlay.querySelector(SEL.numberBox);

    if (nameInput && nameBox) {
      const cleaned = nameInput.value.replace(/[^A-Za-zÀ-ÿ ]/g, '').slice(0, 13);
      if (cleaned !== nameInput.value) nameInput.value = cleaned;
      nameBox.textContent = cleaned.toUpperCase();
    }
    if (numberInput && numberBox) {
      const cleaned = numberInput.value.replace(/\D/g, '').slice(0, 3);
      if (cleaned !== numberInput.value) numberInput.value = cleaned;
      numberBox.textContent = cleaned;
    }

    requestAnimationFrame(() => {
      if (nameBox) fitTextToBox(nameBox);
      if (numberBox) fitTextToBox(numberBox);
    });
  }

  function bind() {
    document.addEventListener('input', function (e) {
      if (!e.target || !e.target.matches) return;
      if (e.target.matches(SEL.nameInput) || e.target.matches(SEL.numberInput)) {
        update();
      }
    });
    document.addEventListener('change', function (e) {
      if (!e.target || !e.target.matches) return;
      if (e.target.matches(SEL.toggleAny)) {
        setTimeout(update, 50);
      }
    });
    window.addEventListener('resize', update);
  }

  function init() {
    bind();
    repositionOverlay();
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('product-info:loaded', function () {
    setTimeout(function () {
      repositionOverlay();
      update();
    }, 80);
  });
})();
