document.addEventListener('DOMContentLoaded', () => {
    initCartProgressBar();
    observeCartChanges();
});

// Watch for cart changes via events
['cart:updated', 'cart:item-added', 'cart:item-removed', 'change'].forEach(event => {
    document.addEventListener(event, () => {
        // Debounce slightly to allow Dawn's section rendering to finish
        setTimeout(initCartProgressBar, 500);
    });
});

function observeCartChanges() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    if (node.id === 'CartProgressBar' || (node.querySelector && node.querySelector('#CartProgressBar'))) {
                        initCartProgressBar();
                    }
                });
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function initCartProgressBar() {
    const bars = document.querySelectorAll('.cart-progress-bar-container');
    bars.forEach(progressBar => {
        const count = parseInt(progressBar.dataset.shirtCount || '0');
        const fill = progressBar.querySelector('.cart-progress-bar__fill');

        if (fill) {
            let percent = 0;

            // Determine stage
            if (count < 3) {
                progressBar.setAttribute('data-stage', '1');
                progressBar.classList.remove('stage-2');
                progressBar.classList.add('stage-1');
                // Stage 1: Goal is 3. Steps: 0->1->2->3
                // Range: 0 to 3
                percent = (count / 3) * 100;
            } else {
                progressBar.setAttribute('data-stage', '2');
                progressBar.classList.remove('stage-1');
                progressBar.classList.add('stage-2');

                // Stage 2 percent logic: (count - 3) / (6 - 3)
                if (count >= 6) {
                    percent = 100;
                } else if (count >= 3) {
                    percent = ((count - 3) / 3) * 100;
                } else {
                    percent = 0;
                }
            }

            requestAnimationFrame(() => {
                fill.style.width = `${percent}%`;
            });
        }

        const markers = progressBar.querySelectorAll('.cart-progress-bar__milestone, .cart-progress-bar__step');
        markers.forEach(m => {
            let markerGoal = m.classList.contains('milestone-1') ? 3 : (m.classList.contains('milestone-2') ? 6 : 0);
            if (markerGoal === 0) {
                const left = parseFloat(m.style.left);
                markerGoal = Math.round((left / 100) * 6);
            }

            if (count >= markerGoal) {
                if (!m.classList.contains('is-reached')) {
                    m.classList.add('is-reached', 'pop-animation');
                    setTimeout(() => m.classList.remove('pop-animation'), 600);
                }
            } else {
                m.classList.remove('is-reached', 'pop-animation');
            }
        });
    });
}
