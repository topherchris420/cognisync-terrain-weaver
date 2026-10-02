import type { SubstrateLevel } from "../config";
import { roundTo } from "../projection";
import type { RawElevationLattice } from "../sources";
import { tileBoundsM } from "../tile-id";
import type { AttributeSpec, ElevationLayerTile } from "../types";

export const ELEVATION_SOURCE = "mapzen-terrarium";

export const ELEVATION_ATTRIBUTES: AttributeSpec[] = [
  { name: "valuesCm", unit: "cm", evidence: "measured", source: ELEVATION_SOURCE, field: "Terrarium RGB", transform: "bilinear sample at local-cell centres, integer centimetres; context cells are the mean of 4 × 4 local cells, null if any is missing" },
];

/**
 * The frozen elevation lattice: Terrarium sampled at the centre of every
 * substrate grid cell over the coverage. Source values are never altered:
 * artefacts are counted and excluded from derived quantities, not "fixed".
 */
export class ElevationLattice {
  readonly cellM: number;
  readonly rows: number;
  readonly cols: number;
  readonly west: number;
  readonly north: number;
  private readonly values: Array<number | null>;
  private readonly artefactBelowCm: number;

  constructor(raw: RawElevationLattice, expectedCellM: number, coverage: [number, number, number, number], artefactBelowM: number) {
    if (raw.cellSizeM !== expectedCellM) throw new Error(`Elevation lattice cell ${raw.cellSizeM} m ≠ configured ${expectedCellM} m; re-fetch the elevation source.`);
    if (raw.valuesCm.length !== raw.rows * raw.cols) throw new Error("Elevation lattice size does not match rows × cols.");
    const [x0, , , y1] = coverage;
    if (raw.west !== x0 || raw.north !== y1 || raw.cols * raw.cellSizeM !== coverage[2] - x0 || raw.rows * raw.cellSizeM !== y1 - coverage[1]) {
      throw new Error("Elevation lattice does not cover the declared coverage exactly.");
    }
    this.cellM = raw.cellSizeM;
    this.rows = raw.rows;
    this.cols = raw.cols;
    this.west = raw.west;
    this.north = raw.north;
    this.values = raw.valuesCm;
    this.artefactBelowCm = artefactBelowM * 100;
  }

  /** Raw value at lattice (row from north, column from west), cm. */
  cellCm(row: number, col: number): number | null {
    if (row < 0 || col < 0 || row >= this.rows || col >= this.cols) return null;
    return this.values[row * this.cols + col];
  }

  /** A value usable for derived quantities: present and not an artefact. */
  usableCm(row: number, col: number): number | null {
    const value = this.cellCm(row, col);
    return value === null || value < this.artefactBelowCm ? null : value;
  }

  isArtefact(valueCm: number): boolean {
    return valueCm < this.artefactBelowCm;
  }

  /** Bilinear ground elevation (m) between cell centres; null near artefacts or edges. */
  sampleM(x: number, y: number): number | null {
    const u = (x - this.west) / this.cellM - 0.5;
    const v = (this.north - y) / this.cellM - 0.5;
    const c0 = Math.floor(u);
    const r0 = Math.floor(v);
    const a = this.usableCm(r0, c0);
    const b = this.usableCm(r0, c0 + 1);
    const c = this.usableCm(r0 + 1, c0);
    const d = this.usableCm(r0 + 1, c0 + 1);
    if (a === null || b === null || c === null || d === null) return null;
    const tx = u - c0;
    const ty = v - r0;
    const top = a + (b - a) * tx;
    const bottom = c + (d - c) * tx;
    return roundTo((top + (bottom - top) * ty) / 100, 2);
  }

  /** Lattice cell containing a metric point, or null outside. */
  cellAt(x: number, y: number): [number, number] | null {
    const col = Math.floor((x - this.west) / this.cellM);
    const row = Math.floor((this.north - y) / this.cellM);
    return row >= 0 && col >= 0 && row < this.rows && col < this.cols ? [row, col] : null;
  }

  cellCentre(row: number, col: number): [number, number] {
    return [this.west + (col + 0.5) * this.cellM, this.north - (row + 0.5) * this.cellM];
  }

  /** The elevation layer of one tile; aggregated by whole local cells for coarser levels. */
  tile(level: SubstrateLevel, ix: number, iy: number, cellM: number): ElevationLayerTile | null {
    const [x0, , x1, y1] = tileBoundsM(level, ix, iy);
    const factor = cellM / this.cellM;
    if (!Number.isInteger(factor) || factor < 1) throw new Error(`Tile elevation cell ${cellM} m must be a whole multiple of ${this.cellM} m.`);
    const size = Math.round((x1 - x0) / cellM);
    const firstCol = Math.round((x0 - this.west) / this.cellM);
    const firstRow = Math.round((this.north - y1) / this.cellM);
    const valuesCm: Array<number | null> = [];
    let present = 0;
    let artefacts = 0;
    let min = Infinity;
    let max = -Infinity;
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        let sum = 0;
        let complete = true;
        for (let dr = 0; dr < factor && complete; dr += 1) {
          for (let dc = 0; dc < factor; dc += 1) {
            const value = this.cellCm(firstRow + r * factor + dr, firstCol + c * factor + dc);
            if (value === null) {
              complete = false;
              break;
            }
            sum += value;
          }
        }
        const value = complete ? Math.round(sum / (factor * factor)) : null;
        valuesCm.push(value);
        if (value !== null) {
          present += 1;
          if (this.isArtefact(value)) artefacts += 1;
          if (value < min) min = value;
          if (value > max) max = value;
        }
      }
    }
    if (present === 0) return null;
    return {
      sourceId: ELEVATION_SOURCE,
      evidence: "measured",
      cellSizeM: cellM,
      rows: size,
      cols: size,
      valuesCm,
      verticalUnits: "centimetres (integer)",
      verticalDatum: "as provided by Terrarium (blended sources; not stated per tile)",
      interpolation: factor === 1 ? "bilinear within z15 Terrarium tiles, at cell centres" : `mean of ${factor} × ${factor} local cells`,
      sourceResolution: "z15 Terrarium pixel ≈ 3.6 m here; underlying source resolution varies",
      fallback: "none",
      minM: roundTo(min / 100, 2),
      maxM: roundTo(max / 100, 2),
      artefactCells: artefacts,
    };
  }
}
