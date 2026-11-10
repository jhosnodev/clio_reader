import { describe, expect, it } from 'vitest';

import { computeNextVersion, formatVersion, parseVersion } from './next-version.mjs';

describe('parseVersion', () => {
  it('acepta tags con y sin prefijo v', () => {
    expect(parseVersion('v0.1.1')).toEqual({ major: 0, minor: 1, patch: 1 });
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('rechaza formatos inválidos', () => {
    expect(parseVersion('v0.1')).toBeNull();
    expect(parseVersion('release-1.2.3')).toBeNull();
    expect(parseVersion('v1.2.3-beta')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('computeNextVersion', () => {
  it('sin tags parte de la versión base y suma uno al patch', () => {
    expect(computeNextVersion([], '0.1.0')).toBe('v0.1.1');
  });

  it('incrementa el patch del tag más alto', () => {
    expect(computeNextVersion(['v0.1.1'], '0.1.0')).toBe('v0.1.2');
    expect(computeNextVersion(['v0.1.1', 'v0.1.2', 'v0.1.3'], '0.1.0')).toBe('v0.1.4');
  });

  it('ordena tags por semver, no lexicográficamente', () => {
    expect(computeNextVersion(['v0.1.9', 'v0.1.10'], '0.1.0')).toBe('v0.1.11');
    expect(computeNextVersion(['v0.1.10', 'v0.2.0', 'v0.1.9'], '0.1.0')).toBe('v0.2.1');
  });

  it('ignora tags malformados', () => {
    expect(computeNextVersion(['v0.1.1', 'otro-tag'], '0.1.0')).toBe('v0.1.2');
  });

  it('nunca reutiliza un tag existente', () => {
    expect(computeNextVersion(['v0.1.1', 'v0.1.2'], '0.1.1')).toBe('v0.1.3');
  });

  it('usa la versión base como mínimo cuando supera a los tags', () => {
    expect(computeNextVersion(['v0.1.1'], '0.1.5')).toBe('v0.1.6');
  });

  it('lanza con una versión base inválida', () => {
    expect(() => computeNextVersion([], 'no-es-version')).toThrow('Versión base inválida');
  });
});

describe('formatVersion', () => {
  it('normaliza a prefijo v', () => {
    expect(formatVersion({ major: 1, minor: 0, patch: 0 })).toBe('v1.0.0');
  });
});
