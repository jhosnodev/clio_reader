import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '../assets');
mkdirSync(assetsDir, { recursive: true });

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hexToRgb(hex) {
  const v = Number.parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function drawMark(width, height, { bg, fg, ring = true }) {
  const [br, bgG, bb] = hexToRgb(bg);
  const [fr, fgG, fb] = hexToRgb(fg);
  const buf = Buffer.alloc(width * height * 4);
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.min(width, height) * 0.42;
  const inner = outer * (ring ? 0.82 : 0.0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const d = Math.hypot(x - cx, y - cy);
      const inRing = ring && d <= outer && d >= inner;
      const inDisc = !ring && d <= outer;
      let r = br;
      let g = bgG;
      let b = bb;
      if (inRing || inDisc) {
        r = fr;
        g = fgG;
        b = fb;
      }
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = 255;
    }
  }
  return encodePng(width, height, buf);
}

const files = [
  ['icon.png', 1024, 1024, { bg: '#100f18', fg: '#c9a24b', ring: true }],
  ['adaptive-icon.png', 1024, 1024, { bg: '#100f18', fg: '#c9a24b', ring: true }],
  ['favicon.png', 48, 48, { bg: '#100f18', fg: '#c9a24b', ring: true }],
  ['splash.png', 1284, 1284, { bg: '#100f18', fg: '#c9a24b', ring: true }],
];

for (const [name, w, h, opts] of files) {
  writeFileSync(resolve(assetsDir, name), drawMark(w, h, opts));
  console.log('wrote', name);
}
