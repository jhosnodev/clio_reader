import {
  chapterIndexFromRatio,
  clamp01,
  formatProgressLabel,
  progressPercent,
} from './reader-progress-bar';

export interface ProgressBarEvent {
  clientX?: number;
  key?: string;
  preventDefault?(): void;
}

export interface ProgressBarTrackElement {
  style: { width: string };
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: (event: ProgressBarEvent) => void): void;
  getBoundingClientRect(): { left: number; width: number };
}

export interface ProgressBarFillElement {
  style: { width: string };
}

export interface ProgressBarLabelElement {
  textContent: string | null;
}

export interface ProgressBarElements {
  readonly track: ProgressBarTrackElement;
  readonly fill: ProgressBarFillElement;
  readonly label: ProgressBarLabelElement;
}

export interface ProgressBarPosition {
  chapterIndex: number;
  chapterCount: number;
}

export interface ProgressBarOptions {
  readonly elements: ProgressBarElements;
  readonly getScrollRatio: () => number;
  readonly onSeek: (chapterIndex: number) => void;
  readonly requestFrame?: (callback: () => void) => number;
  readonly formatLabel?: (positionIndex: number, positionCount: number, percent: number) => string;
}

export interface ProgressBarController {
  setPosition(chapterIndex: number, chapterCount: number): void;
  paint(): void;
  notify(): void;
  position(): ProgressBarPosition;
}

export function createProgressBar(options: ProgressBarOptions): ProgressBarController {
  const { elements, getScrollRatio, onSeek, formatLabel } = options;
  const requestFrame =
    options.requestFrame ??
    ((callback: () => void) =>
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(() => callback())
        : (setTimeout(callback, 16) as unknown as number));

  let chapterIndex = 0;
  let chapterCount = 0;
  let pendingFrame = 0;

  const labelFor = formatLabel ?? formatProgressLabel;

  const paint = (): void => {
    const ratio = clamp01(getScrollRatio());
    const percent = progressPercent(chapterIndex, chapterCount, ratio);
    const label = labelFor(chapterIndex, chapterCount, percent);

    elements.fill.style.width = `${percent.toFixed(2)}%`;
    elements.label.textContent = label;
    elements.track.setAttribute('aria-valuenow', String(Math.round(percent)));
    elements.track.setAttribute('aria-valuetext', label);
  };

  const notify = (): void => {
    if (pendingFrame) return;
    pendingFrame = requestFrame(() => {
      pendingFrame = 0;
      paint();
    });
  };

  const ratioFromClientX = (clientX: number): number => {
    const rect = elements.track.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return clamp01((clientX - rect.left) / rect.width);
  };

  const seekTo = (chapterTarget: number): void => {
    if (chapterCount <= 0) return;
    if (chapterTarget === chapterIndex) return;
    onSeek(chapterTarget);
  };

  elements.track.addEventListener('click', (event) => {
    seekTo(chapterIndexFromRatio(ratioFromClientX(event.clientX ?? 0), chapterCount));
  });

  elements.track.addEventListener('keydown', (event) => {
    const key = event.key;
    let target: number | null = null;
    if (key === 'ArrowRight' || key === 'ArrowUp') target = chapterIndex + 1;
    else if (key === 'ArrowLeft' || key === 'ArrowDown') target = chapterIndex - 1;
    else if (key === 'Home') target = 0;
    else if (key === 'End') target = chapterCount - 1;
    if (target === null) return;
    event.preventDefault?.();
    seekTo(Math.min(Math.max(target, 0), Math.max(chapterCount - 1, 0)));
  });

  return {
    setPosition(index: number, count: number): void {
      chapterIndex = index;
      chapterCount = count;
    },
    paint,
    notify,
    position: () => ({ chapterIndex, chapterCount }),
  };
}
