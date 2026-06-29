class ShopTheLook extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.container = this.querySelector('.shop-the-look__container');
        this.previewImages = this.querySelector('#ShopTheLookImages');
        this.viewAllBtn = this.querySelector('#ShopTheLookViewAll');
        this.modal = this.querySelector('#ShopTheLookModal');
        this.modalBody = this.querySelector('#ShopTheLookModalBody');
        this.closeBtn = this.querySelector('#ShopTheLookModalClose');

        if (this.viewAllBtn) {
            this.viewAllBtn.addEventListener('click', () => this.openModal());
        }

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Teleport modal to body to avoid stacking context issues
        if (this.modal && this.modal.parentNode !== document.body) {
            document.body.appendChild(this.modal);
        }

        // Close on overlay click
        this.overlay = this.modal.querySelector('.shop-the-look__modal-overlay');
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.closeModal());
        }

        if (this.container.classList.contains('hidden')) {
            this.loadRecommendations();
        }
    }

    loadRecommendations() {
        const url = `${this.dataset.url}&product_id=${this.dataset.productId}&section_id=main-product`;

        fetch(url)
            .then(response => response.text())
            .then(responseText => {
                const html = new DOMParser().parseFromString(responseText, 'text/html');
                const recommendations = html.querySelector('product-recommendations');

                let productCards = [];
                if (recommendations) {
                    productCards = recommendations.querySelectorAll('.card-wrapper');
                }

                if (productCards.length > 0) {
                    this.renderPreview(productCards);
                    this.container.classList.remove('hidden');
                } else if (this.dataset.url.includes('intent=complementary')) {
                    // Fallback to related products for testing/visualizing if complementary is empty
                    console.log('Shop the Look: No complementary products found, trying related...');
                    this.dataset.url = this.dataset.url.replace('intent=complementary', 'intent=related');
                    this.loadRecommendations();
                } else {
                    console.log('Shop the Look: No recommendations found for either intent.');
                }
            })
            .catch(e => console.error('Shop The Look error:', e));
    }

    renderPreview(cards) {
        const limit = parseInt(this.dataset.limit) || 4;
        let html = '';

        cards.forEach((card, index) => {
            if (index < limit) {
                const img = card.querySelector('img');
                if (img) {
                    const src = img.getAttribute('src') || img.dataset.src;
                    html += `<img src="${src}" class="shop-the-look__thumb" alt="Product thumbnail">`;
                }
            }
        });

        if (cards.length > limit) {
            html += `<div class="shop-the-look__more-count">+${cards.length - limit}</div>`;
        }

        this.previewImages.innerHTML = html;

        // Store cards for modal rendering
        this.productCards = cards;
    }

    openModal() {
        this.renderModalContent();
        this.modal.classList.add('active');
        document.body.classList.add('customization-open');
    }

    closeModal() {
        this.modal.classList.remove('active');
        document.body.classList.remove('customization-open');
    }

    renderModalContent() {
        if (!this.productCards) return;

        let html = '';
        this.productCards.forEach(card => {
            const title = card.querySelector('.card__heading')?.textContent.trim();
            const price = card.querySelector('.price')?.textContent.trim();
            const url = card.querySelector('a')?.getAttribute('href');
            const img = card.querySelector('img')?.getAttribute('src');

            html += `
          <div class="stl-product-card">
            <img src="${img}" class="stl-product-image" alt="${title}">
            <div class="stl-product-info">
              <h4 class="stl-product-title">${title}</h4>
              <div class="stl-product-price">${price}</div>
              <a href="${url}" class="link underlined-link" style="font-size: 1.2rem; margin-top: 0.5rem;">Ver Produto</a>
            </div>
            <button type="button" class="stl-add-btn" onclick="window.location.href='${url}'">Comprar</button>
          </div>
        `;
        });

        this.modalBody.innerHTML = html;
    }
}

if (!customElements.get('shop-the-look')) {
    customElements.define('shop-the-look', ShopTheLook);
}
