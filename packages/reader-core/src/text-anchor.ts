import type { ReaderLocator, TextAnchor } from '@clio-reader/domain';

/** Longitud máxima del contexto guardado a cada lado del ancla. */
export const ANCHOR_CONTEXT_LENGTH = 32;

/** Longitud mínima de una cita para considerarse un ancla válida. */
export const MIN_QUOTE_LENGTH = 2;

export type AnchorResolution = 'exact' | 'recovered' | 'missing';

export interface ResolvedAnchor {
  readonly start: number;
  readonly end: number;
  readonly resolution: AnchorResolution;
}

/**
 * Colapsa el espacio de la cita: el marcado del EPUB trae saltos de línea y
 * espaciado que no sobreviven a la comparación con el texto plano.
 */
export function normalizeQuote(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** Crea el ancla para un rango del texto del documento, con contexto a ambos lados. */
export function buildTextAnchor(text: string, start: number, end: number): TextAnchor {
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));
  const prefix = text.slice(Math.max(0, safeStart - ANCHOR_CONTEXT_LENGTH), safeStart);
  const suffix = text.slice(safeEnd, safeEnd + ANCHOR_CONTEXT_LENGTH);
  return {
    start: safeStart,
    end: safeEnd,
    ...(prefix.length > 0 ? { prefix } : {}),
    ...(suffix.length > 0 ? { suffix } : {}),
  };
}

/**
 * Recupera los offsets de un ancla sobre el texto del documento.
 *
 * `exact`: los offsets siguen apuntando a la cita.
 * `recovered`: el texto se desplazó y la cita se localizó por búsqueda.
 * `missing`: la cita ya no existe; se devuelve null para marcar posición no exacta.
 */
export function resolveTextAnchor(
  text: string,
  anchor: TextAnchor,
  quote?: string,
): ResolvedAnchor | null {
  const expected = quote ?? text.slice(anchor.start, anchor.end);
  const normalizedExpected = normalizeQuote(expected);
  if (normalizedExpected.length < MIN_QUOTE_LENGTH) return null;

  if (anchor.start >= 0 && anchor.end <= text.length && anchor.start < anchor.end) {
    if (normalizeQuote(text.slice(anchor.start, anchor.end)) === normalizedExpected) {
      return { start: anchor.start, end: anchor.end, resolution: 'exact' };
    }
  }

  const matches = findQuoteMatches(text, normalizedExpected);
  if (matches.length === 0) return null;

  const best = pickBestMatch(text, matches, anchor);
  if (best === null) return null;

  return { start: best.start, end: best.end, resolution: 'recovered' };
}

interface TextRange {
  readonly start: number;
  readonly end: number;
}

/**
 * Con una sola coincidencia la cita es inequívoca aunque el contexto haya
 * cambiado. Si se repite, el contexto decide cuál vale; sin candidatos que lo
 * respeten se devuelve null antes que apuntar a la copia equivocada.
 */
function pickBestMatch(
  text: string,
  matches: readonly TextRange[],
  anchor: TextAnchor,
): TextRange | null {
  if (matches.length === 1) return matches[0] ?? null;

  const contextual = matches.filter((match) => matchesContext(text, match, anchor));
  const first = contextual[0];
  if (first === undefined) return null;

  let best = first;
  for (const match of contextual) {
    if (Math.abs(match.start - anchor.start) < Math.abs(best.start - anchor.start)) best = match;
  }
  return best;
}

/** Busca la cita en el texto original tolerando diferencias de espaciado. */
function findQuoteMatches(text: string, normalizedQuote: string): TextRange[] {
  if (normalizedQuote.length < MIN_QUOTE_LENGTH) return [];

  const pattern = normalizedQuote
    .split(' ')
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');

  const matches: TextRange[] = [];
  for (const match of text.matchAll(new RegExp(pattern, 'g'))) {
    if (match.index === undefined) continue;
    matches.push({ start: match.index, end: match.index + match[0].length });
  }
  return matches;
}

/**
 * Una cita repetida solo vale si el contexto coincide. Sin contexto guardado
 * se acepta la coincidencia más cercana, que es el caso de anclas antiguas.
 */
function matchesContext(text: string, match: TextRange, anchor: TextAnchor): boolean {
  if (anchor.prefix !== undefined) {
    const expectedPrefix = text.slice(Math.max(0, match.start - anchor.prefix.length), match.start);
    if (expectedPrefix !== anchor.prefix) return false;
  }

  if (anchor.suffix !== undefined) {
    const expectedSuffix = text.slice(match.end, match.end + anchor.suffix.length);
    if (expectedSuffix !== anchor.suffix) return false;
  }

  return true;
}

/** Devuelve el ancla de un locator si el formato admite anclaje de texto. */
export function getLocatorAnchor(locator: ReaderLocator): TextAnchor | undefined {
  if (locator.format === 'epub' || locator.format === 'md') return locator.anchor;
  return undefined;
}

/** Añade, sustituye o quita el ancla de un locator. */
export function withTextAnchor(
  locator: ReaderLocator,
  anchor: TextAnchor | undefined,
): ReaderLocator {
  if (locator.format !== 'epub' && locator.format !== 'md') return locator;
  if (anchor === undefined) {
    const { anchor: _discarded, ...rest } = locator;
    void _discarded;
    return rest;
  }
  return { ...locator, anchor };
}

/** Indica si un locator tiene un ancla utilizable. */
export function hasTextAnchor(locator: ReaderLocator): boolean {
  const anchor = getLocatorAnchor(locator);
  return anchor !== undefined && anchor.end > anchor.start;
}
