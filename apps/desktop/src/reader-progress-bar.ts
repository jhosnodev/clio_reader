export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function scrollRatio(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const scrollable = scrollHeight - clientHeight;
  if (scrollable <= 0) return 1;
  return clamp01(scrollTop / scrollable);
}

export function scrollTopForRatio(
  ratio: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const scrollable = scrollHeight - clientHeight;
  if (scrollable <= 0) return 0;
  return clamp01(ratio) * scrollable;
}

export function progressPercent(currentIndex: number, totalCount: number, ratio: number): number {
  if (totalCount <= 0) return 0;
  const safeIndex = Math.min(Math.max(currentIndex, 0), totalCount - 1);
  const raw = ((safeIndex + clamp01(ratio)) / totalCount) * 100;
  return Math.min(Math.max(raw, 0), 100);
}

export function formatProgressLabel(
  currentIndex: number,
  totalCount: number,
  percent: number,
): string {
  if (totalCount <= 0) return `${Math.round(percent)}%`;
  return `Cap. ${currentIndex + 1}/${totalCount} · ${Math.round(percent)}%`;
}

export function chapterIndexFromRatio(ratio: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  const raw = Math.floor(clamp01(ratio) * totalCount);
  return Math.min(Math.max(raw, 0), totalCount - 1);
}
