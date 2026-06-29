document.addEventListener('DOMContentLoaded', () => {
  if (window.videoStoriesInitialized) return;
  window.videoStoriesInitialized = true;

  // Use a shared modal if possible, or assume one exists
  const modal = document.getElementById('VideoStoriesModal');
  if (!modal) return; // Without modal, we can't show anything

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

  // Toggle Mute
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent closing or other clicks
    if (currentVideoElement) {
      currentVideoElement.muted = !currentVideoElement.muted;
      updateMuteIcon(currentVideoElement.muted);
    }
  });

  // Open Modal via Delegation (Handles multiple sections/blocks dynamically)
  document.addEventListener('click', (e) => {
    const button = e.target.closest('.video-stories__button');
    if (!button) return;

    // Prevent default anchor behavior if it's an anchor, though we use buttons usually
    e.preventDefault();

    const videoUrl = button.dataset.videoUrl;
    const videoType = button.dataset.videoType;
    const shopifyVideoSrc = button.dataset.shopifyVideoSrc;

    const customVideoUrl = button.dataset.customVideoUrl;

    let contentHTML = '';
    // Default to muted for better autoplay support
    const isMuted = true;
    updateMuteIcon(isMuted);

    // Show mute button only for native videos
    muteBtn.style.display = (videoType === 'shopify' || videoType === 'custom') ? 'flex' : 'none';

    if (videoType === 'shopify' && shopifyVideoSrc) {
      contentHTML = `
        <video autoplay playsinline loop muted class="story-video">
          <source src="${shopifyVideoSrc}" type="${button.dataset.shopifyVideoType}">
          Your browser does not support the video tag.
        </video>
      `;
    } else if (videoType === 'custom' && customVideoUrl) {
      // Direct MP4 Link
      contentHTML = `
        <video autoplay playsinline loop muted class="story-video">
          <source src="${customVideoUrl}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      `;
    } else if (videoUrl) {
      // Handle YouTube/Vimeo
      if (videoUrl.includes('youtube') || videoUrl.includes('youtu.be')) {
        let videoId = videoUrl.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=|\/shorts\/))([\w\-]{10,12})\b/)[1];
        contentHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&loop=1&mute=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      } else if (videoUrl.includes('vimeo')) {
        let videoId = videoUrl.match(/vimeo.com\/(\d+)/)[1];
        contentHTML = `<iframe src="https://player.vimeo.com/video/${videoId}?autoplay=1&muted=0" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
      } else {
        // Fallback
        muteBtn.style.display = 'flex';
        contentHTML = `
        <video autoplay playsinline loop muted class="story-video">
          <source src="${videoUrl}">
          Your browser does not support the video tag.
        </video>
      `;
      }
    }

    modalContent.innerHTML = contentHTML;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    // Capture video element for mute control
    currentVideoElement = modalContent.querySelector('video');
  });

  // Close Modal
  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    modalContent.innerHTML = ''; // Stop video
    document.body.style.overflow = '';
  }

  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      closeModal();
    }
  });
});
