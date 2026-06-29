document.addEventListener('DOMContentLoaded', () => {
  if (window.videoStoriesInitialized) return;
  window.videoStoriesInitialized = true;

  const modal = document.getElementById('VideoStoriesModal');
  if (!modal) return;

  const modalContent = modal.querySelector('.video-stories-modal__video-container');
  const closeBtn = modal.querySelector('.video-stories-modal__close');
  const backdrop = modal.querySelector('.video-stories-modal__backdrop');

  const muteBtn = modal.querySelector('.video-stories-modal__mute');
  const iconMuted = muteBtn.querySelector('.icon-muted');
  const iconUnmuted = muteBtn.querySelector('.icon-unmuted');

  let currentVideoElement = null;

  function updateMuteIcon(isMuted) {
    if (isMuted) {
      iconMuted.classList.remove('hidden');
      iconUnmuted.classList.add('hidden');
    } else {
      iconMuted.classList.add('hidden');
      iconUnmuted.classList.remove('hidden');
    }
  }

  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentVideoElement) {
      currentVideoElement.muted = !currentVideoElement.muted;
      updateMuteIcon(currentVideoElement.muted);
    }
  });

  document.addEventListener('click', (e) => {
    const button = e.target.closest('.video-stories__button');
    if (!button) return;

    e.preventDefault();

    const videoType = button.dataset.videoType;
    const shopifyVideoSrc = button.dataset.shopifyVideoSrc;
    const shopifyVideoType = button.dataset.shopifyVideoType;

    let contentHTML = '';

    // Show mute button for native videos
    muteBtn.style.display = 'flex';

    // Start unmuted (audio ON)
    updateMuteIcon(false);

    if (videoType === 'shopify' && shopifyVideoSrc) {
      contentHTML = `
        <video autoplay playsinline loop class="story-video">
          <source src="${shopifyVideoSrc}" type="${shopifyVideoType || 'video/mp4'}">
          Your browser does not support the video tag.
        </video>
      `;
    }

    modalContent.innerHTML = contentHTML;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    currentVideoElement = modalContent.querySelector('video');

    // Try to play unmuted; if browser blocks it, fallback to muted
    if (currentVideoElement) {
      currentVideoElement.muted = false;
      const playPromise = currentVideoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay with audio was blocked, fallback to muted
          currentVideoElement.muted = true;
          updateMuteIcon(true);
          currentVideoElement.play();
        });
      }
    }
  });

  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    modalContent.innerHTML = '';
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      closeModal();
    }
  });
});
