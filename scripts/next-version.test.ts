import { describe, expect, it } from 'vitest';

import {
  computeNextVersion,
  formatVersion,
  parseRemoteTags,
  parseVersion,
} from './next-version.mjs';

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

describe('parseRemoteTags', () => {
  it('lee la columna de ref de git ls-remote (no el sha)', () => {
    const output = [
      '4c371b68d927e5894ede377e9722008f1a89790a\trefs/tags/v0.1.1',
      'fcf1f3da89f61a43acde3cad6a2b59044111ba02\trefs/tags/v0.1.1^{}',
      '5ec518a78caab2fba8398c9d7b7046d839676b24\trefs/tags/v0.1.0',
    ].join('\n');
    expect(parseRemoteTags(output)).toEqual(['v0.1.1', 'v0.1.0']);
  });

  it('ignora líneas sin ref de tag', () => {
    expect(parseRemoteTags('abc\trefs/heads/main\n\n')).toEqual([]);
  });
});
