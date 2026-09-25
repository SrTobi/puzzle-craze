import { cells, direction } from './engine';
import { CellGrid } from './grid';
import type { Arrow, Point } from './types';
import { CELL_SIZE } from './arrowGeometry';

export class PuzzleIndex {
  readonly grid: CellGrid;
  readonly owners: Int32Array;
  readonly paths: number[][];
  readonly byId = new Map<string, number>();
  readonly alive: Uint8Array;

  constructor(
    readonly arrows: readonly Arrow[],
    dimensions?: { columns: number; rows: number },
  ) {
    let columns = dimensions?.columns ?? 1,
      rows = dimensions?.rows ?? 1;
    if (!dimensions)
      for (const arrow of arrows)
        for (const [x, y] of arrow.points) {
          columns = Math.max(columns, x + 1);
          rows = Math.max(rows, y + 1);
        }
    this.owners = new Int32Array(columns * rows).fill(-1);
    const mask = new Uint8Array(columns * rows);
    this.paths = arrows.map((arrow, index) => {
      this.byId.set(arrow.id, index);
      return cells(arrow).map(([x, y]) => {
        const p = y * columns + x;
        mask[p] = 1;
        this.owners[p] = index;
        return p;
      });
    });
    this.grid = new CellGrid(columns, rows, mask);
    this.alive = new Uint8Array(arrows.length).fill(1);
  }

  hit(arrow: Arrow): { arrow: Arrow; distance: number } | undefined {
    const index = this.byId.get(arrow.id);
    if (index === undefined || !this.alive[index]) return;
    const head = this.paths[index].at(-1)!;
    const [dx, dy] = direction(arrow);
    const d = dx < 0 ? 0 : dx > 0 ? 1 : dy < 0 ? 2 : 3;
    let p = this.grid.links[d][head];
    while (p >= 0) {
      const owner = this.owners[p];
      if (owner !== index)
        return {
          arrow: this.arrows[owner],
          distance: Math.abs(p - head) / (dx ? 1 : this.grid.columns),
        };
      p = this.grid.links[d][p];
    }
  }

  remove(id: string) {
    const index = this.byId.get(id);
    if (index === undefined || !this.alive[index]) return;
    this.alive[index] = 0;
    for (const p of this.paths[index]) this.grid.remove(p);
  }

  /** Includes competitors beyond the click radius, preserving ambiguity checks. */
  near([px, py]: Point): Arrow[] {
    const x = px / CELL_SIZE,
      y = py / CELL_SIZE;
    const found = new Set<number>();
    for (
      let row = Math.max(0, Math.floor(y - 3));
      row <= Math.min(this.grid.rows - 1, Math.ceil(y + 3));
      row++
    )
      for (
        let col = Math.max(0, Math.floor(x - 3));
        col <= Math.min(this.grid.columns - 1, Math.ceil(x + 3));
        col++
      ) {
        const p = row * this.grid.columns + col;
        if (this.grid.occupied[p]) found.add(this.owners[p]);
      }
    return [...found].map((index) => this.arrows[index]);
  }
}

/** Watch only the current blocker; after it leaves, discover the next one, if any. */
export function indexedSolution(arrows: readonly Arrow[]): string[] | null {
  const index = new PuzzleIndex(arrows);
  const waiting = new Map<string, Arrow[]>();
  const ready: Arrow[] = [];
  const observe = (arrow: Arrow) => {
    const hit = index.hit(arrow);
    if (!hit) ready.push(arrow);
    else {
      const list = waiting.get(hit.arrow.id) ?? [];
      list.push(arrow);
      waiting.set(hit.arrow.id, list);
    }
  };
  arrows.forEach(observe);
  const solution: string[] = [];
  for (let i = 0; i < ready.length; i++) {
    const arrow = ready[i];
    solution.push(arrow.id);
    index.remove(arrow.id);
    waiting.get(arrow.id)?.forEach(observe);
    waiting.delete(arrow.id);
  }
  return solution.length === arrows.length ? solution : null;
}
