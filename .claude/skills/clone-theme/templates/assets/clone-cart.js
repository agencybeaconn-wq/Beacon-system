// clone-theme — Cart Drawer
// Intercepta Add to cart, faz Ajax pra Shopify Cart API, atualiza UI do drawer.
// BOGO: pague 1 leve 2 — visual no drawer, real via discount automático/code do Shopify.
(function () {
  'use strict';

  var DRAWER_ID = 'CloneCartDrawer';
  var ITEM_TPL_ID = 'CloneCartItemTemplate';
  var BOGO_DISCOUNT_CODE = window.CLONE_BOGO_CODE || '';
  var BOGO_LABEL = window.CLONE_BOGO_LABEL || "MOTHER'S DAY BOGO";
  var SHIPPING_VARIANT = window.CLONE_SHIPPING_VARIANT_ID || null;
  var SHIPPING_PRICE_CENTS = 499; // $4.99 default — sobrescrito pelo variant.price quando disponível

  var drawer, itemsList, emptyMsg, countEl, totalEl, discountsBlock, discountAmountEl, discountLabelEl, shippingToggle;
  var upsellSection, upsellTrack;
  var upsellCacheBySeed = {}; // memoize por seed handle (invalida quando produto seed muda)
  var productCache = {}; // cache por handle: { variantId: compare_at_price }
  var moneyFormat = window.CLONE_MONEY_FORMAT || '${{amount}}';

  function fetchProductCompares(handle) {
    if (productCache[handle]) return Promise.resolve(productCache[handle]);
    return fetch('/products/' + handle + '.js', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (p) {
        var map = {};
        (p.variants || []).forEach(function (v) { map[String(v.id)] = v.compare_at_price; });
        productCache[handle] = map;
        return map;
      }).catch(function () { return {}; });
  }

  function formatMoney(cents) {
    var dollars = (cents / 100);
    var formatted = dollars.toFixed(2);
    return moneyFormat.replace(/\{\{\s*amount[a-zA-Z_]*\s*\}\}/g, formatted);
  }

  function getEl() {
    drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return false;
    itemsList = drawer.querySelector('[data-cart-items]');
    emptyMsg = drawer.querySelector('[data-cart-empty]');
    countEl = drawer.querySelector('[data-cart-count]');
    totalEl = drawer.querySelector('[data-cart-total]');
    discountsBlock = drawer.querySelector('[data-cart-discounts]');
    discountAmountEl = drawer.querySelector('[data-discount-amount]');
    discountLabelEl = drawer.querySelector('[data-discount-label]');
    shippingToggle = drawer.querySelector('[data-shipping-toggle]');
    upsellSection = drawer.querySelector('[data-cart-upsell]');
    upsellTrack = drawer.querySelector('[data-upsell-track]');
    return true;
  }

  // === Upsell ===
  function fetchRecommendations(productId, limit) {
    var url = '/recommendations/products.json?product_id=' + encodeURIComponent(productId)
            + '&limit=' + (limit || 8)
            + '&intent=complementary';
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) { return (j && j.products) || []; })
      .catch(function () { return []; });
  }

  function fetchFallbackProducts(limit) {
    // Fallback 1: /products.json (sempre retorna produtos da loja)
    return fetch('/products.json?limit=' + (limit || 12), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) { return (j && j.products) || []; })
      .catch(function () {
        // Fallback 2: search.json se /products.json falhar
        return fetch('/search/suggest.json?q=watch&resources[type]=product&resources[limit]=' + (limit || 8), { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            return (j && j.resources && j.resources.results && j.resources.results.products) || [];
          })
          .catch(function () { return []; });
      });
  }

  function renderUpsellCard(product) {
    var tpl = document.getElementById('CloneUpsellCardTemplate');
    if (!tpl) return null;
    var node = tpl.content.firstElementChild.cloneNode(true);

    node.setAttribute('data-product-id', product.id);

    var url = product.url || ('/products/' + (product.handle || ''));
    node.querySelectorAll('[data-upsell-link]').forEach(function (a) { a.setAttribute('href', url); });

    var img = node.querySelector('[data-upsell-image]');
    // Resolve URL: featured_image (string ou objeto), image, ou primeira imagem do array
    var rawSrc = '';
    if (product.featured_image) {
      rawSrc = (typeof product.featured_image === 'string') ? product.featured_image : (product.featured_image.url || product.featured_image.src || '');
    } else if (product.image) {
      rawSrc = (typeof product.image === 'string') ? product.image : (product.image.src || '');
    } else if (product.images && product.images.length) {
      var first = product.images[0];
      rawSrc = (typeof first === 'string') ? first : (first.src || first.url || '');
    }
    // Garante protocolo (URLs Shopify costumam vir como "//cdn.shopify.com/...")
    if (rawSrc && rawSrc.indexOf('//') === 0) rawSrc = 'https:' + rawSrc;
    // Inject _200x antes da extensão pra economizar bandwidth
    if (rawSrc) {
      img.src = rawSrc.replace(/(\.(jpg|jpeg|png|webp))(\?.*)?$/, '_200x$1$3');
    } else {
      img.style.display = 'none';
    }
    img.alt = '';

    node.querySelector('[data-upsell-title]').textContent = product.title || '';

    // Price + compare
    var firstVariant = (product.variants && product.variants[0]) || null;
    var priceCents = firstVariant ? firstVariant.price : (product.price || 0);
    var compareCents = firstVariant ? (firstVariant.compare_at_price || 0) : (product.compare_at_price || 0);
    if (typeof priceCents === 'string') priceCents = parseInt(priceCents.replace(/[^0-9]/g, ''), 10) || 0;
    if (typeof compareCents === 'string') compareCents = parseInt(compareCents.replace(/[^0-9]/g, ''), 10) || 0;

    node.querySelector('[data-upsell-price]').textContent = formatMoney(priceCents);
    var compareEl = node.querySelector('[data-upsell-compare]');
    if (compareCents > priceCents) {
      compareEl.textContent = formatMoney(compareCents);
      compareEl.hidden = false;
    }

    // Variant select
    var select = node.querySelector('[data-upsell-variant]');
    var variants = product.variants || [];
    if (variants.length > 1) {
      variants.forEach(function (v) {
        var opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.title || v.option1 || '';
        select.appendChild(opt);
      });
    } else if (variants.length === 1) {
      var firstV = variants[0];
      var firstTitle = firstV.title || firstV.option1 || '';
      var optX = document.createElement('option');
      optX.value = firstV.id;
      if (!firstTitle || firstTitle.toLowerCase() === 'default title') {
        optX.textContent = product.title || 'Default';
      } else {
        optX.textContent = firstTitle;
      }
      optX.selected = true;
      select.appendChild(optX);
      // Sem disabled — permite abrir dropdown (vai mostrar a única option, sem confundir o usuário)
    } else {
      // Sem variants no payload: tenta options array OR placeholder
      var optZ = document.createElement('option');
      optZ.value = '';
      optZ.textContent = product.title || 'Select';
      optZ.selected = true;
      select.appendChild(optZ);
    }

    // Add button
    var addBtn = node.querySelector('[data-upsell-add]');
    addBtn.addEventListener('click', function () {
      var variantId = select.value || (variants[0] && variants[0].id);
      if (!variantId) return;
      addBtn.disabled = true;
      addBtn.textContent = 'Adding...';
      addToCart(variantId, 1).then(function () {
        return refresh();
      }).finally(function () {
        addBtn.disabled = false;
        addBtn.textContent = 'Add to cart';
      });
    });

    return node;
  }

  function fetchCollectionProducts(handle, limit) {
    if (!handle) return Promise.resolve([]);
    return fetch('/collections/' + handle + '/products.json?limit=' + (limit || 12), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) { return (j && j.products) || []; })
      .catch(function () { return []; });
  }

  // Auto-match cache: handles em cada coleção principal
  var categoryMaps = null;
  function loadCategoryMaps() {
    if (categoryMaps) return Promise.resolve(categoryMaps);
    return Promise.all([
      fetch('/collections/mens-watches/products.json?limit=250', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).catch(function () { return { products: [] }; }),
      fetch('/collections/womens-watches/products.json?limit=250', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).catch(function () { return { products: [] }; })
    ]).then(function (results) {
      categoryMaps = {
        mens: {},
        womens: {}
      };
      (results[0].products || []).forEach(function (p) { categoryMaps.mens[p.handle] = true; });
      (results[1].products || []).forEach(function (p) { categoryMaps.womens[p.handle] = true; });
      return categoryMaps;
    });
  }

  // Detecta coleção fonte: 1) setting fixo, 2) auto-match: vê em qual coleção o seed produto está
  function resolveUpsellSource(seedHandle) {
    var fixedColl = window.CLONE_UPSELL_COLLECTION;
    var autoMatch = window.CLONE_UPSELL_AUTOMATCH !== false;
    if (fixedColl) return Promise.resolve(fixedColl);
    if (!autoMatch || !seedHandle) return Promise.resolve(null);

    return loadCategoryMaps().then(function (maps) {
      if (maps.womens[seedHandle]) return 'womens-watches';
      if (maps.mens[seedHandle]) return 'mens-watches';
      // Fallback: tags/product_type/title/handle
      return fetch('/products/' + seedHandle + '.js', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (p) {
          var hay = ((p.tags || []).join(' ') + ' ' + (p.product_type || '') + ' ' + (p.title || '')).toLowerCase();
          if (/wom[ae]n|female|lady|ladies|feminin/.test(hay)) return 'womens-watches';
          if (/\bmens?\b|male|men's|masculin/.test(hay)) return 'mens-watches';
          return null;
        }).catch(function () { return null; });
    });
  }

  var lastSeedHandle = null;
  function loadUpsells(cart) {
    if (!upsellSection || !upsellTrack) return;
    if (window.CLONE_UPSELL_ENABLED === false) { upsellSection.hidden = true; return; }

    var items = (cart && cart.items) || [];
    var nonShipping = items.filter(function (it) { return !(SHIPPING_VARIANT && String(it.variant_id) === String(SHIPPING_VARIANT)); });
    var seed = nonShipping[0];
    var seedProductId = seed && seed.product_id;
    var seedHandle = seed && seed.handle;
    var cacheKey = seedHandle || '__no_seed__';

    // Cache memoizado por seed: se trocar produto no cart, busca de novo
    if (upsellCacheBySeed[cacheKey]) {
      return renderUpsells(upsellCacheBySeed[cacheKey], cart);
    }

    var primary = resolveUpsellSource(seedHandle).then(function (sourceCollection) {
      if (sourceCollection) return fetchCollectionProducts(sourceCollection, 12);
      if (seedProductId) return fetchRecommendations(seedProductId, 8);
      return [];
    });

    primary.then(function (products) {
      if (!products || !products.length) {
        return fetchFallbackProducts(12);
      }
      return products;
    }).then(function (products) {
      var inCartIds = items.reduce(function (acc, it) { acc[it.product_id] = true; return acc; }, {});
      var filtered = (products || []).filter(function (p) { return !inCartIds[p.id]; });
      if (!filtered.length && products && products.length) filtered = products;
      upsellCacheBySeed[cacheKey] = filtered;
      renderUpsells(filtered, cart);
    }).catch(function (err) {
      console.error('[clone-cart] upsell load failed', err);
    });
  }

  function renderUpsells(products, cart) {
    if (!upsellSection || !upsellTrack) return;
    if (!products || !products.length) {
      upsellSection.hidden = true;
      return;
    }
    upsellTrack.innerHTML = '';
    products.forEach(function (p) {
      var card = renderUpsellCard(p);
      if (card) upsellTrack.appendChild(card);
    });
    upsellSection.hidden = false;
  }

  function scrollUpsell(direction) {
    if (!upsellTrack) return;
    var firstCard = upsellTrack.querySelector('.clone-upsell-card');
    var step = firstCard ? firstCard.offsetWidth + 12 : 280;
    upsellTrack.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('clone-cart-open');
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('clone-cart-open');
  }

  function fetchCart() {
    return fetch('/cart.js', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); });
  }

  function addToCart(variantId, quantity) {
    return fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: quantity || 1 })
    }).then(function (r) { return r.json(); });
  }

  function changeLine(line, quantity) {
    return fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ line: line, quantity: quantity })
    }).then(function (r) { return r.json(); });
  }

  function changeByVariant(variantId, quantity) {
    return fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: String(variantId), quantity: quantity })
    }).then(function (r) { return r.json(); });
  }

  // Calcula BOGO visual: a cada 2 items (não-shipping), o mais barato fica 50% off.
  // Retorna { items: [{...item, bogoApplied: bool}], totalDiscountCents, eligibleCount }
  function calcBogo(items) {
    if (!items || !items.length) return { items: [], totalDiscountCents: 0, eligibleCount: 0 };

    // Expande items por quantidade pra calcular pares
    var expanded = [];
    items.forEach(function (it, idx) {
      if (SHIPPING_VARIANT && String(it.variant_id) === String(SHIPPING_VARIANT)) return;
      for (var i = 0; i < it.quantity; i++) {
        expanded.push({ refIdx: idx, price: it.price });
      }
    });

    // Ordena por preço asc — itens mais baratos vão pra "metade BOGO"
    expanded.sort(function (a, b) { return a.price - b.price; });

    var pairs = Math.floor(expanded.length / 2);
    var totalDiscountCents = 0;
    var freeIndexes = {};
    for (var p = 0; p < pairs; p++) {
      var freeItem = expanded[p]; // os "p" mais baratos ficam grátis
      totalDiscountCents += freeItem.price;
      freeIndexes[freeItem.refIdx] = (freeIndexes[freeItem.refIdx] || 0) + 1;
    }

    var taggedItems = items.map(function (it, idx) {
      return Object.assign({}, it, { bogoFreeQty: freeIndexes[idx] || 0 });
    });

    return { items: taggedItems, totalDiscountCents: totalDiscountCents, eligibleCount: pairs * 2 };
  }

  function renderItem(line, idx, bogoFreeQty) {
    var tpl = document.getElementById(ITEM_TPL_ID);
    if (!tpl) return null;
    var node = tpl.content.firstElementChild.cloneNode(true);
    node.setAttribute('data-line-key', line.key);
    node.setAttribute('data-variant-id', line.variant_id);
    node.setAttribute('data-line-index', idx + 1); // Shopify lines são 1-indexed

    var link = node.querySelectorAll('[data-line-link]');
    link.forEach(function (a) { a.setAttribute('href', line.url); });

    var img = node.querySelector('[data-line-image]');
    if (img) {
      img.src = (line.image || '').replace(/(_)?(small|medium|large|grande)?\.(jpg|png|jpeg|webp)/, '_200x.$3');
      img.alt = line.product_title || '';
    }

    node.querySelector('[data-line-title]').textContent = line.product_title;

    var variantEl = node.querySelector('[data-line-variant]');
    if (line.options_with_values && line.options_with_values.length) {
      // Mostra a primeira option (geralmente cor)
      var opt = line.options_with_values[0];
      variantEl.textContent = (opt.name || 'Color') + ': ' + opt.value;
    } else if (line.variant_title && line.variant_title !== 'Default Title') {
      variantEl.textContent = line.variant_title;
    } else {
      variantEl.style.display = 'none';
    }

    node.querySelector('[data-line-qty]').textContent = line.quantity;

    // Total da linha (qty × unit) — igual o LF mostra
    var qty = line.quantity || 1;
    var unitPriceCents = line.price;
    var totalPriceCents = unitPriceCents * qty;
    // compare_at_price NÃO vem no /cart.js — busca no cache de produto (preenchido async em render)
    var handleCache = productCache[line.handle] || {};
    var unitCompareCents = parseInt(handleCache[String(line.variant_id)] || line.compare_at_price || 0, 10) || 0;
    var totalCompareCents = unitCompareCents * qty;

    node.querySelector('[data-line-price]').textContent = formatMoney(totalPriceCents);

    var compareEl = node.querySelector('[data-line-compare]');
    var saveEl = node.querySelector('[data-line-save]');
    if (totalCompareCents > totalPriceCents) {
      if (compareEl) {
        compareEl.textContent = formatMoney(totalCompareCents);
        compareEl.hidden = false;
      }
      if (saveEl) {
        saveEl.textContent = '(Save ' + formatMoney(totalCompareCents - totalPriceCents) + ')';
        saveEl.hidden = false;
      }
    } else {
      if (compareEl) compareEl.hidden = true;
      if (saveEl) saveEl.hidden = true;
    }

    // Badge BOGO no item: REMOVIDO por pedido — desconto continua aplicado no total apenas
    // (mantém variável bogoFreeQty pro caso de reativar futuramente)
    void bogoFreeQty;

    return node;
  }

  function render(cart) {
    // Pré-carrega compare_at_price de cada produto único, depois rerenderiza
    var handles = {};
    (cart.items || []).forEach(function (it) { if (it.handle && !productCache[it.handle]) handles[it.handle] = true; });
    var pending = Object.keys(handles);
    if (pending.length > 0) {
      Promise.all(pending.map(fetchProductCompares)).then(function () { renderActual(cart); });
      // Renderiza já com o que tem (pode ainda não mostrar compare), e atualiza ao chegar fetch
    }
    renderActual(cart);
  }
  function renderActual(cart) {
    if (!getEl() && !getEl()) return;

    var items = cart.items || [];
    var nonShippingItems = items.filter(function (it) {
      return !(SHIPPING_VARIANT && String(it.variant_id) === String(SHIPPING_VARIANT));
    });

    // Count: SÓ produtos (exclui shipping protection — não é "item" visual)
    var totalCount = 0;
    nonShippingItems.forEach(function (it) { totalCount += it.quantity; });
    countEl.textContent = totalCount;

    // Estado vazio = sem produtos (mas shipping pode estar no rodapé)
    if (totalCount === 0) {
      itemsList.innerHTML = '';
      if (emptyMsg) emptyMsg.hidden = false;
      // Total reflete shipping se ativo
      totalEl.textContent = formatMoney(cart.total_price || 0);
      if (discountsBlock) discountsBlock.hidden = true;
      // Sincroniza shipping toggle mesmo no estado vazio
      if (shippingToggle && SHIPPING_VARIANT) {
        var hasShip = (cart.items || []).some(function (it) { return String(it.variant_id) === String(SHIPPING_VARIANT); });
        shippingToggle.checked = hasShip;
      }
      return;
    }
    if (emptyMsg) emptyMsg.hidden = true;

    // Calcula BOGO
    var bogo = calcBogo(nonShippingItems);

    // Render items
    itemsList.innerHTML = '';
    items.forEach(function (line, idx) {
      var isShipping = SHIPPING_VARIANT && String(line.variant_id) === String(SHIPPING_VARIANT);
      if (isShipping) return; // não mostra shipping como item, é controlado pelo toggle
      // Achar o bogoFreeQty correspondente
      var matched = bogo.items[nonShippingItems.indexOf(line)];
      var freeQty = matched ? matched.bogoFreeQty : 0;
      var node = renderItem(line, idx, freeQty);
      if (node) itemsList.appendChild(node);
    });

    // Total (subtotal - bogo discount)
    // Total = subtotal completo (inclui shipping protection) - desconto BOGO
    var subtotalCents = cart.total_price;
    var finalCents = Math.max(0, subtotalCents - bogo.totalDiscountCents);
    totalEl.textContent = formatMoney(finalCents);

    // Bloco "Discounts" REMOVIDO do drawer — desconto BOGO segue aplicado no total
    if (discountsBlock) discountsBlock.hidden = true;

    // Shipping toggle state: marca se variant está no carrinho
    if (shippingToggle && SHIPPING_VARIANT) {
      var hasShipping = items.some(function (it) { return String(it.variant_id) === String(SHIPPING_VARIANT); });
      shippingToggle.checked = hasShipping;
    }

    // Checkout link com discount code (se houver)
    var checkoutBtn = drawer.querySelector('[data-cart-checkout]');
    if (checkoutBtn && BOGO_DISCOUNT_CODE && bogo.totalDiscountCents > 0) {
      checkoutBtn.href = '/checkout?discount=' + encodeURIComponent(BOGO_DISCOUNT_CODE);
    } else if (checkoutBtn) {
      checkoutBtn.href = '/checkout';
    }

    // Carrega upsells (Mix & Match) — recommendations baseado no primeiro item do cart
    loadUpsells(cart);
  }

  function refresh() {
    return fetchCart().then(render);
  }

  // === Listeners ===
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('.clone-grid__form');
    if (!form) return;
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"]');

    // Detecta bulk picker no card: se houver, adiciona TODAS as variantes selecionadas
    var card = form.closest('.clone-grid__card');
    var picker = card && card.querySelector('[data-bulk-picker]');
    var picks = picker ? card.querySelectorAll('[data-bulk-pick]') : null;

    var addPromise;
    if (picks && picks.length > 0) {
      // Monta items[] agregando por variant id
      var bag = {};
      picks.forEach(function (sel) {
        if (!sel.value) return;
        bag[sel.value] = (bag[sel.value] || 0) + 1;
      });
      var items = Object.keys(bag).map(function (id) { return { id: id, quantity: bag[id] }; });
      if (!items.length) return;
      if (btn) btn.disabled = true;
      addPromise = fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: items })
      }).then(function (r) { return r.json(); });
    } else {
      // Fluxo single: pega o input hidden
      var input = form.querySelector('input[name="id"]');
      if (!input) return;
      if (btn) btn.disabled = true;
      addPromise = addToCart(input.value, 1);
    }

    addPromise.then(function () {
      return refresh();
    }).then(function () {
      openDrawer();
    }).catch(function (err) {
      console.error('[clone-cart] add failed', err);
    }).finally(function () {
      if (btn) btn.disabled = false;
    });
  });

  document.addEventListener('click', function (e) {
    // Open via header cart icon
    var openTrigger = e.target.closest('[data-cart-open], a[href="/cart"], a[href$="/cart"]');
    if (openTrigger && !e.target.closest('.clone-cart-drawer')) {
      e.preventDefault();
      refresh().then(openDrawer);
      return;
    }

    // Close
    if (e.target.closest('[data-cart-close]')) {
      e.preventDefault();
      closeDrawer();
      return;
    }

    // Qty +/-
    var dec = e.target.closest('[data-cart-qty-dec]');
    var inc = e.target.closest('[data-cart-qty-inc]');
    if (dec || inc) {
      e.preventDefault();
      var item = (dec || inc).closest('[data-cart-line]');
      if (!item) return;
      var lineIdx = parseInt(item.getAttribute('data-line-index'), 10);
      var qtyEl = item.querySelector('[data-line-qty]');
      var current = parseInt(qtyEl.textContent, 10) || 1;
      var next = dec ? Math.max(0, current - 1) : current + 1;
      changeLine(lineIdx, next).then(render);
      return;
    }

    // Remove
    var rm = e.target.closest('[data-cart-remove]');
    if (rm) {
      e.preventDefault();
      var li = rm.closest('[data-cart-line]');
      if (!li) return;
      var idx = parseInt(li.getAttribute('data-line-index'), 10);
      changeLine(idx, 0).then(render);
      return;
    }

    // Upsell carrossel nav
    if (e.target.closest('[data-upsell-prev]')) {
      e.preventDefault();
      scrollUpsell(-1);
      return;
    }
    if (e.target.closest('[data-upsell-next]')) {
      e.preventDefault();
      scrollUpsell(1);
      return;
    }
  });

  // Shipping protection toggle
  document.addEventListener('change', function (e) {
    var toggle = e.target.closest('[data-shipping-toggle]');
    if (!toggle) return;
    var variantId = toggle.getAttribute('data-variant-id');
    if (!variantId) return;
    toggle.disabled = true;
    var op = toggle.checked ? addToCart(variantId, 1) : changeByVariant(variantId, 0);
    op.then(function () { return refresh(); }).catch(function (err) {
      console.error('[clone-cart] shipping toggle failed', err);
      toggle.checked = !toggle.checked; // reverte visual em caso de erro
    }).finally(function () {
      toggle.disabled = false;
    });
  });

  // Init
  function init() {
    if (!getEl()) return;
    refresh();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
