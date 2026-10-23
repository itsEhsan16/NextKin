import { crc32, deflateSync } from 'node:zlib';
import type { PageImage } from '../parsing/types';

/**
 * Encodes a decoded PDF page image as an 8-bit grayscale PNG for OCR (P7-06). pdfjs hands back raw
 * pixels (1-bit, RGB or RGBA); Tesseract reads image files. Grayscale is all OCR needs, and it
 * keeps the PNG a third of the RGB size.
 */
export function toGrayPng(image: Pick<PageImage, 'width' | 'height' | 'kind' | 'data'>): Buffer {
  const { width, height, kind, data } = image;
  const gray = new Uint8Array(width * height);
  if (kind === 1) {
    // 1 bit per pixel, rows padded to a whole byte, 1 = white.
    const rowBytes = Math.ceil(width / 8);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) gray[y * width + x] = (data[y * rowBytes + (x >> 3)]! >> (7 - (x & 7))) & 1 ? 255 : 0;
  } else {
    const channels = kind === 3 ? 4 : 3;
    for (let i = 0; i < width * height; i++) {
      const o = i * channels;
      gray[i] = Math.round(0.299 * data[o]! + 0.587 * data[o + 1]! + 0.114 * data[o + 2]!);
    }
  }
  // Each row is prefixed with filter type 0 (none).
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) gray.subarray(y * width, (y + 1) * width).forEach((v, x) => (raw[y * (width + 1) + 1 + x] = v));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 0; // grayscale
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function chunk(type: string, body: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}
