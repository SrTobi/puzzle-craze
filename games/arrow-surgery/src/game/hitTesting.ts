import { ARROW_WIDTH, CELL_SIZE, HEAD_HALF_WIDTH, HEAD_LENGTH } from './arrowGeometry';
import { blocker, direction } from './engine';
import type { Arrow, Point } from './types';

function closestSegmentPoint(point: Point, start: Point, end: Point): Point {
  const dx = end[0] - start[0],
    dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared),
        );
  return [start[0] + t * dx, start[1] + t * dy];
}

function pointDistance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function segmentDistance(point: Point, start: Point, end: Point): number {
  return pointDistance(point, closestSegmentPoint(point, start, end));
}

function closestArrowPoint(point: Point, arrow: Arrow): Point {
  const points: Point[] = arrow.points.map(([x, y]) => [x * CELL_SIZE, y * CELL_SIZE]);
  let closest = points[0];
  for (let i = 1; i < points.length; i++) {
    const candidate = closestSegmentPoint(point, points[i - 1], points[i]);
    if (pointDistance(point, candidate) < pointDistance(point, closest)) closest = candidate;
  }
  return closest;
}

/** Local gap between the sections being aimed at, only when the click lies between them. */
function neighboringGap(point: Point, a: Point, b: Point): number | undefined {
  const gap = pointDistance(a, b);
  if (gap === 0 || gap > 2 * CELL_SIZE + 1e-7) return;
  const projection = (point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1]);
  if (projection < 0 || projection > gap * gap) return;
  return gap;
}

/** Distance to the visible shaft/head in board pixels, including the head's wings. */
export function arrowDistance(point: Point, arrow: Arrow): number {
  const points: Point[] = arrow.points.map(([x, y]) => [x * CELL_SIZE, y * CELL_SIZE]);
  let distance = Infinity;
  for (let i = 1; i < points.length; i++) {
    distance = Math.min(
      distance,
      Math.max(0, segmentDistance(point, points[i - 1], points[i]) - ARROW_WIDTH / 2),
    );
  }
  const head = points.at(-1)!;
  const [dx, dy] = direction(arrow);
  const local: Point = [
    (point[0] - head[0]) * dx + (point[1] - head[1]) * dy,
    -(point[0] - head[0]) * dy + (point[1] - head[1]) * dx,
  ];
  if (
    local[0] >= -HEAD_LENGTH &&
    local[0] <= 0 &&
    Math.abs(local[1]) <= (-local[0] * HEAD_HALF_WIDTH) / HEAD_LENGTH
  )
    return 0;
  const triangle: Point[] = [
    [0, 0],
    [-HEAD_LENGTH, HEAD_HALF_WIDTH],
    [-HEAD_LENGTH, -HEAD_HALF_WIDTH],
  ];
  for (let i = 0; i < triangle.length; i++)
    distance = Math.min(
      distance,
      segmentDistance(local, triangle[i], triangle[(i + 1) % triangle.length]),
    );
  return distance;
}

/**
 * Direct hits are deliberate; near misses reach 1.5 grid cells.
 * Between neighbors, use the nearest arrow with a bounded preference for a removable one.
 * A blocked arrow owns the nearest 20% of a one-cell gap, or 0.75 cells of a two-cell gap.
 * Interpolate for diagonal gaps. Other distant misses still need a clear distance advantage.
 * Board-space distances keep these boundaries consistent while zooming.
 */
export function pickArrow(
  point: Point,
  active: readonly Arrow[],
  canMove = (arrow: Arrow) => !blocker(arrow, active),
): Arrow | undefined {
  const radius = CELL_SIZE * 1.5;
  const candidates = active
    .map((arrow) => ({
      arrow,
      distance: arrowDistance(point, arrow),
      closest: closestArrowPoint(point, arrow),
      removable: canMove(arrow),
    }))
    .sort((a, b) => a.distance - b.distance || a.arrow.id.localeCompare(b.arrow.id));
  const nearest = candidates[0];
  if (!nearest || nearest.distance > radius) return;

  // Keep precise clicks on a blocked arrow from jumping to a distant playable one.
  if (nearest.distance === 0) return nearest.arrow;

  if (!nearest.removable) {
    const removable = candidates.find((candidate) => candidate.removable);
    if (removable && removable.distance <= radius) {
      const gap = neighboringGap(point, nearest.closest, removable.closest);
      if (gap !== undefined) {
        // Moving the midpoint toward the blocked arrow by 0.30 / 0.25 cells
        // produces the requested 0.20 / 0.75-cell boundaries from its grid line.
        const advantage = CELL_SIZE * 0.6 - Math.max(0, gap - CELL_SIZE) * 0.1;
        if (
          pointDistance(point, removable.closest) - pointDistance(point, nearest.closest) <=
          advantage + 1e-7
        )
          return removable.arrow;
      }
    }
  }

  const second = candidates[1];
  if (second && neighboringGap(point, nearest.closest, second.closest) === undefined) {
    // Keep distant, ambiguous clicks forgiving without letting the reach cutoff pick a winner.
    const clearLead = Math.max(CELL_SIZE * 0.15, nearest.distance * 0.3);
    if (second.distance - nearest.distance < clearLead) return;
  }
  return nearest.arrow;
}
