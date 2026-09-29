/**
 * Minimal TIFF reader for offline experiment tooling (Node only).
 *
 * Reads the single-band, uncompressed float32 rasters the USGS 3DEP
 * ImageServer returns for `format=tiff&pixelType=F32&compression=None`,
 * stored either in strips or tiles. Anything else throws.
 */
export interface FloatRaster {
  width: number;
  height: number;
  values: Float32Array;
}

export function decodeFloat32Tiff(bytes: Uint8Array): FloatRaster {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const order = String.fromCharCode(bytes[0], bytes[1]);
  if (order !== "II" && order !== "MM") throw new Error("Not a TIFF file.");
  const little = order === "II";
  const u16 = (offset: number) => view.getUint16(offset, little);
  const u32 = (offset: number) => view.getUint32(offset, little);
  const ifd = u32(4);
  const count = u16(ifd);
  const tags = new Map<number, number[]>();
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    const tag = u16(entry);
    const type = u16(entry + 2);
    const n = u32(entry + 4);
    const size = type === 3 ? 2 : 4;
    const inline = n * size <= 4;
    const base = inline ? entry + 8 : u32(entry + 8);
    const values: number[] = [];
    if (type === 3 || type === 4) {
      for (let k = 0; k < n; k += 1) values.push(type === 3 ? u16(base + k * 2) : u32(base + k * 4));
    }
    tags.set(tag, values);
  }
  const get = (tag: number) => tags.get(tag)?.[0];
  const width = get(256)!;
  const height = get(257)!;
  if (get(258) !== 32 || get(339) !== 3 || (get(259) ?? 1) !== 1 || (get(277) ?? 1) !== 1) {
    throw new Error("Only single-band uncompressed float32 TIFFs are supported.");
  }
  const values = new Float32Array(width * height);
  const tileWidth = get(322);
  const tileHeight = get(323);
  if (tileWidth && tileHeight) {
    const offsets = tags.get(324) ?? [];
    const across = Math.ceil(width / tileWidth);
    offsets.forEach((offset, index) => {
      const tx = (index % across) * tileWidth;
      const ty = Math.floor(index / across) * tileHeight;
      for (let y = 0; y < tileHeight && ty + y < height; y += 1) {
        for (let x = 0; x < tileWidth && tx + x < width; x += 1) {
          values[(ty + y) * width + tx + x] = view.getFloat32(offset + (y * tileWidth + x) * 4, little);
        }
      }
    });
  } else {
    const offsets = tags.get(273) ?? [];
    const rowsPerStrip = get(278) ?? height;
    offsets.forEach((offset, strip) => {
      for (let y = 0; y < rowsPerStrip && strip * rowsPerStrip + y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          values[(strip * rowsPerStrip + y) * width + x] = view.getFloat32(offset + (y * width + x) * 4, little);
        }
      }
    });
  }
  return { width, height, values };
}
