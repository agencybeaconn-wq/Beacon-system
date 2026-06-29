/**
 * Section Tabs - Vanilla JS for tab switching with sliding indicator
 * Used by featured-collection-tabs, collection-list-tabs, and collection-player-tabs sections
 */

if (!customElements.get('section-tabs')) {
    class SectionTabs extends HTMLElement {
        constructor() {
            super();
            this.buttons = this.querySelectorAll('[data-tab-button]');
            this.panels = this.querySelectorAll('[data-tab-panel]');
            this.navigation = this.querySelector('.tabs-navigation');
            this.init();
        }

        init() {
            this.buttons.forEach((button) => {
                button.addEventListener('click', this.handleTabClick.bind(this));
            });

            // Initialize indicator position on first active button
            requestAnimationFrame(() => {
                this.updateIndicator();
            });

            // Update indicator on window resize
            window.addEventListener('resize', () => {
                this.updateIndicator();
            });
        }

        handleTabClick(event) {
            const button = event.currentTarget;
            const tabId = button.getAttribute('data-tab-button');

            // Update button states
            this.buttons.forEach((btn) => {
                btn.classList.remove('tabs-navigation__button--active');
                btn.setAttribute('aria-selected', 'false');
            });
            button.classList.add('tabs-navigation__button--active');
            button.setAttribute('aria-selected', 'true');

            // Update sliding indicator
            this.updateIndicator();

            // Update panel visibility
            this.panels.forEach((panel) => {
                const panelId = panel.getAttribute('data-tab-panel');
                if (panelId === tabId) {
                    panel.classList.add('tabs-panel--active');
                    panel.removeAttribute('hidden');
                    // Reset slider position if exists
                    this.resetSlider(panel);
                } else {
                    panel.classList.remove('tabs-panel--active');
                    panel.setAttribute('hidden', '');
                }
            });
        }

        updateIndicator() {
            const activeButton = this.querySelector('.tabs-navigation__button--active');
            if (!activeButton || !this.navigation) return;

            const navRect = this.navigation.getBoundingClientRect();
            const buttonRect = activeButton.getBoundingClientRect();

            // Calculate position relative to navigation container
            const left = buttonRect.left - navRect.left;
            const width = buttonRect.width;

            this.navigation.style.setProperty('--indicator-left', `${left}px`);
            this.navigation.style.setProperty('--indicator-width', `${width}px`);
        }

        resetSlider(panel) {
            const slider = panel.querySelector('slider-component');
            if (slider) {
                const sliderEl = slider.querySelector('.slider');
                if (sliderEl) {
                    sliderEl.scrollTo({ left: 0, behavior: 'instant' });
                }
                // Reset counter
                const counter = slider.querySelector('.slider-counter--current');
                if (counter) {
                    counter.textContent = '1';
                }
            }
        }
    }

    customElements.define('section-tabs', SectionTabs);
}
