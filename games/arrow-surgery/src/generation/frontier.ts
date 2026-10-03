/** Distance in grid steps from a head to the board edge it points toward.
 * Directions match CellGrid: left, right, up, down. Mask holes are not edges.
 */
export function exitDistance(code: number, columns: number, rows: number) {
  const point = Math.floor(code / 4);
  const x = point % columns;
  const y = Math.floor(point / columns);
  switch (code % 4) {
    case 0:
      return x;
    case 1:
      return columns - 1 - x;
    case 2:
      return y;
    default:
      return rows - 1 - y;
  }
}

/** Distance buckets avoid scanning every candidate for each arrow on large boards. */
export class Frontier {
  private buckets: number[][];
  private positions: Int32Array;
  private entries: number[] = [];
  private entryPositions: Int32Array;
  private deepest = 0;

  get size() {
    return this.entries.length;
  }

  constructor(
    private columns: number,
    private rows: number,
  ) {
    this.positions = new Int32Array(columns * rows * 4).fill(-1);
    this.entryPositions = new Int32Array(columns * rows * 4).fill(-1);
    this.buckets = Array.from({ length: Math.max(columns, rows) }, () => []);
  }

  set(code: number, present: boolean) {
    const index = this.positions[code];
    if (present === index >= 0) return;
    const distance = exitDistance(code, this.columns, this.rows);
    const bucket = this.buckets[distance];
    if (present) {
      this.positions[code] = bucket.length;
      bucket.push(code);
      this.deepest = Math.max(this.deepest, distance);
      this.entryPositions[code] = this.entries.length;
      this.entries.push(code);
    } else {
      const last = bucket.pop()!;
      if (index < bucket.length) {
        bucket[index] = last;
        this.positions[last] = index;
      }
      this.positions[code] = -1;
      const entryIndex = this.entryPositions[code];
      const lastEntry = this.entries.pop()!;
      if (entryIndex < this.entries.length) {
        this.entries[entryIndex] = lastEntry;
        this.entryPositions[lastEntry] = entryIndex;
      }
      this.entryPositions[code] = -1;
    }
  }

  pick(random: () => number): number | undefined {
    if (!this.size) return undefined;
    // Explore any entry 50% of the time, uniformly across candidates, not distances.
    if (random() < 0.5) return this.entries[Math.floor(random() * this.entries.length)];
    while (!this.buckets[this.deepest].length) this.deepest--;
    const bucket = this.buckets[this.deepest];
    return bucket[Math.floor(random() * bucket.length)];
  }
}
