import { describe, expect, it } from 'vitest';

import { parseMarkdown, renderInline, slugify } from '../src/markdown-parser.js';

describe('slugify', () => {
  it('normaliza a minúsculas y separa por guiones', () => {
    expect(slugify('Hola Mundo')).toBe('hola-mundo');
  });

  it('elimina signos y colapsa guiones', () => {
    expect(slugify('¿Qué es? —  Markdown!')).toBe('qué-es-markdown');
  });

  it('usa fallback cuando queda vacío', () => {
    expect(slugify('***')).toBe('seccion');
  });
});

describe('renderInline', () => {
  it('escapa HTML crudo', () => {
    expect(renderInline('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('renderiza énfasis, código y tachado', () => {
    expect(renderInline('**bold** y *italic* `code` ~~old~~')).toContain('<strong>bold</strong>');
    expect(renderInline('**bold** y *italic* `code` ~~old~~')).toContain('<em>italic</em>');
    expect(renderInline('**bold** y *italic* `code` ~~old~~')).toContain('<code>code</code>');
    expect(renderInline('**bold** y *italic* `code` ~~old~~')).toContain('<del>old</del>');
  });

  it('conserva el código inline sin interpretar su contenido', () => {
    expect(renderInline('`<b>x</b>`')).toBe('<code>&lt;b&gt;x&lt;/b&gt;</code>');
  });

  it('descarta enlaces javascript:', () => {
    expect(renderInline('[clic](javascript:alert(1))')).toBe('clic');
  });

  it('permite enlaces https', () => {
    expect(renderInline('[web](https://example.com)')).toContain('<a href="https://example.com"');
  });

  it('descarta imágenes con protocolos peligrosos', () => {
    expect(renderInline('![x](javascript:alert(1))')).toBe('x');
  });

  it('permite imágenes data:image', () => {
    expect(renderInline('![x](data:image/png;base64,AAA)')).toContain('src="data:image/png');
  });
});

describe('parseMarkdown', () => {
  it('genera secciones y TOC desde headings ATX', () => {
    const parsed = parseMarkdown('# Uno\n\ntexto\n\n## Dos\n\nmás\n\n# Tres\n');
    expect(parsed.sections).toHaveLength(3);
    expect(parsed.sections[0]!.title).toBe('Uno');
    expect(parsed.sections[0]!.html).toContain('<h1 id="uno">Uno</h1>');
    expect(parsed.toc).toHaveLength(2);
    expect(parsed.toc[0]!.title).toBe('Uno');
    expect(parsed.toc[0]!.children![0]!.title).toBe('Dos');
    expect(parsed.toc[1]!.title).toBe('Tres');
    expect(parsed.title).toBe('Uno');
  });

  it('detecta headings setext', () => {
    const parsed = parseMarkdown('Titulo\n======\n\nSub\n---\n');
    expect(parsed.sections[0]!.level).toBe(1);
    expect(parsed.sections[1]!.level).toBe(2);
  });

  it('incluye preámbulo previo al primer heading', () => {
    const parsed = parseMarkdown('intro\n\n# Uno\n');
    expect(parsed.sections[0]!.level).toBe(0);
    expect(parsed.sections[0]!.html).toContain('intro');
    expect(parsed.sections[1]!.title).toBe('Uno');
  });

  it('ignora headings dentro de bloques de código', () => {
    const parsed = parseMarkdown('# Uno\n\n```sh\n# no es heading\necho hola\n```\n');
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0]!.html).toContain('# no es heading');
  });

  it('deduplica slugs repetidos', () => {
    const parsed = parseMarkdown('# Uno\n\n# Uno\n');
    expect(parsed.sections[0]!.slug).toBe('uno');
    expect(parsed.sections[1]!.slug).toBe('uno-1');
  });

  it('renderiza listas, tablas y blockquotes', () => {
    const md = '# T\n\n- a\n- b\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n> cita\n';
    const html = parseMarkdown(md).sections[0]!.html;
    expect(html).toContain('<ul>');
    expect(html).toContain('<table>');
    expect(html).toContain('<blockquote>');
  });

  it('calcula offsets consistentes con la posición del heading', () => {
    const md = 'intro\n# Uno\n\ntexto\n';
    const parsed = parseMarkdown(md);
    const uno = parsed.sections.find((s) => s.title === 'Uno')!;
    expect(md.slice(uno.offset)).toMatch(/^# Uno/);
  });

  it('normaliza saltos de línea CRLF', () => {
    const parsed = parseMarkdown('# Uno\r\n\r\ntexto\r\n');
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0]!.html).not.toContain('\r');
  });
});
