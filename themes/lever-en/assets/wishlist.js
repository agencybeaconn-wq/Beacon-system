(function () {
    const WISHLIST_KEY = 'shopify-wishlist';

    window.Wishlist = {
        get: function () {
            try {
                return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || [];
            } catch (e) {
                return [];
            }
        },

        toggle: function (product) {
            let items = this.get();
            const index = items.findIndex(item => item.id == product.id);

            if (index === -1) {
                items.push(product);
            } else {
                items.splice(index, 1);
            }

            localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
            this.updateUI();
            document.dispatchEvent(new CustomEvent('wishlist:updated', { detail: items }));
        },

        remove: function (productId) {
            let items = this.get();
            items = items.filter(item => item.id != productId);
            localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
            this.updateUI();
            document.dispatchEvent(new CustomEvent('wishlist:updated', { detail: items }));
        },

        updateUI: function () {
            const items = this.get();
            const count = items.length;

            // Update Header bubbles
            const bubbles = document.querySelectorAll('.wishlist-count-bubble');
            bubbles.forEach(bubble => {
                bubble.textContent = count;
                bubble.style.display = count > 0 ? 'flex' : 'none';
            });

            // Update Buttons in product pages and cards
            const buttons = document.querySelectorAll('.wishlist-btn');
            buttons.forEach(btn => {
                const id = btn.dataset.productId;
                const isActive = items.some(item => item.id == id);
                btn.classList.toggle('active', isActive);
            });

            // Update Drawer if open
            if (window.renderWishlistDrawerItems) {
                window.renderWishlistDrawerItems(items);
            }
        },

        init: function () {
            // Use capture phase to ensure we intercept the click before any bubbling link handlers
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('.wishlist-btn');
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation(); // Ensure no other listeners on the same element fire


                    const product = {
                        id: btn.dataset.productId,
                        handle: btn.dataset.productHandle,
                        title: btn.dataset.productTitle,
                        image: btn.dataset.productImage,
                        price: btn.dataset.productPrice
                    };
                    this.toggle(product);
                }
            }, true); // Use capture phase

            this.updateUI();
        }
    };

    document.addEventListener('DOMContentLoaded', () => window.Wishlist.init());
})();
