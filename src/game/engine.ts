import type { Arrow, ArrowColor, Level, Point } from './types';
import { indexedSolution, PuzzleIndex } from './puzzleIndex';
import { MAX_SIDE } from './grid';

export const COLORS: Record<ArrowColor, { main: string; light: string; name: string }> = {
  violet: { main: '#8270df', light: '#a597ef', name: 'Violet' },
  coral: { main: '#ef816e', light: '#f5a08b', name: 'Coral' },
  teal: { main: '#43a99b', light: '#71c5ac', name: 'Teal' },
  gold: { main: '#e5b247', light: '#f2cc6d', name: 'Golden' },
  blue: { main: '#639dd8', light: '#8fb9ed', name: 'Blue' },
  pink: { main: '#d87fa6', light: '#e7a6c3', name: 'Pink' },
};

export function direction(arrow: Arrow): Point {
  const head = arrow.points.at(-1)!;
  const previous = arrow.points.at(-2)!;
  return [Math.sign(head[0] - previous[0]), Math.sign(head[1] - previous[1])];
}

export function directionName(arrow: Arrow) {
  const [x, y] = direction(arrow);
  return x > 0 ? 'right' : x < 0 ? 'left' : y > 0 ? 'down' : 'up';
}

export function cells(arrow: Arrow): Point[] {
  const result: Point[] = [arrow.points[0]];
  for (let i = 1; i < arrow.points.length; i++) {
    const [x, y] = arrow.points[i - 1];
    const [endX, endY] = arrow.points[i];
    const dx = Math.sign(endX - x),
      dy = Math.sign(endY - y);
    const length = Math.abs(endX - x) + Math.abs(endY - y);
    for (let step = 1; step <= length; step++) result.push([x + dx * step, y + dy * step]);
  }
  return result;
}

/** Finds the first occupied cell on the outgoing ray, with its distance in grid spaces. */
export function blockingHit(
  arrow: Arrow,
  active: readonly Arrow[],
): { arrow: Arrow; distance: number } | undefined {
  const [hx, hy] = arrow.points.at(-1)!;
  const [dx, dy] = direction(arrow);
  let closest = Infinity;
  let result: Arrow | undefined;
  for (const other of active) {
    if (other.id === arrow.id) continue;
    for (const [x, y] of cells(other)) {
      const distance = (x - hx) * dx + (y - hy) * dy;
      const aligned = dx === 0 ? x === hx : y === hy;
      if (aligned && distance > 0 && distance < closest) {
        closest = distance;
        result = other;
      }
    }
  }
  return result ? { arrow: result, distance: closest } : undefined;
}

/** Returns the nearest other arrow hit by the ray leaving this arrow's head. */
export function blocker(arrow: Arrow, active: readonly Arrow[]): Arrow | undefined {
  return blockingHit(arrow, active)?.arrow;
}

export const availableArrows = (arrows: readonly Arrow[]) => {
  const index = new PuzzleIndex(arrows);
  return arrows.filter((arrow) => !index.hit(arrow));
};

/** Removal can only free more arrows, so a greedy solve is complete for these rules. */
export function solve(arrows: readonly Arrow[]): string[] | null {
  return indexedSolution(arrows);
}

/** Validate external JSON before the renderer or a future generator uses it. */
export function parseLevel(value: unknown): Level {
  const fail = (message: string): never => {
    throw new Error(`Invalid level: ${message}`);
  };
  if (!value || typeof value !== 'object') return fail('expected an object');
  const level = value as Level;
  if (level.version !== 1) fail('unsupported version');
  if (
    ![level.id, level.name, level.description].every(
      (text) => typeof text === 'string' && text.length > 0,
    )
  )
    fail('missing metadata');
  if (!['easy', 'medium', 'hard'].includes(level.difficulty)) fail('unknown difficulty');
  if (
    !level.grid ||
    ![level.grid.columns, level.grid.rows].every(
      (n) => Number.isInteger(n) && n > 0 && n <= MAX_SIDE,
    )
  )
    fail(`grid dimensions must be 1–${MAX_SIDE}`);
  if (!Array.isArray(level.arrows) || !level.arrows.length) fail('no arrows');
  const ids = new Set<string>();
  const occupied = new Set<string>();
  for (const arrow of level.arrows) {
    if (!arrow || typeof arrow.id !== 'string' || !arrow.id || ids.has(arrow.id))
      fail('missing or duplicate arrow ID');
    ids.add(arrow.id);
    if (!Object.hasOwn(COLORS, arrow.color)) fail(`unknown color on ${arrow.id}`);
    if (!Array.isArray(arrow.points) || arrow.points.length < 2)
      fail(`too few points on ${arrow.id}`);
    arrow.points.forEach((point, index) => {
      if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isInteger))
        fail(`invalid point on ${arrow.id}`);
      if (
        point[0] < 0 ||
        point[0] >= level.grid.columns ||
        point[1] < 0 ||
        point[1] >= level.grid.rows
      )
        fail(`out-of-bounds point on ${arrow.id}`);
      if (index > 0) {
        const previous = arrow.points[index - 1];
        if ((point[0] === previous[0]) === (point[1] === previous[1]))
          fail(`segments must be nonzero and orthogonal on ${arrow.id}`);
      }
    });
    for (const point of cells(arrow)) {
      const key = point.join(',');
      if (occupied.has(key)) fail(`overlapping cell at ${key}`);
      occupied.add(key);
    }
  }
  if (!solve(level.arrows)) fail('arrows cannot all escape');
  return level;
}

export function pathLength(points: readonly Point[]): number {
  return points
    .slice(1)
    .reduce(
      (sum, point, i) => sum + Math.hypot(point[0] - points[i][0], point[1] - points[i][1]),
      0,
    );
}

/** Advance a constant-length arrow along its own path, extending the head straight ahead. */
export function advance(points: readonly Point[], distance: number): Point[] {
  const head = points.at(-1)!;
  const previous = points.at(-2)!;
  const dx = Math.sign(head[0] - previous[0]),
    dy = Math.sign(head[1] - previous[1]);
  const extended = [...points, [head[0] + dx * distance, head[1] + dy * distance] as Point];
  let remaining = distance;
  for (let i = 1; i < extended.length; i++) {
    const a = extended[i - 1],
      b = extended[i];
    const segment = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (remaining < segment) {
      const fraction = remaining / segment;
      return [
        [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction],
        ...extended.slice(i),
      ];
    }
    remaining -= segment;
  }
  return extended.slice(-2);
}

export function roundedPath(points: readonly Point[], radius = 9): string {
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i - 1],
      point = points[i],
      after = points[i + 1];
    const incoming = Math.hypot(point[0] - before[0], point[1] - before[1]);
    const outgoing = Math.hypot(after[0] - point[0], after[1] - point[1]);
    if (!incoming || !outgoing) continue;
    const r = Math.min(radius, incoming / 2, outgoing / 2);
    path += ` L ${point[0] - ((point[0] - before[0]) / incoming) * r} ${point[1] - ((point[1] - before[1]) / incoming) * r}`;
    path += ` Q ${point[0]} ${point[1]} ${point[0] + ((after[0] - point[0]) / outgoing) * r} ${point[1] + ((after[1] - point[1]) / outgoing) * r}`;
  }
  return `${path} L ${points.at(-1)![0]} ${points.at(-1)![1]}`;
}
