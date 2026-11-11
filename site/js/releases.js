(() => {
  const ClioSite = (window.ClioSite = window.ClioSite || {});

  const { getLang, t } = ClioSite.i18n;
  const { escapeHtml, renderMarkdown, safeUrl } = ClioSite.markdown;

  const REPO = 'jhosnodev/clio_reader';
  const API_URL = `https://api.github.com/repos/${REPO}/releases?per_page=30`;
  const CHECKSUM_FILE = 'SHA256SUMS.txt';

  const PLATFORMS = [
    { id: 'windows-exe', match: (name) => /\.exe$/i.test(name) },
    { id: 'linux-appimage', match: (name) => /\.appimage$/i.test(name) },
    { id: 'linux-deb', match: (name) => /\.deb$/i.test(name) },
  ];

  const byId = (id) => document.getElementById(id);

  async function fetchReleases() {
    try {
      const response = await fetch(API_URL, { headers: { Accept: 'application/vnd.github+json' } });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const list = await response.json();
      return Array.isArray(list) ? list.filter((release) => !release.draft) : [];
    } catch {
      return [];
    }
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(getLang(), {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  }

  function formatSize(bytes) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function findAsset(release, matcher) {
    return (release.assets ?? []).find((asset) => matcher(asset.name)) ?? null;
  }

  function platformMatcher(id) {
    return PLATFORMS.find((platform) => platform.id === id)?.match;
  }

  function setSectionsVisible(visible) {
    byId('notes').hidden = !visible;
    byId('notesBand').hidden = !visible;
  }

  function renderOsNote(os) {
    const note = byId('osNote');
    if (os === 'mac' || os === 'mobile') {
      note.textContent = os === 'mac' ? t('osMac') : t('osMobile');
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  }

  function renderHeroFallback() {
    byId('heroBtn').href = '#files';
    byId('heroBtnText').textContent = t('allFiles');
  }

  function renderHero(latest, os) {
    byId('heroStatus').innerHTML =
      `<span class="on">${escapeHtml(latest.tag_name)}</span>` +
      `<span>${escapeHtml(t('published'))} ${escapeHtml(formatDate(latest.published_at))}</span>`;
    byId('readout').textContent = latest.tag_name;

    const matcher = platformMatcher(os);
    const recommended = matcher ? findAsset(latest, matcher) : null;
    if (!recommended) {
      renderHeroFallback();
      return;
    }
    byId('heroBtn').href = safeUrl(recommended.browser_download_url);
    byId('heroBtnText').innerHTML =
      `${escapeHtml(`${t('heroFor')} ${t('platforms')[os].os}`)} ` +
      `<b>· ${escapeHtml(formatSize(recommended.size))}</b>`;
  }

  function renderPlatformCard(platform, release, os) {
    const asset = findAsset(release, platform.match);
    const copy = t('platforms')[platform.id];
    const isRecommended = platform.id === os;
    const chip = isRecommended
      ? `<span class="chip"><i></i>${escapeHtml(t('recommended'))}</span>`
      : '';
    const top = `<div class="plat__top"><span>${escapeHtml(copy.os)}</span>${chip}</div>`;
    const head =
      `<h3>${escapeHtml(copy.kind)}<small>${escapeHtml(copy.hint)}</small></h3>` +
      `<p>${escapeHtml(copy.desc)}</p>`;

    if (!asset) {
      return `<article class="plat is-off">${top}${head}<span class="off-msg">${escapeHtml(t('notIn'))}</span></article>`;
    }
    return (
      `<article class="plat${isRecommended ? ' is-rec' : ''}">${top}${head}` +
      `<dl><div><dt>${escapeHtml(t('file'))}</dt><dd>${escapeHtml(asset.name)}</dd></div>` +
      `<div><dt>${escapeHtml(t('size'))}</dt><dd>${escapeHtml(formatSize(asset.size))}</dd></div></dl>` +
      `<a class="btn" href="${safeUrl(asset.browser_download_url)}" rel="noopener">` +
      `<span aria-hidden="true">↓</span>${escapeHtml(t('download'))}</a></article>`
    );
  }

  function renderHeaderButtons(latest, os) {
    for (const button of document.querySelectorAll('.hbtn[data-platform]')) {
      const id = button.getAttribute('data-platform');
      const matcher = platformMatcher(id);
      const asset = latest && matcher ? findAsset(latest, matcher) : null;
      button.href = asset ? safeUrl(asset.browser_download_url) : '#files';
      button.classList.toggle('is-rec', id === os);
      const label = `${t('heroFor')} ${t('platforms')[id].os}`;
      button.setAttribute('aria-label', asset ? `${label} · ${formatSize(asset.size)}` : label);
    }
  }

  function renderFiles(latest, os) {
    byId('filesSub').textContent = `${t('latest')} · ${latest.tag_name}`;
    byId('plats').innerHTML = PLATFORMS.map((platform) =>
      renderPlatformCard(platform, latest, os),
    ).join('');

    const checksum = findAsset(latest, (name) => name === CHECKSUM_FILE);
    byId('sums').hidden = !checksum;
    if (checksum) byId('sumsLink').href = safeUrl(checksum.browser_download_url);

    for (const platform of PLATFORMS) {
      const asset = findAsset(latest, platform.match);
      if (!asset) continue;
      for (const el of document.querySelectorAll(`[data-asset="${platform.id}"]`)) {
        el.textContent = asset.name;
      }
    }
  }

  function renderNotes(latest) {
    byId('relTag').textContent = latest.tag_name;
    byId('relDate').textContent = `${t('published')} ${formatDate(latest.published_at)}`;
    if (latest.html_url) byId('relLink').href = safeUrl(latest.html_url);
    const body = renderMarkdown(latest.body);
    byId('relBody').innerHTML = body || `<p class="empty">${escapeHtml(t('noNotes'))}</p>`;
  }

  function renderHistory(releases) {
    byId('history').hidden = releases.length === 0;
    byId('hist').innerHTML = releases
      .map((release) => {
        const files = (release.assets ?? [])
          .map(
            (asset) =>
              `<a href="${safeUrl(asset.browser_download_url)}" rel="noopener">${escapeHtml(asset.name)}</a>`,
          )
          .join('');
        return (
          `<li><b>${escapeHtml(release.tag_name)}</b>` +
          `<span>${escapeHtml(formatDate(release.published_at))}</span>` +
          `<div>${files || `<span>${escapeHtml(t('noFiles'))}</span>`}</div></li>`
        );
      })
      .join('');
  }

  function renderUnavailable() {
    byId('plats').innerHTML = '';
    byId('sums').hidden = true;
    byId('unav').hidden = false;
    byId('history').hidden = true;
    setSectionsVisible(false);
    byId('heroStatus').innerHTML = `<span>${escapeHtml(t('notFound'))}</span>`;
    byId('readout').textContent = '—';
    renderHeroFallback();
  }

  function renderReleases(state, os) {
    renderOsNote(os);

    if (state.status === 'loading') {
      byId('heroStatus').innerHTML = `<span>${escapeHtml(t('loading'))}</span>`;
      byId('readout').textContent = '…';
      return;
    }

    const [latest, ...rest] = state.releases;
    renderHeaderButtons(latest, os);
    if (!latest) {
      renderUnavailable();
      return;
    }

    byId('unav').hidden = true;
    setSectionsVisible(true);
    renderHero(latest, os);
    renderFiles(latest, os);
    renderNotes(latest);
    renderHistory(rest);
  }

  function sampleReleases() {
    const base = `https://github.com/${REPO}/releases/download/`;
    return [
      {
        tag_name: 'v0.1.0',
        published_at: '2026-11-03T15:00:00Z',
        html_url: `https://github.com/${REPO}/releases`,
        body: '## Highlights\n- **Annotations**: notes anchored to the text and highlights in 6 colors (EPUB/MD).\n- **Export** notes and highlights per book as Markdown.\n- **Zen mode** hides the bars and widens the page.\n\nSample notes for previewing the layout.',
        assets: [
          {
            name: 'Clio-Reader-Setup-0.1.0.exe',
            size: 88604672,
            browser_download_url: `${base}v0.1.0/Clio-Reader-Setup-0.1.0.exe`,
          },
          {
            name: 'Clio-Reader-0.1.0.AppImage',
            size: 112197632,
            browser_download_url: `${base}v0.1.0/Clio-Reader-0.1.0.AppImage`,
          },
          {
            name: 'clio-reader_0.1.0_amd64.deb',
            size: 79691776,
            browser_download_url: `${base}v0.1.0/clio-reader_0.1.0_amd64.deb`,
          },
          {
            name: CHECKSUM_FILE,
            size: 312,
            browser_download_url: `${base}v0.1.0/${CHECKSUM_FILE}`,
          },
        ],
      },
      {
        tag_name: 'v0.0.9',
        published_at: '2026-10-12T15:00:00Z',
        body: '',
        assets: [
          {
            name: 'Clio-Reader-Setup-0.0.9.exe',
            size: 86000000,
            browser_download_url: `${base}v0.0.9/Clio-Reader-Setup-0.0.9.exe`,
          },
          {
            name: 'Clio-Reader-0.0.9.AppImage',
            size: 109000000,
            browser_download_url: `${base}v0.0.9/Clio-Reader-0.0.9.AppImage`,
          },
        ],
      },
    ];
  }

  ClioSite.releases = { PLATFORMS, fetchReleases, renderReleases, sampleReleases };
})();
