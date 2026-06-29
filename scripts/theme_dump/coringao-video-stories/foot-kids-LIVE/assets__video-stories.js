document.addEventListener('DOMContentLoaded', () => {
  if (window.videoStoriesInitialized) return;
  window.videoStoriesInitialized = true;

  const modal = document.getElementById('VideoStoriesModal');
  if (!modal) return;

  const modalContent = modal.querySelector('.video-stories-modal__video-container');
  const closeBtn = modal.querySelector('.video-stories-modal__close');
  const backdrop = modal.querySelector('.video-stories-modal__backdrop');

  const muteBtn = modal.querySelector('.video-stories-modal__mute');
  const iconMuted = muteBtn ? muteBtn.querySelector('.icon-muted') : null;
  const iconUnmuted = muteBtn ? muteBtn.querySelector('.icon-unmuted') : null;

  let currentVideoElement = null;

  function updateMuteIcon(isMuted) {
    if (!iconMuted || !iconUnmuted) return;
    if (isMuted) {
      iconMuted.classList.remove('hidden');
      iconUnmuted.classList.add('hidden');
    } else {
      iconMuted.classList.add('hidden');
      iconUnmuted.classList.remove('hidden');
    }
  }

  // Alternar Mudo / Com Som
  if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentVideoElement) {
        currentVideoElement.muted = !currentVideoElement.muted;
        updateMuteIcon(currentVideoElement.muted);
      }
    });
  }

  // Abrir Modal via Delegação
  document.addEventListener('click', (e) => {
    const button = e.target.closest('.video-stories__button');
    if (!button) return;

    e.preventDefault();

    const videoUrl = button.dataset.videoUrl;
    const videoType = button.dataset.videoType;
    const shopifyVideoSrc = button.dataset.shopifyVideoSrc;
    const shopifyVideoType = button.dataset.shopifyVideoType || 'video/mp4';
    const customVideoUrl = button.dataset.customVideoUrl;

    let contentHTML = '';

    // Mostrar botão de mudo apenas para vídeos nativos (MP4)
    if (muteBtn) {
      muteBtn.style.display = (videoType === 'shopify' || videoType === 'custom') ? 'flex' : 'none';
    }

    if (videoType === 'shopify' && shopifyVideoSrc) {
      // Vídeo Shopify: iniciar com som
      contentHTML = `
        <video autoplay playsinline loop class="story-video">
          <source src="${shopifyVideoSrc}" type="${shopifyVideoType}">
          Seu navegador não suporta o elemento de vídeo.
        </video>
      `;
      updateMuteIcon(false);
    } else if (videoType === 'custom' && customVideoUrl) {
      // Link MP4 direto: iniciar com som
      contentHTML = `
        <video autoplay playsinline loop class="story-video">
          <source src="${customVideoUrl}" type="video/mp4">
          Seu navegador não suporta o elemento de vídeo.
        </video>
      `;
      updateMuteIcon(false);
    } else if (videoType === 'youtube' && videoUrl) {
      // YouTube
      const ytMatch = videoUrl.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/shorts\/))([a-zA-Z0-9_-]{10,12})/);
      if (ytMatch) {
        const videoId = ytMatch[1];
        contentHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&loop=1&mute=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      }
    } else if (videoType === 'vimeo' && videoUrl) {
      // Vimeo
      const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
      if (vimeoMatch) {
        const videoId = vimeoMatch[1];
        contentHTML = `<iframe src="https://player.vimeo.com/video/${videoId}?autoplay=1&muted=0" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
      }
    } else if (videoUrl) {
      // Fallback: tratar como MP4 direto
      if (muteBtn) muteBtn.style.display = 'flex';
      contentHTML = `
        <video autoplay playsinline loop class="story-video">
          <source src="${videoUrl}">
          Seu navegador não suporta o elemento de vídeo.
        </video>
      `;
      updateMuteIcon(false);
    }

    if (!contentHTML) return;

    modalContent.innerHTML = contentHTML;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Capturar elemento de vídeo para controle de mudo
    currentVideoElement = modalContent.querySelector('video');

    // Para vídeos nativos, tentar reproduzir com som
    if (currentVideoElement) {
      currentVideoElement.muted = false;
      currentVideoElement.play().catch(() => {
        // Autoplay com som bloqueado pelo navegador — fallback para mudo
        currentVideoElement.muted = true;
        currentVideoElement.play();
        updateMuteIcon(true);
      });
    }
  });

  // Fechar Modal
  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    modalContent.innerHTML = '';
    document.body.style.overflow = '';
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  // Fechar com tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      closeModal();
    }
  });
});
