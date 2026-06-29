/**
 * Shop the Look Global - Intercepta ATC e exibe drawer de cross-sell
 * Depende de: window.activeShopTheLookRule (definido pela seção custom-shop-the-look-rules.liquid)
 * 
 * Adaptado para o tema padrão da agência:
 * - Layout espelho dos itens do carrinho (mesmas classes e disposições)
 * - Botão Continuar na parte inferior abre o carrinho
 * - Adicionar item atualiza o carrinho em background nativamente via sections
 */
(function () {
  const rule = window.activeShopTheLookRule;
  if (!rule) return;

  function getMainProductName() {
    const titleEl = document.querySelector('.product__title h1');
    return titleEl ? titleEl.textContent.trim() : 'esse item';
  }

  // Cria o drawer HTML
  function createDrawer() {
    const drawer = document.createElement('div');
    drawer.id = 'STLGlobalModal';
    drawer.className = 'shop-the-look__modal';

    const productName = getMainProductName();

    let productsHTML = '';
    rule.products.forEach(product => {
      const discountedPrice = rule.discountPercentage > 0
        ? (product.price * (1 - rule.discountPercentage / 100))
        : product.price;
      const discountedFormatted = (discountedPrice / 100).toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL'
      });
      const savings = product.price - discountedPrice;
      const savingsFormatted = (savings / 100).toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL'
      });

      // Build variant select se tiver múltiplas variantes
      let variantHTML = '';
      if (product.variants && product.variants.length > 1) {
        variantHTML = `
          <div class="stl-product-variants" style="margin-top: 0.8rem; width: 100%;">
            <select class="stl-variant-select" data-product-id="${product.id}" style="padding: 1.2rem; border: 1px solid rgba(var(--color-foreground), 0.1); border-radius: 12px; font-size: 1.4rem; width: 100%; background: #fff; cursor: pointer; appearance: auto; color: rgb(var(--color-foreground));">
              ${product.variants.map(v => `<option value="${v.id}" ${!v.available ? 'disabled' : ''}>${v.title}${!v.available ? ' - Esgotado' : ''}</option>`).join('')}
            </select>
          </div>
        `;
      }

      productsHTML += `
        <div class="cart-item" style="padding: 1.5rem 0; border-bottom: 1px solid rgba(var(--color-foreground),0.1); display: flex; gap: 1.5rem; align-items: flex-start;" data-product-id="${product.id}" data-variant-id="${product.variants[0]?.id}">
          <div class="cart-item__media" style="width: 80px; height: 80px; flex-shrink: 0; background: #f8f8f8; border-radius: 8px; overflow: hidden;">
            <img src="${product.image}" class="cart-item__image" alt="${product.title}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
          <div class="cart-item__details" style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
            <h4 class="cart-item__name" style="font-size: 1.5rem; font-weight: 700; line-height: 1.3; color: #151515; margin: 0; text-transform: capitalize;">${product.title}</h4>
            
            <div class="cart-item__price-row" style="display: flex; align-items: center; gap: 0.8rem; margin-top: 0.2rem;">
              ${rule.discountPercentage > 0 ? `
              <div class="cart-item__discounted-prices" style="display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap;">
                <strong class="cart-item__final-price product-option" style="font-size: 1.4rem !important; font-weight: 700; color: #151515; line-height: 1;">${discountedFormatted}</strong>
                <s class="cart-item__old-price product-option" style="font-size: 1.3rem !important; font-weight: 400; opacity: 0.5; text-decoration: line-through; line-height: 1;">${product.priceFormatted}</s>
                <span style="background: #dcfce7; color: #15803d; font-size: 1rem; font-weight: 800; padding: 0.3rem 0.6rem; border-radius: 4px; text-transform: uppercase; margin-left: 0.2rem; display: inline-flex; align-items: center; line-height: 1;">Economize ${savingsFormatted}</span>
              </div>` : `
              <div class="product-option cart-item__final-price" style="font-size: 1.4rem !important; font-weight: 700; color: #151515; line-height: 1;">${product.priceFormatted}</div>`}
            </div>

            ${variantHTML}

            <div style="margin-top: 0.5rem; width: 100%;">
              <button type="button" class="stl-add-btn" data-variant-id="${product.variants[0]?.id}" style="width: 100%; min-height: 4.4rem; background: rgb(var(--color-button)); color: rgb(var(--color-button-text)); border: none; border-radius: 12px; padding: 0.8rem 1.5rem; font-size: 1.4rem; font-weight: 700; cursor: pointer; text-transform: uppercase; transition: opacity 0.3s; display: flex; align-items: center; justify-content: center; letter-spacing: 0.05rem;">
                ADICIONAR
              </button>
            </div>
          </div>
        </div>
      `;
    });

    drawer.innerHTML = `
      <div class="shop-the-look__modal-overlay"></div>
      <div class="shop-the-look__modal-content">
        <div class="stl-custom-header" style="position: relative; padding: 2.5rem 2rem; display: flex; justify-content: space-between; align-items: center; background: #ffffff !important; border-bottom: 1px solid rgba(0,0,0,0.05);">
          <h2 class="stl-custom-title" style="margin: 0; font-size: 1.6rem; font-weight: 800; color: #151515 !important; text-transform: uppercase; letter-spacing: 0.1rem; padding-right: 3rem;">COMPRE JUNTO</h2>
          <button type="button" class="stl-custom-close shop-the-look__modal-close" aria-label="Fechar" style="position: absolute; right: 1.5rem; padding: 1rem; top: 50%; transform: translateY(-50%); background: transparent !important; border: none; cursor: pointer; display: flex; z-index: 10;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 18 17" style="width: 2.2rem; height: 2.2rem; color: #151515; fill: #151515;">
              <path d="M.865 15.978a.5.5 0 00.707.707l7.433-7.434 7.434 7.434a.5.5 0 00.707-.707L9.712 8.546l7.434-7.434a.5.5 0 00-.707-.707L9.005 7.839 1.571.405a.5.5 0 00-.707.707l7.433 7.434L.865 15.978z"/>
            </svg>
          </button>
        </div>
        <div class="shop-the-look__modal-body" style="padding: 2.5rem 2.5rem; overflow-y: auto;">
          ${rule.discountPercentage > 0 ? `
          <div style="background-color: #dcfce7; border-radius: 6px; padding: 1.2rem 1.4rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0; color: #15803d;">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="7" cy="7" r="1" fill="currentColor"/>
            </svg>
            <p class="stl-discount-text" style="color: #15803d; font-weight: 500; font-size: 1.35rem; margin: 0; line-height: 1.4;">
              Uhul! Preparamos uma promoção <strong style="font-weight: 800;">exclusiva</strong> para você aproveitar e levar junto com <b style="font-weight: 700;">${productName}</b>.
            </p>
          </div>` : ''}
          <div style="margin-top: 0;">
            ${productsHTML}
          </div>
        </div>
        <div class="stl-custom-footer" style="padding: 2.5rem !important; padding-bottom: calc(2.5rem + env(safe-area-inset-bottom, 0px)) !important; background: #fff !important; box-shadow: 0 -4px 20px rgba(0,0,0,0.05); border-top: 1px solid rgba(0,0,0,0.05); margin-top: auto;">
          <button type="button" class="stl-continue-btn button" style="width: 100%; min-height: 5.4rem; border-radius: 12px !important; font-weight: 800; font-size: 1.6rem; text-transform: uppercase; background: rgb(var(--color-button)) !important; color: rgb(var(--color-button-text)) !important; border: none; cursor: pointer; outline: none; display: flex; justify-content: center; align-items: center; letter-spacing: 0.1rem; transition: opacity 0.3s; margin: 0;">
            CONTINUAR
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(drawer);
    return drawer;
  }

  const drawer = createDrawer();
  const overlay = drawer.querySelector('.shop-the-look__modal-overlay');
  const closeBtn = drawer.querySelector('.shop-the-look__modal-close');
  const continueBtn = drawer.querySelector('.stl-continue-btn');

  // Abrir/fechar drawer
  function openDrawer() {
    drawer.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // Expose globally so customization drawer can trigger it
  window.openSTLDrawer = openDrawer;

  function closeDrawer() {
    drawer.classList.remove('active');
    document.body.style.overflow = '';
  }

  overlay.addEventListener('click', closeDrawer);
  closeBtn.addEventListener('click', closeDrawer);

  // Continuar fecha o Compre Junto e abre o carrinho lateral
  continueBtn.addEventListener('click', () => {
    closeDrawer();
    const cartDrawer = document.querySelector('cart-drawer');
    if (cartDrawer && typeof cartDrawer.open === 'function') {
      // Temporarily clear the rule so renderContents/open is not blocked by the guard
      const oldRule = window.activeShopTheLookRule;
      window.activeShopTheLookRule = null;
      cartDrawer.open();
      window.activeShopTheLookRule = oldRule;
    } else {
      window.location.href = '/cart';
    }
  });

  // Handle variant select changes
  drawer.querySelectorAll('.stl-variant-select').forEach(select => {
    select.addEventListener('change', function () {
      const card = this.closest('.cart-item');
      const btn = card.querySelector('.stl-add-btn');
      card.dataset.variantId = this.value;
      btn.dataset.variantId = this.value;

      btn.textContent = 'ADICIONAR';
      btn.style.background = 'rgb(var(--color-button))';
      btn.style.color = 'rgb(var(--color-button-text))';
      btn.disabled = false;
    });
  });

  // Adicionar produto individual ao carrinho via AJAX + Update Sections
  drawer.querySelectorAll('.stl-add-btn').forEach(btn => {
    btn.addEventListener('click', async function () {
      const variantId = this.dataset.variantId;
      if (!variantId) return;

      const originalText = this.textContent;
      const spinnerSvg = '<div class="loading-overlay__spinner" style="display:flex;justify-content:center;align-items:center;"><svg aria-hidden="true" focusable="false" class="spinner" viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg" style="width: 2.2rem; height: 2.2rem; animation: rotator 1.4s linear infinite;"><circle class="path" fill="none" stroke-width="6" cx="33" cy="33" r="30" style="stroke: currentColor; stroke-dasharray: 280; stroke-dashoffset: 0; transform-origin: center; animation: dash 1.4s ease-in-out infinite;"></circle></svg></div>';
      this.innerHTML = spinnerSvg;
      this.disabled = true;

      try {
        const formData = new FormData();
        formData.append('id', variantId);
        formData.append('quantity', 1);

        const cartDrawer = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        const sectionsParams = cartDrawer && typeof cartDrawer.getSectionsToRender === 'function' ? cartDrawer.getSectionsToRender().map((s) => s.id).join(',') : 'cart-drawer,cart-icon-bubble';

        if (cartDrawer) {
          formData.append('sections', sectionsParams);
          formData.append('sections_url', window.location.pathname);
        }

        const url = window.routes?.cart_add_url || '/cart/add.js';

        let config = {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/javascript'
          },
          body: formData
        };

        if (window.fetchConfig) {
          config = window.fetchConfig('javascript');
          config.headers['X-Requested-With'] = 'XMLHttpRequest';
          delete config.headers['Content-Type'];
          config.body = formData;
        }

        fetch(url, config)
          .then(res => res.json())
          .then(response => {
            if (response.status && response.status !== 200) {
              this.textContent = 'ERRO';
              setTimeout(() => {
                this.textContent = originalText;
                this.disabled = false;
              }, 2000);
              return;
            }

            this.textContent = 'ADICIONADO';
            this.style.background = '#15803d'; // Verde sucesso
            this.style.color = '#ffffff';

            const getCartState = (response.sections)
              ? Promise.resolve(response)
              : fetch((window.routes?.cart_update_url || '/cart/update.js') + '?sections=' + sectionsParams).then(r => r.json());

            getCartState.then(resData => {
              if (cartDrawer && typeof cartDrawer.renderContents === 'function') {
                cartDrawer.renderContents(resData);
              }

              if (window.publish && window.PUB_SUB_EVENTS) {
                window.publish(window.PUB_SUB_EVENTS.cartUpdate, {
                  source: 'shop-the-look',
                  productVariantId: variantId,
                  cartData: resData,
                });
              }
            }).catch(e => console.warn('Shop the look: Falha oculta ao atualizar Sections API. ', e));

          })
          .catch(e => {
            console.error('Erro ao adicionar:', e);
            this.textContent = 'ERRO';
            setTimeout(() => {
              this.textContent = originalText;
              this.disabled = false;
            }, 2000);
          });
      } catch (e) {
        this.textContent = 'ERRO';
        console.error('Erro geral ao adicionar:', e);
        setTimeout(() => {
          this.textContent = originalText;
          this.disabled = false;
        }, 2000);
      }
    });
  });

  // ============================================================
  // Interceptar o botão ATC do produto principal
  // ============================================================
  function interceptATC() {
    const productForms = document.querySelectorAll('form[action="/cart/add"], product-form form');
    productForms.forEach(form => {
      form.addEventListener('submit', function (e) {
        // Ao submeter form principal, o carrinho não abrirá (bloqueado em cart-drawer.js)
        // Apenas abrimos a modal de comprehension
        openDrawer();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', interceptATC);
  } else {
    interceptATC();
  }
})();
