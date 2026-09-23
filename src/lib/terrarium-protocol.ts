/**
 * Terrarium tiles cleaned up for display. The storm model reads its own,
 * untouched DEM (see hydrology/terrarium); nothing here feeds a number.
 *
 * - Sea floor lifted to sea level. Terrarium merges bathymetry into the land
 *   DEM: under an exaggerated mesh a 15 m harbor channel becomes a trench,
 *   and where lidar water surfaces meet coarse bathymetry any floor below
 *   zero leaves a straight step across the harbor.
 * - Building spikes shaved. Outside bare-earth lidar, and even inside it in
 *   places, towers survive in the DEM as narrow spikes. Exaggerated they
 *   become cones, and MapLibre seats each extruded building on the ground
 *   under its centroid, so a tower on its own spike floats.
 */
export const TERRARIUM_PROTOCOL = "terrarium-sealevel";
export const SEA_FLOOR_M = 0;
/** A spike has to stand this far above its surroundings to be shaved. */
export const SPIKE_THRESHOLD_M = 6;
/** Features narrower than this are building-sized, not landform-sized. */
const SPIKE_FOOTPRINT_M = 70;
const MAX_SPIKE_RADIUS_PX = 12;

const TERRARIUM_OFFSET = 32768;

export function decodeTerrarium(pixels: Uint8ClampedArray): Float32Array {
  const heights = new Float32Array(pixels.length / 4);
  for (let index = 0; index < heights.length; index += 1) {
    const offset = index * 4;
    heights[index] =
      pixels[offset] * 256 +
      pixels[offset + 1] +
      pixels[offset + 2] / 256 -
      TERRARIUM_OFFSET;
  }
  return heights;
}

export function encodeTerrarium(heights: Float32Array, pixels: Uint8ClampedArray) {
  for (let index = 0; index < heights.length; index += 1) {
    const value = Math.min(65535.99, Math.max(0, heights[index] + TERRARIUM_OFFSET));
    const whole = Math.floor(value);
    const offset = index * 4;
    pixels[offset] = whole >> 8;
    pixels[offset + 1] = whole & 255;
    pixels[offset + 2] = Math.floor((value - whole) * 256);
  }
}

/**
 * Sliding-window min or max along every row or column, van Herk / Gil-Werman:
 * block-wise prefix and suffix extremes give each window in two lookups,
 * whatever its width. Windows are truncated at the tile edge.
 */
function slidingExtreme(
  source: Float32Array,
  target: Float32Array,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
  max: boolean
) {
  const lines = horizontal ? height : width;
  const length = horizontal ? width : height;
  const windowSize = 2 * radius + 1;
  const padded = Math.ceil((length + 2 * radius) / windowSize) * windowSize;
  const fill = max ? -Infinity : Infinity;
  const values = new Float32Array(padded);
  const prefix = new Float32Array(padded);
  const suffix = new Float32Array(padded);
  const stride = horizontal ? 1 : width;
  for (let line = 0; line < lines; line += 1) {
    const base = horizontal ? line * width : line;
    values.fill(fill);
    for (let position = 0; position < length; position += 1) {
      values[position + radius] = source[base + position * stride];
    }
    for (let start = 0; start < padded; start += windowSize) {
      const end = start + windowSize - 1;
      prefix[start] = values[start];
      for (let cursor = start + 1; cursor <= end; cursor += 1) {
        const a = prefix[cursor - 1];
        const b = values[cursor];
        prefix[cursor] = max ? (a > b ? a : b) : a < b ? a : b;
      }
      suffix[end] = values[end];
      for (let cursor = end - 1; cursor >= start; cursor -= 1) {
        const a = suffix[cursor + 1];
        const b = values[cursor];
        suffix[cursor] = max ? (a > b ? a : b) : a < b ? a : b;
      }
    }
    for (let position = 0; position < length; position += 1) {
      const a = suffix[position];
      const b = prefix[position + 2 * radius];
      target[base + position * stride] = max ? (a > b ? a : b) : a < b ? a : b;
    }
  }
}

/**
 * Morphological opening (erode, then dilate) finds the ground a feature
 * narrower than the window stands on. Only pixels well above that ground
 * are replaced, so hills, ridges and wide embankments keep their shape.
 */
export function shaveSpikes(
  heights: Float32Array,
  width: number,
  height: number,
  radius: number,
  threshold: number = SPIKE_THRESHOLD_M
): number {
  if (radius < 1) return 0;
  const scratch = new Float32Array(heights.length);
  const opened = new Float32Array(heights.length);
  slidingExtreme(heights, scratch, width, height, radius, true, false);
  slidingExtreme(scratch, opened, width, height, radius, false, false);
  slidingExtreme(opened, scratch, width, height, radius, true, true);
  slidingExtreme(scratch, opened, width, height, radius, false, true);
  let shaved = 0;
  for (let index = 0; index < heights.length; index += 1) {
    if (heights[index] - opened[index] > threshold) {
      heights[index] = opened[index];
      shaved += 1;
    }
  }
  return shaved;
}

/** Window radius that spans a building footprint at this tile's resolution. */
export function spikeRadiusForTile(z: number, y: number, tileSize = 256): number {
  const n = Math.PI - (2 * Math.PI * (y + 0.5)) / 2 ** z;
  const latitude = Math.atan(Math.sinh(n));
  const metersPerPixel =
    (40_075_016.686 * Math.cos(latitude)) / (tileSize * 2 ** z);
  const radius = Math.ceil(SPIKE_FOOTPRINT_M / 2 / metersPerPixel);
  return Math.min(MAX_SPIKE_RADIUS_PX, Math.max(1, radius));
}

export function cleanTerrariumHeights(
  heights: Float32Array,
  width: number,
  height: number,
  spikeRadius: number
) {
  for (let index = 0; index < heights.length; index += 1) {
    if (heights[index] < SEA_FLOOR_M) heights[index] = SEA_FLOOR_M;
  }
  shaveSpikes(heights, width, height, spikeRadius);
}

type ProtocolResponse = { data: ArrayBuffer | ImageBitmap };

function tileCoordinates(url: string): { z: number; y: number } | null {
  const match = /\/(\d+)\/(\d+)\/(\d+)\.png/.exec(url);
  return match ? { z: Number(match[1]), y: Number(match[3]) } : null;
}

async function loadCleanTile(
  url: string,
  abortController: AbortController
): Promise<ProtocolResponse> {
  const response = await fetch(url.replace(`${TERRARIUM_PROTOCOL}://`, "https://"), {
    signal: abortController.signal,
  });
  if (!response.ok) {
    throw new Error(`Terrarium tile ${response.status}: ${url}`);
  }
  const blob = await response.blob();
  if (typeof OffscreenCanvas !== "function" || typeof createImageBitmap !== "function") {
    return { data: await blob.arrayBuffer() };
  }
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { data: bitmap };
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const heights = decodeTerrarium(image.data);
  const tile = tileCoordinates(url);
  cleanTerrariumHeights(
    heights,
    image.width,
    image.height,
    tile ? spikeRadiusForTile(tile.z, tile.y, image.width) : 1
  );
  encodeTerrarium(heights, image.data);
  return { data: await createImageBitmap(image) };
}

let registered = false;

interface ProtocolHost {
  addProtocol?: (
    name: string,
    load: (
      params: { url: string },
      abortController: AbortController
    ) => Promise<ProtocolResponse>
  ) => void;
}

export function registerTerrariumProtocol(maplibre: ProtocolHost) {
  if (registered || typeof maplibre.addProtocol !== "function") return;
  maplibre.addProtocol(TERRARIUM_PROTOCOL, (params, abortController) =>
    loadCleanTile(params.url, abortController)
  );
  registered = true;
}
