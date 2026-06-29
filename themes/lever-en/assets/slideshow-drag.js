if (!customElements.get('slideshow-drag')) {
    class SlideshowDrag extends HTMLElement {
        constructor() {
            super();
            this.slider = this.querySelector('.slider');
            if (!this.slider) return;

            this.slideshowComponent = this.querySelector('slideshow-component') || this.closest('slideshow-component');
            this.isSlideshow = this.slideshowComponent !== null;

            this.isDown = false;
            this.startX = 0;
            this.startY = 0;
            this.velocity = 0;
            this.hasDragged = false;
            this.isTouch = false;
            this.dragThreshold = 5;
            this.totalDragDistance = 0;
            this.animationFrame = null;

            // Events
            const options = { passive: false, capture: true };
            this.slider.addEventListener('mousedown', this.onMouseDown.bind(this), true);
            document.addEventListener('mouseup', this.onMouseUp.bind(this), true);
            document.addEventListener('mousemove', this.onMouseMove.bind(this), true);

            this.slider.addEventListener('touchstart', this.onMouseDown.bind(this), { passive: true, capture: true });
            document.addEventListener('touchend', this.onMouseUp.bind(this), { passive: true, capture: true });
            this.slider.addEventListener('touchmove', this.onMouseMove.bind(this), options);

            this.slider.addEventListener('dragstart', (e) => {
                if (this.isDown) e.preventDefault();
            }, true);

            this.slider.addEventListener('click', (e) => {
                if (this.hasDragged) {
                    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                    return false;
                }
            }, true);

            this.slider.style.cursor = 'grab';
            this.originalSnapType = getComputedStyle(this.slider).scrollSnapType;
        }

        dispatchScroll() {
            this.slider.dispatchEvent(new Event('scroll'));
        }

        stopAnimation() {
            if (this.animationFrame) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }
        }

        onMouseDown(e) {
            const pageX = e.pageX || (e.touches && e.touches[0].pageX);
            const pageY = e.pageY || (e.touches && e.touches[0].pageY);
            this.isTouch = e.type === 'touchstart';

            if (!pageX) return;
            if (!e.touches && e.target.closest('button, input, .slider-counter__link, .slider-button')) return;

            this.stopAnimation();
            this.isDown = true;
            this.hasDragged = false;
            this.slider.classList.add('active');
            this.startX = pageX;
            this.startY = pageY;
            this.lastMoveX = pageX;
            this.lastMoveTime = Date.now();
            this.totalDragDistance = 0;
            this.velocity = 0;

            this.slider.style.cursor = 'grabbing';

            // PERFORMANCE FIX: Only disable snapping for MOUSE dragging.
            // On touch, keeping native snap active prevents the "shiver" when letting go.
            if (!this.isTouch) {
                this.slider.style.scrollSnapType = 'none';
                this.slider.style.scrollBehavior = 'auto';
                document.body.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';
            }
        }

        onMouseMove(e) {
            if (!this.isDown) return;
            const pageX = e.pageX || (e.touches && e.touches[0].pageX);
            const pageY = e.pageY || (e.touches && e.touches[0].pageY);
            if (!pageX) return;

            const deltaX = Math.abs(pageX - this.startX);
            const deltaY = Math.abs(pageY - this.startY);

            if (deltaX > this.dragThreshold && deltaX > deltaY) {
                if (!this.hasDragged) this.hasDragged = true;

                // PERFORMANCE FIX: Only prevent defaults and update scrollLeft manually for mouse.
                // For touch, let the browser handle native hardware-accelerated scrolling.
                if (this.isTouch) return;

                if (e.cancelable) e.preventDefault();

                const now = Date.now();
                const dt = now - this.lastMoveTime;
                const moveDelta = pageX - this.lastMoveX;

                if (dt > 0) {
                    const instV = moveDelta / dt;
                    this.velocity = this.velocity * 0.4 + instV * 0.6;
                }

                this.totalDragDistance += moveDelta;
                this.lastMoveX = pageX;
                this.lastMoveTime = now;

                if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
                this.animationFrame = requestAnimationFrame(() => {
                    this.slider.scrollLeft -= moveDelta;
                    this.dispatchScroll();
                });
            }
        }

        onMouseUp() {
            if (!this.isDown) return;
            this.isDown = false;
            this.slider.classList.remove('active');
            this.slider.style.cursor = 'grab';
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            if (this.hasDragged) {
                this.handleDragEnd();
                setTimeout(() => { this.hasDragged = false; }, 100);
            } else if (!this.isTouch) {
                this.restoreSnap();
            }
        }

        handleDragEnd() {
            const maxScroll = this.slider.scrollWidth - this.slider.clientWidth;

            if (this.isSlideshow) {
                // PERFORMANCE FIX: On touch devices, do NOT manual animate the slideshow.
                // Let the native scroll-snap-align: start do the work.
                if (this.isTouch) {
                    this.restoreSnap();
                    return;
                }

                const width = this.slider.clientWidth;
                const currentScroll = this.slider.scrollLeft;
                const currentIndex = Math.round(currentScroll / width);
                const threshold = width * 0.15;

                let targetIndex = currentIndex;
                const dragDist = Math.abs(this.totalDragDistance);
                const vel = Math.abs(this.velocity);

                if (dragDist > threshold || vel > 0.4) {
                    // Logic for direction
                    const direction = this.totalDragDistance > 0 ? -1 : 1;
                    targetIndex = Math.round((currentScroll + (direction * (width * 0.2))) / width);
                }

                // Bound check
                const maxIndex = this.slider.children.length - 1;
                targetIndex = Math.max(0, Math.min(targetIndex, maxIndex));

                this.animateTo(Math.min(targetIndex * width, maxScroll));
            } else {
                // PERFORMANCE FIX: On touch devices, let the browser handle momentum 
                // and snapping natively. Don't fight it with JS.
                if (this.isTouch) {
                    this.restoreSnap();
                    return;
                }

                if (Math.abs(this.velocity) > 0.3) {
                    this.applyMomentum();
                } else {
                    this.smoothSnapToNearest();
                }
            }
        }

        applyMomentum() {
            let v = this.velocity * 15; // Increased from 12 for snappier start
            const friction = 0.96; // Slightly less friction for a longer, smoother glide
            const maxScroll = this.slider.scrollWidth - this.slider.clientWidth;

            const step = () => {
                if (Math.abs(v) < 0.5) {
                    this.smoothSnapToNearest(); return;
                }

                let nextScroll = this.slider.scrollLeft - v;

                // Clamp momentum scroll to boundaries
                if (nextScroll <= 0) {
                    this.slider.scrollLeft = 0;
                    this.restoreSnap();
                    return;
                }
                if (nextScroll >= maxScroll) {
                    this.slider.scrollLeft = maxScroll;
                    this.restoreSnap();
                    return;
                }

                this.slider.scrollLeft = nextScroll;
                this.dispatchScroll();
                v *= friction;
                this.animationFrame = requestAnimationFrame(step);
            };
            this.animationFrame = requestAnimationFrame(step);
        }

        smoothSnapToNearest() {
            const children = Array.from(this.slider.children).filter(child =>
                child.classList.contains('slider__slide') || child.classList.contains('grid__item')
            ).filter(child => getComputedStyle(child).display !== 'none');

            if (children.length === 0) {
                this.restoreSnap(); return;
            }

            const currentScroll = this.slider.scrollLeft;
            const sliderRect = this.slider.getBoundingClientRect();
            const maxScroll = this.slider.scrollWidth - this.slider.clientWidth;

            let targetScroll = currentScroll;
            let minDistance = Infinity;

            children.forEach(child => {
                const childRect = child.getBoundingClientRect();
                const absPos = (childRect.left - sliderRect.left) + currentScroll;
                const dist = Math.abs(absPos - currentScroll);
                if (dist < minDistance) {
                    minDistance = dist;
                    targetScroll = absPos;
                }
            });

            // Prevent snapping to empty space
            targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));

            this.animateTo(targetScroll);
        }

        animateTo(target) {
            const start = this.slider.scrollLeft;
            const change = target - start;
            const duration = 400;
            let startTime = null;
            const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

            const step = (now) => {
                if (!startTime) startTime = now;
                const progress = Math.min((now - startTime) / duration, 1);
                this.slider.scrollLeft = start + change * easeOutQuart(progress);
                this.dispatchScroll();
                if (progress < 1) {
                    this.animationFrame = requestAnimationFrame(step);
                } else {
                    this.restoreSnap();
                }
            };
            this.animationFrame = requestAnimationFrame(step);
        }

        restoreSnap() {
            if (this.isTouch) return; // Touch uses native snap exclusively

            // Give 1 frame for scroll to settle
            setTimeout(() => {
                this.slider.style.scrollBehavior = 'smooth';
                this.slider.style.scrollSnapType = this.originalSnapType || 'x mandatory';
            }, 50);
        }
    }
    customElements.define('slideshow-drag', SlideshowDrag);
}
