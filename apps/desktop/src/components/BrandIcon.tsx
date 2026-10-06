import { useMemo } from 'react';

import brandSvgRaw from '../assets/brand.svg?raw';

const BRAND_SVG_CACHE = new Map<string, string>();

function colorizeBrandSvg(color: string): string {
  const cached = BRAND_SVG_CACHE.get(color);
  if (cached) return cached;
  const colored = brandSvgRaw
    .replace(/currentColor/g, color)
    .replace(/width="512"/, 'width="100%"')
    .replace(/height="512"/, 'height="100%"');
  BRAND_SVG_CACHE.set(color, colored);
  return colored;
}

export function BrandIcon({ color, size = 26 }: { color: string; size?: number }) {
  const svg = useMemo(() => colorizeBrandSvg(color), [color]);

  if (!svg) return <div style={{ width: size, height: size }} />;

  return (
    <div
      style={{
        width: size,
        height: size,
        lineHeight: 0,
        display: 'grid',
        placeItems: 'center',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
