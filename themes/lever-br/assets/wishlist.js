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

        isAnimatingFirst: false,

        updateUI: function () {
            const items = this.get();
            const count = items.length;

            // Update Header bubbles
            const bubbles = document.querySelectorAll('.wishlist-count-bubble');
            bubbles.forEach(bubble => {
                const countSpan = bubble.querySelector('span[aria-hidden="true"]');
                if (countSpan) countSpan.textContent = count;
                bubble.style.display = count > 0 ? 'flex' : 'none';
            });

            // Update Header Icon Active State
            const wishlistIcon = document.querySelector('#wishlist-icon-bubble');
            if (wishlistIcon) {
                if (count === 0) {
                    wishlistIcon.classList.remove('is-active');
                } else if (!this.isAnimatingFirst) {
                    wishlistIcon.classList.add('is-active');
                }
            }

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

        animateFly: function (sourceBtn, isFirst) {
            const target = document.querySelector('#wishlist-icon-bubble .icon');
            const wishlistBtnHeader = document.querySelector('#wishlist-icon-bubble');
            if (!target) return;

            const sourceRect = sourceBtn.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();

            const flyItem = document.createElement('div');
            flyItem.className = 'wishlist-fly-item';

            // Clone SVG from source
            const sourceSvg = sourceBtn.querySelector('svg');
            if (sourceSvg) {
                const svg = sourceSvg.cloneNode(true);
                flyItem.appendChild(svg);
            }

            // Standard button size for the circle
            const initialSize = 34;

            // Center the initial circle on the source button
            flyItem.style.top = `${sourceRect.top + (sourceRect.height - initialSize) / 2}px`;
            flyItem.style.left = `${sourceRect.left + (sourceRect.width - initialSize) / 2}px`;
            flyItem.style.width = `${initialSize}px`;
            flyItem.style.height = `${initialSize}px`;

            document.body.appendChild(flyItem);

            if (isFirst) {
                this.isAnimatingFirst = true;
            }

            // Trigger animation
            requestAnimationFrame(() => {
                flyItem.style.top = `${targetRect.top}px`;
                flyItem.style.left = `${targetRect.left}px`;
                flyItem.style.width = `${targetRect.width}px`;
                flyItem.style.height = `${targetRect.height}px`;
                flyItem.style.opacity = '0';
                flyItem.style.background = 'transparent';
                flyItem.style.boxShadow = 'none';
                flyItem.style.padding = '0';
            });

            flyItem.addEventListener('transitionend', () => {
                flyItem.remove();

                if (isFirst) {
                    this.isAnimatingFirst = false;
                    if (this.get().length > 0) {
                        wishlistBtnHeader.classList.add('is-active');
                    }
                }

                target.classList.add('wishlist-pulse-active');
                setTimeout(() => target.classList.remove('wishlist-pulse-active'), 400);
            });
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

                    const items = this.get();
                    const isAdding = !items.some(item => item.id == product.id);
                    const isFirst = items.length === 0 && isAdding;

                    this.toggle(product);

                    if (isAdding) {
                        this.animateFly(btn, isFirst);
                    }
                }
            }, true); // Use capture phase

            this.updateUI();
        }
    };

    document.addEventListener('DOMContentLoaded', () => window.Wishlist.init());
})();
