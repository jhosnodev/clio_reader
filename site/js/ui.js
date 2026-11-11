(() => {
  const ClioSite = (window.ClioSite = window.ClioSite || {});

  const { t } = ClioSite.i18n;

  const COPIED_RESET_MS = 1600;
  const NAV_SECTIONS = ['files', 'notes', 'install', 'verify'];

  function detectOS() {
    const ua = navigator.userAgent || '';
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    if (/android|iphone|ipad|ipod/i.test(ua)) return 'mobile';
    if (/win/i.test(platform) || /windows/i.test(ua)) return 'windows-exe';
    if (/mac/i.test(platform) || /mac os x/i.test(ua)) return 'mac';
    if (/linux|x11/i.test(platform) || /linux/i.test(ua)) return 'linux-appimage';
    return null;
  }

  function selectContents(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function setupCopyButtons() {
    for (const button of document.querySelectorAll('[data-copy]')) {
      button.addEventListener('click', () => {
        const pre = document.getElementById(`cp-${button.getAttribute('data-copy')}`);
        const done = () => {
          button.textContent = t('copied');
          setTimeout(() => {
            button.textContent = t('copy');
          }, COPIED_RESET_MS);
        };
        if (!navigator.clipboard) {
          selectContents(pre);
          return;
        }
        navigator.clipboard.writeText(pre.textContent).then(done, () => selectContents(pre));
      });
    }
  }

  function startGlitch(element, reduceMotion) {
    if (reduceMotion) return;
    const schedule = () => {
      setTimeout(
        () => {
          element.classList.add('is-on');
          setTimeout(() => element.classList.remove('is-on'), 160 + Math.random() * 180);
          schedule();
        },
        2600 + Math.random() * 4200,
      );
    };
    schedule();
  }

  function syncGlitchText(element) {
    element.setAttribute('data-text', element.textContent);
  }

  function setupScrollRail(rail) {
    const paint = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const percent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
      rail.style.width = `${percent.toFixed(2)}%`;
    };
    window.addEventListener('scroll', paint, { passive: true });
    window.addEventListener('resize', paint);
    paint();
  }

  function setupActiveNav() {
    if (!('IntersectionObserver' in window)) return;
    const links = [...document.querySelectorAll('.nav a')];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          for (const link of links) {
            if (link.getAttribute('href') === `#${entry.target.id}`) {
              link.setAttribute('aria-current', 'true');
            } else {
              link.removeAttribute('aria-current');
            }
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    for (const id of NAV_SECTIONS) observer.observe(document.getElementById(id));
  }

  function fillTicker() {
    const [source, clone] = document.querySelectorAll('.ticker__group');
    if (source && clone) clone.innerHTML = source.innerHTML;
  }

  ClioSite.ui = {
    fillTicker,
    detectOS,
    setupCopyButtons,
    startGlitch,
    syncGlitchText,
    setupScrollRail,
    setupActiveNav,
  };
})();
