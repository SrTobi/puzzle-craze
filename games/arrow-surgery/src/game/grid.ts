export const MAX_SIDE = 1024;
export const MAX_CELLS = 1024 * 1024;

export function checkDimensions(columns: number, rows: number) {
  if (
    ![columns, rows].every((n) => Number.isInteger(n) && n > 0 && n <= MAX_SIDE) ||
    columns * rows > MAX_CELLS
  )
    throw new Error(`Use grid dimensions between 1 and ${MAX_SIDE}.`);
}

/** Linked occupied cells in each row/column: deletion and next occupied cell are O(1). */
export class CellGrid {
  readonly occupied: Uint8Array;
  readonly links: Int32Array[];
  readonly ends: Int32Array[];
  count = 0;

  constructor(
    readonly columns: number,
    readonly rows: number,
    mask: ArrayLike<number>,
  ) {
    checkDimensions(columns, rows);
    if (mask.length !== columns * rows) throw new Error('Mask size does not match the grid.');
    this.occupied = Uint8Array.from(mask);
    this.links = Array.from({ length: 4 }, () => new Int32Array(mask.length).fill(-1));
    // Directions: left, right, up, down.
    this.ends = [
      new Int32Array(rows),
      new Int32Array(rows),
      new Int32Array(columns),
      new Int32Array(columns),
    ];
    this.ends.forEach((a) => a.fill(-1));
    for (let p = 0; p < mask.length; p++) {
      if (!this.occupied[p]) continue;
      this.count++;
      const x = p % columns,
        y = Math.floor(p / columns);
      for (const [before, after, lane] of [
        [0, 1, y],
        [2, 3, x],
      ]) {
        const previous = this.ends[after][lane];
        this.links[before][p] = previous;
        if (previous >= 0) this.links[after][previous] = p;
        else this.ends[before][lane] = p;
        this.ends[after][lane] = p;
      }
    }
  }

  adjacent(p: number, d: number): number {
    const x = p % this.columns,
      y = Math.floor(p / this.columns);
    if (d === 0) return x > 0 ? p - 1 : -1;
    if (d === 1) return x + 1 < this.columns ? p + 1 : -1;
    if (d === 2) return y > 0 ? p - this.columns : -1;
    return y + 1 < this.rows ? p + this.columns : -1;
  }

  neighbors(p: number): number[] {
    return [0, 1, 2, 3].map((d) => this.adjacent(p, d)).filter((n) => n >= 0 && this.occupied[n]);
  }

  remove(p: number) {
    if (!this.occupied[p]) return;
    const x = p % this.columns,
      y = Math.floor(p / this.columns);
    for (const [before, after, lane] of [
      [0, 1, y],
      [2, 3, x],
    ]) {
      const a = this.links[before][p],
        b = this.links[after][p];
      if (a >= 0) this.links[after][a] = b;
      else this.ends[before][lane] = b;
      if (b >= 0) this.links[before][b] = a;
      else this.ends[after][lane] = a;
    }
    this.occupied[p] = 0;
    this.count--;
  }
}
