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
        const count = parseInt(progressBar.getAttribute('data-shirt-count') || '0', 10);
        const fill = progressBar.querySelector('.cart-progress-bar__fill');
        const goal1 = parseInt(progressBar.getAttribute('data-goal-1') || '3', 10);
        const goal2 = parseInt(progressBar.getAttribute('data-goal-2') || '6', 10);

        if (fill) {
            let percent = 0;

            // Determine Stage 1 or Stage 2 for styling purposes (classes)
            const stage = (count < goal1) ? 1 : 2;
            progressBar.setAttribute('data-stage', stage.toString());

            if (stage === 1) {
                progressBar.classList.add('stage-1');
                progressBar.classList.remove('stage-2');
                percent = (count / goal1) * 100;
            } else {
                progressBar.classList.add('stage-2');
                progressBar.classList.remove('stage-1');
                if (count >= goal2) {
                    percent = 100;
                } else {
                    const extra = count - goal1;
                    const range = goal2 - goal1;
                    percent = (extra / range) * 100;
                }
            }

            // Limit percent to 100
            if (percent > 100) percent = 100;

            requestAnimationFrame(() => {
                fill.style.width = `${percent || 0}%`;
                fill.style.display = 'block';
            });
        }

        const markers = progressBar.querySelectorAll('.cart-progress-bar__milestone, .cart-progress-bar__step');
        markers.forEach(m => {
            let markerGoal = 0;
            if (m.classList.contains('milestone-1')) {
                markerGoal = goal1;
            } else if (m.classList.contains('milestone-2')) {
                markerGoal = goal2;
            } else if (m.classList.contains('milestone-0')) {
                markerGoal = 0;
            } else {
                // Step markers have step-i class
                const stepClass = Array.from(m.classList).find(c => c.startsWith('step-'));
                if (stepClass) {
                    markerGoal = parseInt(stepClass.split('-')[1]);
                }
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

        // Toggle fixed bonus messages
        const bonuses = progressBar.querySelector('.cart-progress-bar__bonuses');
        if (bonuses) {
            const minItems = parseInt(bonuses.getAttribute('data-min-items') || '1', 10);
            if (count >= minItems) {
                bonuses.classList.add('is-visible');
            } else {
                bonuses.classList.remove('is-visible');
            }
        }
    });
}
