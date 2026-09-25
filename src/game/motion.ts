import { ARROW_WIDTH, CELL_SIZE } from './arrowGeometry';

export const FLIGHT_DURATION = 920;

export interface Flight {
  id: string;
  started: number;
  duration: number;
  /** Grid-space advance already reached when an in-progress attempt becomes a flight. */
  fromDistance: number;
  queued: boolean;
}

export interface BlockedAttempt {
  id: string;
  by: string;
  started: number;
  distance: number;
  outward: number;
  hold: number;
  returning: number;
}

export function createAttempt(
  id: string,
  by: string,
  hitDistance: number,
  now: number,
  reducedMotion: boolean,
): BlockedAttempt {
  return {
    id,
    by,
    started: now,
    // The arrow tip stops at the blocker's visible edge, not at its center line.
    distance: Math.max(0, hitDistance - (ARROW_WIDTH / 2 + 1.5) / CELL_SIZE),
    outward: reducedMotion ? 0 : Math.min(500, 180 + Math.sqrt(hitDistance) * 85),
    hold: reducedMotion ? 160 : 130,
    returning: reducedMotion ? 0 : 340,
  };
}

export function attemptEnd(attempt: BlockedAttempt): number {
  return attempt.started + attempt.outward + attempt.hold + attempt.returning;
}

/** Follow the original path toward contact, pause, then retrace it exactly to rest. */
export function attemptDistance(attempt: BlockedAttempt, now: number): number {
  if (!attempt.outward) return 0;
  const elapsed = Math.max(0, now - attempt.started);
  if (elapsed < attempt.outward) return attempt.distance * (elapsed / attempt.outward) ** 2;
  const returnTime = elapsed - attempt.outward - attempt.hold;
  if (returnTime <= 0) return attempt.distance;
  return attempt.distance * Math.max(0, 1 - returnTime / attempt.returning) ** 3;
}

export function impactGlow(attempt: BlockedAttempt, now: number): number {
  const sinceImpact = now - attempt.started - attempt.outward;
  return sinceImpact < 0 ? 0 : Math.max(0, 1 - sinceImpact / (attempt.hold + attempt.returning));
}
