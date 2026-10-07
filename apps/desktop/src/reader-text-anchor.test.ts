import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_NOTE_HIGHLIGHT_NAME,
  NOTE_HIGHLIGHT_NAME,
  clearNoteHighlights,
  paintActiveNoteHighlight,
  paintNoteHighlights,
} from './reader-text-anchor';

interface FakeHighlightInstance {
  readonly ranges: unknown[];
}

class FakeHighlightCtor {
  readonly ranges: unknown[];

  constructor(...ranges: unknown[]) {
    this.ranges = ranges;
  }
}

function stubHighlightApi(): Map<string, FakeHighlightInstance> {
  const registry = new Map<string, FakeHighlightInstance>();
  vi.stubGlobal('Highlight', FakeHighlightCtor);
  vi.stubGlobal('CSS', { highlights: registry });
  return registry;
}

function fakeRange(): Range {
  return { toString: () => 'texto anotado' } as unknown as Range;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('paintNoteHighlights', () => {
  it('registra el highlight en CSS.highlights, no en el global', () => {
    const registry = stubHighlightApi();
    paintNoteHighlights([fakeRange(), fakeRange()]);
    const stored = registry.get(NOTE_HIGHLIGHT_NAME);
    expect(stored).toBeDefined();
    expect(stored?.ranges).toHaveLength(2);
  });

  it('elimina el highlight cuando no hay rangos', () => {
    const registry = stubHighlightApi();
    paintNoteHighlights([fakeRange()]);
    paintNoteHighlights([]);
    expect(registry.has(NOTE_HIGHLIGHT_NAME)).toBe(false);
  });

  it('no falla si la API no existe', () => {
    vi.stubGlobal('Highlight', undefined);
    vi.stubGlobal('CSS', undefined);
    expect(() => paintNoteHighlights([fakeRange()])).not.toThrow();
  });
});

describe('paintActiveNoteHighlight', () => {
  it('registra la nota activa con su propio nombre', () => {
    const registry = stubHighlightApi();
    paintActiveNoteHighlight(fakeRange());
    expect(registry.get(ACTIVE_NOTE_HIGHLIGHT_NAME)?.ranges).toHaveLength(1);
    expect(registry.has(NOTE_HIGHLIGHT_NAME)).toBe(false);

    paintActiveNoteHighlight(null);
    expect(registry.has(ACTIVE_NOTE_HIGHLIGHT_NAME)).toBe(false);
  });
});

describe('clearNoteHighlights', () => {
  it('limpia ambos nombres', () => {
    const registry = stubHighlightApi();
    paintNoteHighlights([fakeRange()]);
    paintActiveNoteHighlight(fakeRange());
    clearNoteHighlights();
    expect(registry.size).toBe(0);
  });
});
