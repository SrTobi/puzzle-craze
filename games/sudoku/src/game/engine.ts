import {
  BOXES,
  COLOR_NAMES,
  type Puzzle,
  type Size,
  type Unit,
  type Hint,
  type Run,
  type Snapshot,
} from './types.ts';

export function boxRegions(size: Size): number[] {
  const [height, width] = BOXES[size];
  return Array.from(
    { length: size * size },
    (_, i) =>
      Math.floor(Math.floor(i / size) / height) * (size / width) + Math.floor((i % size) / width),
  );
}

export function units(puzzle: Pick<Puzzle, 'options' | 'regions' | 'colors'>): Unit[] {
  const { size, diagonal } = puzzle.options;
  const range = Array.from({ length: size }, (_, i) => i);
  const result: Unit[] = [];
  for (const n of range) {
    result.push({ kind: 'row', name: `row ${n + 1}`, cells: range.map((c) => n * size + c) });
    result.push({ kind: 'column', name: `column ${n + 1}`, cells: range.map((r) => r * size + n) });
    result.push({
      kind: 'region',
      name: `region ${n + 1}`,
      cells: puzzle.regions.flatMap((r, i) => (r === n ? [i] : [])),
    });
  }
  for (const n of [...new Set(puzzle.colors)].filter((n) => n >= 0).sort()) {
    result.push({
      kind: 'color',
      name: `${COLOR_NAMES[n].toLowerCase()} group ${String.fromCharCode(65 + n)}`,
      cells: puzzle.colors.flatMap((c, i) => (c === n ? [i] : [])),
    });
  }
  if (diagonal) {
    result.push({
      kind: 'diagonal',
      name: 'descending diagonal',
      cells: range.map((n) => n * size + n),
    });
    result.push({
      kind: 'diagonal',
      name: 'ascending diagonal',
      cells: range.map((n) => (n + 1) * (size - 1)),
    });
  }
  return result;
}

export function peers(puzzle: Puzzle): number[][] {
  const groups = units(puzzle);
  return puzzle.givens.map((_, i) =>
    [...new Set(groups.filter((u) => u.cells.includes(i)).flatMap((u) => u.cells))].filter(
      (n) => n !== i,
    ),
  );
}

export function conflicts(puzzle: Puzzle, board: number[]): Set<number> {
  const result = new Set<number>();
  for (const unit of units(puzzle)) {
    const seen = new Map<number, number>();
    for (const i of unit.cells) {
      const value = board[i];
      if (!value) continue;
      const previous = seen.get(value);
      if (previous !== undefined) {
        result.add(previous);
        result.add(i);
      }
      seen.set(value, i);
    }
  }
  return result;
}

export function isSolved(puzzle: Puzzle, board: number[]): boolean {
  return (
    board.length === puzzle.givens.length &&
    board.every(
      (v, i) =>
        Number.isInteger(v) &&
        v >= 1 &&
        v <= puzzle.options.size &&
        (!puzzle.givens[i] || puzzle.givens[i] === v),
    ) &&
    conflicts(puzzle, board).size === 0
  );
}

export function candidates(
  board: number[],
  cell: number,
  related: number[][],
  size: number,
): number[] {
  if (board[cell]) return [];
  const used = new Set(related[cell].map((i) => board[i]));
  return Array.from({ length: size }, (_, i) => i + 1).filter((v) => !used.has(v));
}

// Bounded MRV search. A budget exhaustion is never evidence of uniqueness.
export function solve(
  puzzle: Puzzle,
  input = puzzle.givens,
  limit = 2,
  budget = 100_000,
  random?: () => number,
): { count: number; solution: number[] | null; exhausted: boolean } {
  const size = puzzle.options.size;
  if (
    input.length !== size * size ||
    input.some((v) => !Number.isInteger(v) || v < 0 || v > size) ||
    conflicts(puzzle, input).size
  )
    return { count: 0, solution: null, exhausted: false };
  const groups = units(puzzle);
  const memberships = input.map((_, i) =>
    groups.flatMap((u, g) => (u.cells.includes(i) ? [g] : [])),
  );
  const masks = groups.map((u) =>
    u.cells.reduce((mask, i) => mask | (input[i] ? 1 << (input[i] - 1) : 0), 0),
  );
  const full = (1 << size) - 1;
  const board = [...input];
  let count = 0;
  let solution: number[] | null = null;
  let visited = 0;
  let exhausted = false;
  function search() {
    if (++visited > budget) {
      exhausted = true;
      return;
    }
    let cell = -1;
    let choices: number[] = [];
    let best = size + 1;
    for (let i = 0; i < board.length; i++) {
      if (board[i]) continue;
      let mask = full;
      for (const g of memberships[i]) mask &= ~masks[g];
      if (!mask) return;
      const available: number[] = [];
      while (mask) {
        const bit = mask & -mask;
        available.push(32 - Math.clz32(bit));
        mask ^= bit;
      }
      if (available.length < best) {
        best = available.length;
        cell = i;
        choices = available;
      }
      if (best === 1) break;
    }
    if (cell === -1) {
      count++;
      solution ??= [...board];
      return;
    }
    if (random)
      for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
      }
    for (const value of choices) {
      board[cell] = value;
      const bit = 1 << (value - 1);
      for (const g of memberships[cell]) masks[g] |= bit;
      search();
      for (const g of memberships[cell]) masks[g] &= ~bit;
      board[cell] = 0;
      if (count >= limit || exhausted) return;
    }
  }
  search();
  return { count, solution, exhausted };
}

export function logicalHint(puzzle: Puzzle, board: number[], related = peers(puzzle)): Hint | null {
  if (conflicts(puzzle, board).size) return null;
  const choices = board.map((_, i) => candidates(board, i, related, puzzle.options.size));
  const cell = choices.findIndex((values) => values.length === 1);
  const place = (i: number) =>
    `Row ${Math.floor(i / puzzle.options.size) + 1}, column ${(i % puzzle.options.size) + 1}`;
  if (cell !== -1)
    return {
      cell,
      value: choices[cell][0],
      message: `${place(cell)} can only be ${choices[cell][0]} after checking all its groups.`,
      reveal: false,
    };
  for (const unit of units(puzzle))
    for (let value = 1; value <= puzzle.options.size; value++) {
      if (unit.cells.some((i) => board[i] === value)) continue;
      const possible = unit.cells.filter((i) => choices[i].includes(value));
      if (possible.length === 1)
        return {
          cell: possible[0],
          value,
          message: `${place(possible[0])} is the only place for ${value} in ${unit.name}.`,
          reveal: false,
        };
    }
  return null;
}

export function solvesWithSingles(puzzle: Puzzle, input: number[]): boolean {
  const board = [...input];
  const related = peers(puzzle);
  for (let step = 0; step < board.length; step++) {
    const hint = logicalHint(puzzle, board, related);
    if (!hint) break;
    board[hint.cell] = hint.value;
  }
  return isSolved(puzzle, board);
}

export const freshRun = (puzzle: Puzzle): Run => ({
  board: [...puzzle.givens],
  notes: puzzle.givens.map(() => 0),
  history: [],
  future: [],
});
const snapshot = ({ board, notes }: Snapshot): Snapshot => ({
  board: [...board],
  notes: [...notes],
});

export function enterValue(
  puzzle: Puzzle,
  run: Run,
  cell: number,
  value: number,
  pencil: boolean,
): Run {
  if (
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell >= run.board.length ||
    puzzle.givens[cell] ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > puzzle.options.size
  )
    return run;
  const next = snapshot(run);
  if (pencil && value) {
    if (run.board[cell]) return run;
    next.notes[cell] ^= 1 << (value - 1);
  } else {
    next.board[cell] = value;
    next.notes[cell] = 0;
    if (value) for (const i of peers(puzzle)[cell]) next.notes[i] &= ~(1 << (value - 1));
  }
  if (
    next.board.every((v, i) => v === run.board[i]) &&
    next.notes.every((v, i) => v === run.notes[i])
  )
    return run;
  return { ...next, history: [...run.history.slice(-99), snapshot(run)], future: [] };
}

export function undo(run: Run): Run {
  const previous = run.history.at(-1);
  return previous
    ? {
        ...snapshot(previous),
        history: run.history.slice(0, -1),
        future: [...run.future, snapshot(run)],
      }
    : run;
}
export function redo(run: Run): Run {
  const next = run.future.at(-1);
  return next
    ? {
        ...snapshot(next),
        history: [...run.history, snapshot(run)],
        future: run.future.slice(0, -1),
      }
    : run;
}

export function neighbors(cell: number, size: number): number[] {
  const row = Math.floor(cell / size),
    col = cell % size;
  return [
    row > 0 ? cell - size : -1,
    row < size - 1 ? cell + size : -1,
    col > 0 ? cell - 1 : -1,
    col < size - 1 ? cell + 1 : -1,
  ].filter((i) => i >= 0);
}
export function connected(cells: number[], size: number): boolean {
  if (!cells.length) return false;
  const remaining = new Set(cells);
  const queue = [cells[0]];
  remaining.delete(cells[0]);
  for (let cursor = 0; cursor < queue.length; cursor++)
    for (const i of neighbors(queue[cursor], size)) if (remaining.delete(i)) queue.push(i);
  return remaining.size === 0;
}
