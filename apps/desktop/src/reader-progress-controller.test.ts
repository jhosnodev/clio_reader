import { describe, expect, it } from 'vitest';
import { createProgressBar } from './reader-progress-controller';
import type {
  ProgressBarController,
  ProgressBarElements,
  ProgressBarEvent,
} from './reader-progress-controller';

interface FakeTrack {
  readonly style: { width: string };
  readonly attributes: Map<string, string>;
  rect: { left: number; width: number };
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: (event: ProgressBarEvent) => void): void;
  getBoundingClientRect(): { left: number; width: number };
  click(clientX: number): void;
  press(key: string): void;
}

function makeTrack(rect: { left: number; width: number } = { left: 0, width: 1000 }): FakeTrack {
  const listeners = new Map<string, (event: ProgressBarEvent) => void>();
  return {
    style: { width: '' },
    attributes: new Map<string, string>(),
    rect,
    setAttribute(name, value) {
      this.attributes.set(name, value);
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    getBoundingClientRect() {
      return this.rect;
    },
    click(clientX) {
      listeners.get('click')?.({ clientX });
    },
    press(key) {
      listeners.get('keydown')?.({ key, preventDefault: () => {} });
    },
  };
}

interface Harness {
  readonly controller: ProgressBarController;
  readonly track: FakeTrack;
  readonly seeks: number[];
  readonly frames: Array<() => void>;
  setRatio(ratio: number): void;
  runFrame(): void;
  pendingFrames(): number;
  fillWidth(): string;
  labelText(): string | null;
  ariaNow(): string | undefined;
  ariaText(): string | undefined;
}

function build(
  options: {
    chapterCount?: number;
    chapterIndex?: number;
    rect?: { left: number; width: number };
  } = {},
): Harness {
  const track = makeTrack(options.rect);
  const seeks: number[] = [];
  const frames: Array<() => void> = [];
  let ratio = 0;

  const elements: ProgressBarElements = {
    track,
    fill: { style: track.style },
    label: { textContent: '' },
  };

  const controller = createProgressBar({
    elements,
    getScrollRatio: () => ratio,
    onSeek: (index) => {
      seeks.push(index);
    },
    requestFrame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
  });

  controller.setPosition(options.chapterIndex ?? 0, options.chapterCount ?? 0);
  controller.paint();

  return {
    controller,
    track,
    seeks,
    frames,
    setRatio(value) {
      ratio = value;
    },
    runFrame() {
      frames.shift()?.();
    },
    pendingFrames() {
      return frames.length;
    },
    fillWidth: () => track.style.width,
    labelText: () => elements.label.textContent,
    ariaNow: () => track.attributes.get('aria-valuenow'),
    ariaText: () => track.attributes.get('aria-valuetext'),
  };
}

describe('createProgressBar paint', () => {
  it('fills the bar and labels the chapter on open', () => {
    const h = build({ chapterCount: 10, chapterIndex: 0 });
    expect(h.fillWidth()).toBe('0.00%');
    expect(h.labelText()).toBe('Cap. 1/10 · 0%');
  });

  it('moves the fill as the reader scrolls within the chapter', () => {
    const h = build({ chapterCount: 10, chapterIndex: 4 });
    expect(h.fillWidth()).toBe('40.00%');

    h.setRatio(0.5);
    h.controller.paint();
    expect(h.fillWidth()).toBe('45.00%');

    h.setRatio(1);
    h.controller.paint();
    expect(h.fillWidth()).toBe('50.00%');
  });

  it('mirrors the fill into aria-valuenow and aria-valuetext', () => {
    const h = build({ chapterCount: 4, chapterIndex: 1 });
    expect(h.ariaNow()).toBe('25');
    expect(h.ariaText()).toBe('Cap. 2/4 · 25%');
  });

  it('stays at zero when the document reports no chapters', () => {
    const h = build({ chapterCount: 0, chapterIndex: 0 });
    expect(h.fillWidth()).toBe('0.00%');
    expect(h.labelText()).toBe('0%');
  });

  it('tracks a single-chapter book through scroll alone', () => {
    const h = build({ chapterCount: 1, chapterIndex: 0 });
    h.setRatio(0.75);
    h.controller.paint();
    expect(h.fillWidth()).toBe('75.00%');
  });

  it('does not seek or mutate state on its own', () => {
    const h = build({ chapterCount: 10, chapterIndex: 3 });
    h.controller.paint();
    expect(h.seeks).toEqual([]);
    expect(h.controller.position()).toEqual({ chapterIndex: 3, chapterCount: 10 });
  });
});

describe('createProgressBar notify', () => {
  it('defers the repaint to the next frame', () => {
    const h = build({ chapterCount: 10, chapterIndex: 0 });
    h.controller.notify();
    expect(h.pendingFrames()).toBe(1);
    expect(h.fillWidth()).toBe('0.00%');
  });

  it('applies the pending scroll ratio when the frame runs', () => {
    const h = build({ chapterCount: 10, chapterIndex: 0 });
    h.setRatio(0.5);
    h.controller.notify();
    h.runFrame();
    expect(h.fillWidth()).toBe('5.00%');
  });

  it('coalesces a burst of scroll events into a single frame', () => {
    const h = build({ chapterCount: 10, chapterIndex: 0 });
    h.controller.notify();
    h.controller.notify();
    h.controller.notify();
    expect(h.pendingFrames()).toBe(1);

    h.runFrame();
    expect(h.pendingFrames()).toBe(0);
  });

  it('accepts new events after a frame has run', () => {
    const h = build({ chapterCount: 10, chapterIndex: 0 });
    h.controller.notify();
    h.runFrame();
    h.controller.notify();
    expect(h.pendingFrames()).toBe(1);
  });
});

describe('createProgressBar click to seek', () => {
  it('seeks to the chapter owning the clicked position', () => {
    const h = build({ chapterCount: 10, chapterIndex: 0 });
    h.track.click(500);
    expect(h.seeks).toEqual([5]);
  });

  it('seeks to the last chapter from the far right edge', () => {
    const h = build({ chapterCount: 10, chapterIndex: 0 });
    h.track.click(1000);
    expect(h.seeks).toEqual([9]);
  });

  it('does not seek when clicking inside the current chapter', () => {
    const h = build({ chapterCount: 10, chapterIndex: 0 });
    h.track.click(10);
    expect(h.seeks).toEqual([]);
  });

  it('does not seek without chapters', () => {
    const h = build({ chapterCount: 0, chapterIndex: 0 });
    h.track.click(500);
    expect(h.seeks).toEqual([]);
  });

  it('accounts for the track offset within the viewport', () => {
    const h = build({ chapterCount: 10, chapterIndex: 0, rect: { left: 200, width: 1000 } });
    h.track.click(700);
    expect(h.seeks).toEqual([5]);
  });

  it('ignores clicks while the track has no width', () => {
    const h = build({ chapterCount: 10, chapterIndex: 0, rect: { left: 0, width: 0 } });
    h.track.click(500);
    expect(h.seeks).toEqual([]);
  });

  it('clamps clicks past the right edge', () => {
    const h = build({ chapterCount: 10, chapterIndex: 0 });
    h.track.click(5000);
    expect(h.seeks).toEqual([9]);
  });
});

describe('createProgressBar keyboard', () => {
  it('steps forward and back with arrows', () => {
    const h = build({ chapterCount: 10, chapterIndex: 4 });
    h.track.press('ArrowRight');
    h.track.press('ArrowLeft');
    expect(h.seeks).toEqual([5, 3]);
  });

  it('supports the vertical arrows too', () => {
    const h = build({ chapterCount: 10, chapterIndex: 4 });
    h.track.press('ArrowUp');
    h.track.press('ArrowDown');
    expect(h.seeks).toEqual([5, 3]);
  });

  it('jumps to the first and last chapter', () => {
    const h = build({ chapterCount: 10, chapterIndex: 4 });
    h.track.press('Home');
    h.track.press('End');
    expect(h.seeks).toEqual([0, 9]);
  });

  it('clamps at both ends instead of overshooting', () => {
    const last = build({ chapterCount: 10, chapterIndex: 9 });
    last.track.press('ArrowRight');
    expect(last.seeks).toEqual([]);

    const first = build({ chapterCount: 10, chapterIndex: 0 });
    first.track.press('ArrowLeft');
    expect(first.seeks).toEqual([]);
  });

  it('ignores unrelated keys', () => {
    const h = build({ chapterCount: 10, chapterIndex: 4 });
    h.track.press('a');
    h.track.press('Enter');
    h.track.press('Tab');
    expect(h.seeks).toEqual([]);
  });

  it('does nothing without chapters', () => {
    const h = build({ chapterCount: 0, chapterIndex: 0 });
    h.track.press('ArrowRight');
    h.track.press('End');
    expect(h.seeks).toEqual([]);
  });
});
