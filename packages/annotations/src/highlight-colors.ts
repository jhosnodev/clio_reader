export const HIGHLIGHT_COLOR_KEYS = [
  'yellow',
  'green',
  'blue',
  'pink',
  'orange',
  'purple',
] as const;

export type HighlightColorKey = (typeof HIGHLIGHT_COLOR_KEYS)[number];

export const HIGHLIGHT_COLORS: Readonly<Record<HighlightColorKey, string>> = {
  yellow: '#facc15',
  green: '#4ade80',
  blue: '#38bdf8',
  pink: '#f472b6',
  orange: '#fb923c',
  purple: '#c084fc',
};

const BY_COLOR = new Map<string, HighlightColorKey>(
  HIGHLIGHT_COLOR_KEYS.map((key) => [HIGHLIGHT_COLORS[key], key]),
);

export function isHighlightColor(value: unknown): value is string {
  return typeof value === 'string' && BY_COLOR.has(value);
}

export function highlightColorKey(color: string): HighlightColorKey | null {
  return BY_COLOR.get(color) ?? null;
}

export function highlightRegistryName(color: string): string | null {
  const key = highlightColorKey(color);
  return key ? `clio-hl-${key}` : null;
}
