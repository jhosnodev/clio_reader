const REPO = 'jhosnodev/echo_reader';
const API_URL = `https://api.github.com/repos/${REPO}/releases?per_page=30`;

const PLATFORMS = [
  {
    id: 'linux-appimage',
    label: 'Linux AppImage',
    hint: 'Ejecutable sin instalación (x64)',
    match: (name) => name.toLowerCase().endsWith('.appimage'),
  },
  {
    id: 'linux-deb',
    label: 'Linux DEB',
    hint: 'Debian, Ubuntu y derivadas (x64)',
    match: (name) => name.toLowerCase().endsWith('.deb'),
  },
  {
    id: 'windows-exe',
    label: 'Windows EXE',
    hint: 'Instalador NSIS (x64)',
    match: (name) => name.toLowerCase().endsWith('.exe'),
  },
];

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

function renderMarkdown(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const html = [];
  let inList = false;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,4}\s+/.test(line)) {
      flushParagraph();
      closeList();
      const level = Math.min(4, line.match(/^#+/)[0].length + 1);
      html.push(`<h${level}>${inlineMarkdown(line.replace(/^#{1,4}\s+/, ''))}</h${level}>`);
    } else if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
    } else if (line.trim() === '') {
      flushParagraph();
      closeList();
    } else {
      closeList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  closeList();
  return html.join('\n');
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function setStatus(kind, text) {
  const status = document.getElementById('status');
  status.className = `status status--${kind}`;
  status.textContent = text;
  status.hidden = kind === 'hidden';
}

function findAsset(release, matcher) {
  return (release.assets ?? []).find((asset) => matcher(asset.name)) ?? null;
}

function renderPlatform(platform, asset, releaseTag) {
  const card = document.createElement('div');
  card.className = 'platform';
  if (!asset) {
    card.classList.add('platform--unavailable');
    card.innerHTML = `
      <h3>${platform.label}</h3>
      <p class="muted">${platform.hint}</p>
      <p class="availability">No disponible en ${escapeHtml(releaseTag)}</p>
    `;
    return card;
  }
  card.innerHTML = `
    <h3>${platform.label}</h3>
    <p class="muted">${platform.hint}</p>
    <a class="btn" href="${asset.browser_download_url}" download>
      Descargar · ${(asset.size / (1024 * 1024)).toFixed(1)} MB
    </a>
  `;
  return card;
}

function renderLatest(release) {
  const panel = document.getElementById('latest');
  document.getElementById('latest-version').textContent = `Versión ${release.tag_name}`;
  document.getElementById('latest-date').textContent =
    `Publicada el ${formatDate(release.published_at)}`;
  document.getElementById('latest-notes').innerHTML = renderMarkdown(release.body);

  const platforms = document.getElementById('platforms');
  platforms.innerHTML = '';
  for (const platform of PLATFORMS) {
    platforms.appendChild(
      renderPlatform(platform, findAsset(release, platform.match), release.tag_name),
    );
  }

  const checksum = findAsset(release, (name) => name === 'SHA256SUMS.txt');
  const checksumLine = document.getElementById('checksum-line');
  if (checksum) {
    document.getElementById('checksum-link').href = checksum.browser_download_url;
    checksumLine.hidden = false;
  } else {
    checksumLine.hidden = true;
  }

  panel.hidden = false;
}

function renderHistory(releases) {
  if (releases.length === 0) return;
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  for (const release of releases) {
    const item = document.createElement('li');
    const assets = (release.assets ?? [])
      .map(
        (asset) => `<a href="${asset.browser_download_url}" download>${escapeHtml(asset.name)}</a>`,
      )
      .join(' · ');
    item.innerHTML = `
      <div class="history-head">
        <strong>${escapeHtml(release.tag_name)}</strong>
        <span class="muted">${formatDate(release.published_at)}</span>
      </div>
      <div class="history-assets">${assets || '<span class="muted">Sin archivos</span>'}</div>
    `;
    list.appendChild(item);
  }
  document.getElementById('history').hidden = false;
}

function showUnavailable() {
  document.getElementById('unavailable').hidden = false;
  document.getElementById('latest').hidden = true;
  document.getElementById('history').hidden = true;
}

async function load() {
  setStatus('loading', 'Consultando releases…');
  try {
    const response = await fetch(API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const releases = await response.json();
    const published = Array.isArray(releases) ? releases.filter((release) => !release.draft) : [];

    if (published.length === 0) {
      setStatus('hidden', '');
      showUnavailable();
      return;
    }

    const [latest, ...rest] = published;
    setStatus('hidden', '');
    renderLatest(latest);
    renderHistory(rest);
  } catch {
    setStatus('hidden', '');
    showUnavailable();
  }
}

load();
