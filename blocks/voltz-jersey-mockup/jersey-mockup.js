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

  /**
   * Renderiza o nome com parábola via SVG textPath.
   * curvePct = 0..100 (0 = reto · 100 = afundamento máximo no meio).
   * Endpoints amarrados em y=4, control point desce até y=4+(curvePct/100)*16.
   */
  function renderNameCurved(nameBox, text, curvePct) {
    const yEnd = 4;
    const yMid = yEnd + (curvePct / 100) * 16;
    const box = nameBox.getBoundingClientRect();
    // Estima font-size pra caber: 14 unidades SVG ≈ 70% da altura do viewBox=20
    // Auto-shrink pelo length do texto
    let fontSize = 14;
    const len = text.length;
    if (len > 8) fontSize = Math.max(8, 14 - (len - 8) * 0.7);
    nameBox.innerHTML = '<svg class="jersey-mockup-overlay__name-svg" viewBox="0 0 100 20" preserveAspectRatio="none">'
      + '<path id="jerseyNamePath" d="M 0 ' + yEnd + ' Q 50 ' + yMid + ' 100 ' + yEnd + '" fill="none"/>'
      + '<text font-size="' + fontSize + '" text-anchor="middle">'
      + '<textPath href="#jerseyNamePath" startOffset="50%">' + escapeXml(text) + '</textPath>'
      + '</text>'
      + '</svg>';
  }

  function escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

    const curvePct = parseInt(overlay.getAttribute('data-jersey-curve') || '0', 10);

    if (nameInput && nameBox) {
      const cleaned = nameInput.value.replace(/[^A-Za-zÀ-ÿ ]/g, '').slice(0, 13);
      if (cleaned !== nameInput.value) nameInput.value = cleaned;
      const upper = cleaned.toUpperCase();
      if (curvePct > 0) {
        renderNameCurved(nameBox, upper, curvePct);
      } else {
        nameBox.textContent = upper;
      }
    }
    if (numberInput && numberBox) {
      const cleaned = numberInput.value.replace(/\D/g, '').slice(0, 3);
      if (cleaned !== numberInput.value) numberInput.value = cleaned;
      numberBox.textContent = cleaned;
    }

    requestAnimationFrame(() => {
      // fitTextToBox só pra modo reto — em modo curva, o SVG controla
      if (nameBox && curvePct === 0) fitTextToBox(nameBox);
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
