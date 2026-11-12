(() => {
  const { startBook } = window.ClioSite.book;
  const { setupLanguage } = window.ClioSite.i18n;
  const { fetchReleases, renderReleases, sampleReleases } = window.ClioSite.releases;
  const {
    detectOS,
    fillTicker,
    setupActiveNav,
    setupCopyButtons,
    setupScrollRail,
    startGlitch,
    syncGlitchText,
  } = window.ClioSite.ui;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDemo = window.location.hash === '#demo';
  const os = detectOS();
  const glitch = document.getElementById('glitch');

  let state = { status: 'loading', releases: [] };

  const render = () => renderReleases(state, os);

  async function loadReleases() {
    if (isDemo) {
      document.getElementById('demoBanner').hidden = false;
      state = { status: 'ready', releases: sampleReleases() };
    } else {
      state = { status: 'ready', releases: await fetchReleases() };
    }
    render();
  }

  setupCopyButtons();
  setupScrollRail(document.getElementById('progress'));
  setupActiveNav();
  startGlitch(glitch, reduceMotion);
  startBook({
    stage: document.querySelector('.stage'),
    pre: document.getElementById('book'),
    pageNo: document.getElementById('pageNo'),
    reduceMotion,
  });
  setupLanguage(document.getElementById('langBtn'), () => {
    syncGlitchText(glitch);
    fillTicker();
    render();
  });
  loadReleases();
})();
