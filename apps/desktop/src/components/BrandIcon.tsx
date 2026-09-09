import { useEffect, useState } from 'react';

const BRAND_SVG_CACHE = new Map<string, string>();

export function BrandIcon({ color, size = 26 }: { color: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(() => BRAND_SVG_CACHE.get(color) ?? null);

  useEffect(() => {
    if (BRAND_SVG_CACHE.has(color)) {
      setSvg(BRAND_SVG_CACHE.get(color)!);
      return;
    }
    fetch('/brand.svg')
      .then(r => r.text())
      .then(raw => {
        const colored = raw
          .replace(/currentColor/g, color)
          .replace(/width="512"/, 'width="100%"')
          .replace(/height="512"/, 'height="100%"');
        BRAND_SVG_CACHE.set(color, colored);
        setSvg(colored);
      });
  }, [color]);

  if (!svg) return <div style={{ width: size, height: size }} />;

  return (
    <div
      style={{ width: size, height: size, lineHeight: 0, display: 'grid', placeItems: 'center' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
