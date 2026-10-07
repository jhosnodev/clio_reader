import fs from 'fs';
import JSZip from 'jszip';

// ------- replico EpubReaderDocument por lectura de fuente real -------
const src = fs.readFileSync('./packages/reader-epub/src/epub-document.ts','utf8');

// dummy: hago call a getToc sobre un proxy que emula assertOpen/open/closed
// lógica: getToc es método de clase => this.assertOpen(); return this.toc

const data = new Uint8Array(fs.readFileSync('./apps/desktop/public/files/alice.epub'));
const zip = await JSZip.loadAsync(data);

// parseamos igual que epub-parser: tomar container.xml
const container = await zip.file('META-INF/container.xml').async('string');
const opfPathMatch = container.match(/full-path="([^"]+)"/);
const opfPath = opfPathMatch?.[1];
const opf = await zip.file(opfPath).async('string');
const basePath = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/')) : '';
console.log('opf:', opfPath, 'base:', basePath);

// imito getToc binding correcto (lo que hace renderTOC con .call(doc))
function getTocFor(doc) {
  const fn = doc.getToc;
  const toc = fn.call(doc);  // con this vinculado
  return toc;
}

const readerDoc = {
  rawData: data,
  toc: null,
  chapters: null,
  async internalOpen() {
    // temperatura
  }
};

console.log('[repro] OK: script listo para verificación real de getToc');
