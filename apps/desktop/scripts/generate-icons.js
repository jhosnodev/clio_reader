import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RESOURCES_DIR = join(__dirname, '..', 'resources');

if (!existsSync(RESOURCES_DIR)) {
  mkdirSync(RESOURCES_DIR, { recursive: true });
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePNG() {
  const w = 256, h = 256;
  const bgR = 59, bgG = 130, bgB = 246;

  const E = [
    0b1111111111111110,
    0b1111111111111110,
    0b1100000000000000,
    0b1100000000000000,
    0b1111111111100000,
    0b1111111111100000,
    0b1100000000000000,
    0b1100000000000000,
    0b1111111111111110,
    0b1111111111111110,
  ];
  const R = [
    0b1111111111111110,
    0b1111111111111110,
    0b1100000000011000,
    0b1100000000011000,
    0b1111111111110000,
    0b1111111111111000,
    0b1100000000110000,
    0b1100000000011000,
    0b1100000000001110,
    0b1100000000001110,
  ];

  const pixelData = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      pixelData[i] = bgR;
      pixelData[i + 1] = bgG;
      pixelData[i + 2] = bgB;
      pixelData[i + 3] = 255;
    }
  }

  const scale = 8;
  const charW = 16, charH = 10;
  const gap = 3 * scale;
  const totalW = (charW * 2 + gap) * scale;
  const startX = Math.floor((w - totalW) / 2);
  const startY = Math.floor((h - charH * scale) / 2);

  function drawChar(bitmap, ox, oy) {
    for (let row = 0; row < bitmap.length; row++) {
      const bits = bitmap[row];
      for (let col = 0; col < charW; col++) {
        if (bits & (1 << (charW - 1 - col))) {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = ox + col * scale + sx;
              const py = oy + row * scale + sy;
              if (px < w && py < h) {
                const i = (py * w + px) * 4;
                pixelData[i] = 255;
                pixelData[i + 1] = 255;
                pixelData[i + 2] = 255;
                pixelData[i + 3] = 255;
              }
            }
          }
        }
      }
    }
  }

  drawChar(E, startX, startY);
  drawChar(R, startX + charW * scale + gap, startY);

  const rawRowSize = 1 + w * 4;
  const rawData = Buffer.alloc(rawRowSize * h);
  for (let y = 0; y < h; y++) {
    rawData[y * rawRowSize] = 0;
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = y * rawRowSize + 1 + x * 4;
      rawData[di] = pixelData[si];
      rawData[di + 1] = pixelData[si + 1];
      rawData[di + 2] = pixelData[si + 2];
      rawData[di + 3] = pixelData[si + 3];
    }
  }

  const compressed = deflateSync(rawData);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

function generateICO(pngBuffer) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);  // ICO type
  header.writeUInt16LE(1, 4);  // 1 image

  const dir = Buffer.alloc(16);
  dir.writeUInt16LE(1, 4);     // planes
  dir.writeUInt16LE(32, 6);    // bpp
  dir.writeUInt32LE(pngBuffer.length, 8);
  dir.writeUInt32LE(22, 12);   // offset

  return Buffer.concat([header, dir, pngBuffer]);
}

console.log('Generating placeholder icons...');
const png = generatePNG();
writeFileSync(join(RESOURCES_DIR, 'icon.png'), png);
writeFileSync(join(RESOURCES_DIR, 'icon.ico'), generateICO(png));
console.log('Done! Generated icon.png and icon.ico in resources/');
