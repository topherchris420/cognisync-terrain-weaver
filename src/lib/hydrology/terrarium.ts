/**
 * Mapzen Terrarium DEM encoding.
 *
 * elevation_m = (R * 256 + G + B / 256) - 32768
 *
 * Tiles: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
 */

export const TERRARIUM_TILE_SIZE = 256;
export const TERRARIUM_MAX_ZOOM = 15;
export const TERRARIUM_URL =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export function encodeTerrarium(elevationM: number): [number, number, number] {
  const encoded = Math.max(0, Math.min(65535.996, elevationM + 32768));
  const r = Math.floor(encoded / 256);
  const rem = encoded - r * 256;
  const g = Math.floor(rem);
  const b = Math.round((rem - g) * 256);
  return [r, g, Math.min(255, b)];
}

export function lngToTileX(lng: number, z: number): number {
  const n = 2 ** z;
  return ((lng + 180) / 360) * n;
}

export function latToTileY(lat: number, z: number): number {
  const clamped = Math.min(85.05112878, Math.max(-85.05112878, lat));
  const latRad = (clamped * Math.PI) / 180;
  const n = 2 ** z;
  return (
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
}

export function tileUrl(z: number, x: number, y: number): string {
  return TERRARIUM_URL.replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export function sampleTerrarium(buffer: PixelBuffer, x: number, y: number): number {
  const x0 = Math.min(buffer.width - 1, Math.max(0, Math.floor(x)));
  const y0 = Math.min(buffer.height - 1, Math.max(0, Math.floor(y)));
  const x1 = Math.min(buffer.width - 1, x0 + 1);
  const y1 = Math.min(buffer.height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const z00 = pixelElevation(buffer, x0, y0);
  const z10 = pixelElevation(buffer, x1, y0);
  const z01 = pixelElevation(buffer, x0, y1);
  const z11 = pixelElevation(buffer, x1, y1);
  const z0 = z00 * (1 - tx) + z10 * tx;
  const z1 = z01 * (1 - tx) + z11 * tx;
  return z0 * (1 - ty) + z1 * ty;
}

function pixelElevation(buffer: PixelBuffer, x: number, y: number): number {
  const i = (y * buffer.width + x) * 4;
  return decodeTerrarium(buffer.data[i], buffer.data[i + 1], buffer.data[i + 2]);
}

export function chooseTileZoom(
  west: number,
  south: number,
  east: number,
  north: number,
  maxTiles = 16
): number {
  for (let z = TERRARIUM_MAX_ZOOM; z >= 8; z -= 1) {
    const x0 = Math.floor(lngToTileX(west, z));
    const x1 = Math.floor(lngToTileX(east, z));
    const y0 = Math.floor(latToTileY(north, z));
    const y1 = Math.floor(latToTileY(south, z));
    const tiles = (x1 - x0 + 1) * (y1 - y0 + 1);
    if (tiles <= maxTiles && tiles > 0) return z;
  }
  return 8;
}

export function tilesForBBox(
  west: number,
  south: number,
  east: number,
  north: number,
  z: number
): Array<{ x: number; y: number; z: number }> {
  const n = 2 ** z;
  const x0 = Math.max(0, Math.floor(lngToTileX(west, z)));
  const x1 = Math.min(n - 1, Math.floor(lngToTileX(east, z)));
  const y0 = Math.max(0, Math.floor(latToTileY(north, z)));
  const y1 = Math.min(n - 1, Math.floor(latToTileY(south, z)));
  const tiles: Array<{ x: number; y: number; z: number }> = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      tiles.push({ x, y, z });
    }
  }
  return tiles;
}
