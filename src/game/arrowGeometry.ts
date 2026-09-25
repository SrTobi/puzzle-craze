import type { Point } from './types';

export const CELL_SIZE = 44;
export const ARROW_WIDTH = 8;
export const HEAD_LENGTH = 14;
export const HEAD_HALF_WIDTH = 10;

/** Stop the shaft inside the head so its round cap cannot protrude through the tip. */
export function shaftPoints(points: readonly Point[]): Point[] {
  let remaining = HEAD_LENGTH;
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i - 1],
      b = points[i];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length > remaining) {
      return [
        ...points.slice(0, i),
        [b[0] - ((b[0] - a[0]) * remaining) / length, b[1] - ((b[1] - a[1]) * remaining) / length],
      ];
    }
    remaining -= length;
  }
  return [points[0], points[0]];
}

/** A compact filled head with rounded shoulders and tip, in the same space as the shaft. */
export function headPath(head: Point, [dx, dy]: Point): string {
  const at = (along: number, across: number) =>
    `${head[0] + dx * along - dy * across} ${head[1] + dy * along + dx * across}`;
  const half = ARROW_WIDTH / 2;
  return `M ${at(-16, -half)}
    L ${at(-12, -half)} L ${at(-12, -8.5)}
    Q ${at(-12, -11)} ${at(-10, -9.5)}
    L ${at(-1, -1.9)} Q ${at(1.3, 0)} ${at(-1, 1.9)}
    L ${at(-10, 9.5)} Q ${at(-12, 11)} ${at(-12, 8.5)}
    L ${at(-12, half)} L ${at(-16, half)} Z`;
}
