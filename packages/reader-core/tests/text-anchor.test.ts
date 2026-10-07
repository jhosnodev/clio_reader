import { describe, expect, it } from 'vitest';

import {
  buildTextAnchor,
  getLocatorAnchor,
  hasTextAnchor,
  normalizeQuote,
  resolveTextAnchor,
  withTextAnchor,
} from '../src/text-anchor.js';

const TEXT =
  'El comité aprobó la propuesta, así que el texto queda aquí. ' +
  'Texto repetido en medio. Texto repetido al final del capítulo.';

function anchorOf(quote: string, occurrence = 0): { start: number; end: number } {
  let start = TEXT.indexOf(quote);
  for (let i = 0; i < occurrence; i++) {
    start = TEXT.indexOf(quote, start + 1);
  }
  return { start, end: start + quote.length };
}

describe('normalizeQuote', () => {
  it('colapsa saltos de línea y espaciado del marcado', () => {
    expect(normalizeQuote('  Hola\n\n   mundo  ')).toBe('Hola mundo');
  });

  it('normaliza espaciado interno sin tocar la puntuación', () => {
    expect(normalizeQuote('capítulo  2:  el\ninicio')).toBe('capítulo 2: el inicio');
  });
});

describe('buildTextAnchor', () => {
  it('guarda offsets y contexto a ambos lados', () => {
    const { start, end } = anchorOf('queda aquí');
    const anchor = buildTextAnchor(TEXT, start, end);

    expect(anchor.start).toBe(start);
    expect(anchor.end).toBe(end);
    expect(anchor.prefix?.endsWith('el texto ')).toBe(true);
    expect(anchor.suffix?.startsWith('. Texto repetido')).toBe(true);
  });

  it('acota offsets fuera de rango', () => {
    const anchor = buildTextAnchor(TEXT, -10, TEXT.length + 50);

    expect(anchor.start).toBe(0);
    expect(anchor.end).toBe(TEXT.length);
    expect(anchor.prefix).toBeUndefined();
    expect(anchor.suffix).toBeUndefined();
  });

  it('normaliza un rango invertido', () => {
    const anchor = buildTextAnchor(TEXT, 10, 4);

    expect(anchor.start).toBe(10);
    expect(anchor.end).toBe(10);
  });
});

describe('resolveTextAnchor', () => {
  it('resuelve exacto cuando los offsets no cambiaron', () => {
    const { start, end } = anchorOf('queda aquí');
    const anchor = buildTextAnchor(TEXT, start, end);

    expect(resolveTextAnchor(TEXT, anchor, 'queda aquí')).toEqual({
      start,
      end,
      resolution: 'exact',
    });
  });

  it('resuelve exacto aunque la cita difiera en espaciado', () => {
    const { start, end } = anchorOf('queda aquí');
    const anchor = buildTextAnchor(TEXT, start, end);

    expect(resolveTextAnchor(TEXT, anchor, '  queda   aquí  ')?.resolution).toBe('exact');
  });

  it('recupera la cita cuando el texto se desplazó', () => {
    const { start, end } = anchorOf('queda aquí');
    const anchor = buildTextAnchor(TEXT, start, end);
    const conTitulo = 'Nuevo párrafo.\n' + TEXT;

    const resolved = resolveTextAnchor(conTitulo, anchor, 'queda aquí');

    expect(resolved?.resolution).toBe('recovered');
    expect(conTitulo.slice(resolved!.start, resolved!.end)).toBe('queda aquí');
  });

  it('recupera tolerando saltos de línea dentro de la cita', () => {
    const { start, end } = anchorOf('queda aquí');
    const anchor = buildTextAnchor(TEXT, start, end);
    const conSaltos = TEXT.replace('queda aquí', 'queda\n  aquí');

    expect(resolveTextAnchor(conSaltos, anchor, 'queda aquí')?.resolution).toBe('recovered');
  });

  it('recupera ignorando el contexto cuando el texto nearby también cambió', () => {
    const { start, end } = anchorOf('queda aquí');
    const anchor = buildTextAnchor(TEXT, start, end);
    const editado = TEXT.replace('aprobó la propuesta', 'rechazó la propuesta inicial');

    expect(resolveTextAnchor(editado, anchor, 'queda aquí')?.resolution).toBe('recovered');
  });

  it('desambigua citas repetidas usando el contexto', () => {
    const segunda = anchorOf('Texto repetido', 1);
    const anchor = buildTextAnchor(TEXT, segunda.start, segunda.end);

    const resolved = resolveTextAnchor(TEXT, anchor, 'Texto repetido');

    expect(resolved?.start).toBe(segunda.start);
    expect(resolved?.start).not.toBe(anchorOf('Texto repetido', 0).start);
  });

  it('devuelve null cuando la cita ya no existe', () => {
    const anchor = buildTextAnchor(TEXT, 0, 2);

    expect(resolveTextAnchor('Otro documento sin esa cita.', anchor, 'El')).toBeNull();
  });

  it('devuelve null si el ancla quedó vacío', () => {
    const anchor = buildTextAnchor(TEXT, 3, 3);

    expect(resolveTextAnchor(TEXT, anchor)).toBeNull();
  });

  it('devuelve null si una cita repetida no encaja con ningún contexto', () => {
    const segunda = anchorOf('Texto repetido', 1);
    const anchor = buildTextAnchor(TEXT, segunda.start, segunda.end);
    const otros = 'Texto repetido uno. Texto repetido dos. Texto repetido tres.';

    expect(resolveTextAnchor(otros, anchor, 'Texto repetido')).toBeNull();
  });

  it('ignora citas de un solo carácter', () => {
    const anchor = buildTextAnchor(TEXT, 0, 1);

    expect(resolveTextAnchor(TEXT, anchor, 'E')).toBeNull();
  });
});

describe('locator helpers', () => {
  it('lee y escribe el ancla en locators epub y md', () => {
    const { start, end } = anchorOf('queda aquí');
    const anchor = buildTextAnchor(TEXT, start, end);
    const epub = withTextAnchor({ format: 'epub', href: 'c1.xhtml' }, anchor);

    expect(getLocatorAnchor(epub)).toEqual(anchor);
    expect(hasTextAnchor(epub)).toBe(true);
    expect(getLocatorAnchor(withTextAnchor({ format: 'md', href: 'a.md' }, anchor))).toEqual(
      anchor,
    );
  });

  it('quita el ancla cuando se pasa undefined', () => {
    const { start, end } = anchorOf('queda aquí');
    const epub = withTextAnchor(
      withTextAnchor({ format: 'epub', href: 'c1.xhtml' }, buildTextAnchor(TEXT, start, end)),
      undefined,
    );

    expect(getLocatorAnchor(epub)).toBeUndefined();
    expect(hasTextAnchor(epub)).toBe(false);
  });

  it('ignora formatos sin anclaje de texto', () => {
    const { start, end } = anchorOf('queda aquí');
    const pdf = withTextAnchor({ format: 'pdf', page: 3 }, buildTextAnchor(TEXT, start, end));

    expect(pdf).toEqual({ format: 'pdf', page: 3 });
    expect(hasTextAnchor(pdf)).toBe(false);
  });
});
