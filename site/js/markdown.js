(() => {
  const ClioSite = (window.ClioSite = window.ClioSite || {});

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function safeUrl(url) {
    return /^https:\/\//i.test(url ?? '') ? escapeHtml(url) : '#';
  }

  function inlineMarkdown(text) {
    return escapeHtml(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
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
        html.push(`<li><span>${inlineMarkdown(line.replace(/^\s*[-*]\s+/, ''))}</span></li>`);
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

  ClioSite.markdown = { escapeHtml, safeUrl, renderMarkdown };
})();
