/**
 * Minimal PNG decoder for offline experiment tooling (Node only).
 *
 * Supports exactly what Terrarium elevation tiles use: 8-bit, non-interlaced
 * RGB or RGBA. Output is RGBA so it matches the browser ImageData layout that
 * `sampleTerrarium` expects. Anything else throws rather than guessing.
 */
import { inflateSync } from "node:zlib";
import type { PixelBuffer } from "../../src/lib/hydrology/terrarium";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function decodePng(bytes: Uint8Array): PixelBuffer {
  if (!SIGNATURE.every((value, index) => bytes[index] === value)) {
    throw new Error("Not a PNG file.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Uint8Array[] = [];
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      const bitDepth = data[8];
      const colorType = data[9];
      const interlace = data[12];
      if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
        throw new Error(`Unsupported PNG layout (depth ${bitDepth}, colour ${colorType}, interlace ${interlace}).`);
      }
      channels = colorType === 6 ? 4 : 3;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  const compressed = new Uint8Array(idat.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of idat) {
    compressed.set(part, cursor);
    cursor += part.length;
  }
  const raw = inflateSync(compressed);
  const stride = width * channels;
  const pixels = new Uint8Array(stride * height);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)];
    const source = row * (stride + 1) + 1;
    const target = row * stride;
    for (let i = 0; i < stride; i += 1) {
      const x = raw[source + i];
      const a = i >= channels ? pixels[target + i - channels] : 0;
      const b = row > 0 ? pixels[target - stride + i] : 0;
      const c = row > 0 && i >= channels ? pixels[target - stride + i - channels] : 0;
      let value: number;
      switch (filter) {
        case 0: value = x; break;
        case 1: value = x + a; break;
        case 2: value = x + b; break;
        case 3: value = x + ((a + b) >> 1); break;
        case 4: value = x + paeth(a, b, c); break;
        default: throw new Error(`Unknown PNG filter ${filter}.`);
      }
      pixels[target + i] = value & 0xff;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p += 1) {
    rgba[p * 4] = pixels[p * channels];
    rgba[p * 4 + 1] = pixels[p * channels + 1];
    rgba[p * 4 + 2] = pixels[p * channels + 2];
    rgba[p * 4 + 3] = channels === 4 ? pixels[p * channels + 3] : 255;
  }
  return { width, height, data: rgba };
}
