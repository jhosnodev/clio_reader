const IMG_SRC_RE = /<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["'][^>]*?>/gi;
const SVG_IMAGE_HREF_RE = /<image\b[^>]*?\s(?:xlink:)?href\s*=\s*["']([^"']+)["'][^>]*?>/gi;

export function extractImageSrcs(html: string): string[] {
  const srcs: string[] = [];
  let m: RegExpExecArray | null;

  const imgRe = new RegExp(IMG_SRC_RE.source, 'gi');
  while ((m = imgRe.exec(html)) !== null) {
    if (m[1]) srcs.push(m[1]);
  }

  const svgRe = new RegExp(SVG_IMAGE_HREF_RE.source, 'gi');
  while ((m = svgRe.exec(html)) !== null) {
    if (m[1]) srcs.push(m[1]);
  }

  return srcs;
}

export function replaceImgSrc(html: string, oldSrc: string, newSrc: string): string {
  const safeSrc = oldSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let result = html;

  const imgRe = new RegExp(
    `(<img\\b[^>]*?)src\\s*=\\s*["']${safeSrc}["']([^>]*?>)`,
    'gi',
  );
  result = result.replace(imgRe, `$1src="${newSrc}"$2`);

  const svgRe = new RegExp(
    `(<image\\b[^>]*?)(?:xlink:)?href\\s*=\\s*["']${safeSrc}["']([^>]*?>)`,
    'gi',
  );
  result = result.replace(svgRe, `$1href="${newSrc}"$2`);

  return result;
}

export function addFailedImgClassToSrc(html: string, src: string): string {
  const safeSrc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const imgRe = new RegExp(
    `(<img\\b[^>]*?src\\s*=\\s*["']${safeSrc}["'][^>]*?>)`,
    'gi',
  );
  let result = html.replace(imgRe, (match) => {
    if (match.includes('class=')) {
      return match.replace(/class\s*=\s*["']([^"']*)["']/, '$1 epub-img-failed"');
    }
    return match.replace(/<img\b/, '<img class="epub-img-failed"');
  });

  const svgRe = new RegExp(
    `(<image\\b[^>]*?(?:xlink:)?href\\s*=\\s*["']${safeSrc}["'][^>]*?>)`,
    'gi',
  );
  result = result.replace(svgRe, (match) => {
    if (match.includes('class=')) {
      return match.replace(/class\s*=\s*["']([^"']*)["']/, '$1 epub-img-failed"');
    }
    return match.replace(/<image\b/, '<image class="epub-img-failed"');
  });

  return result;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
