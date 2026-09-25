import { PuzzleIndex } from './puzzleIndex';
import { attemptDistance, attemptEnd, createAttempt, FLIGHT_DURATION } from './motion';
import type { BlockedAttempt, Flight } from './motion';
import type { Arrow } from './types';

export const MAX_LIVES = 3;

interface Snapshot {
  removed: string[];
  queued: string[];
  collisions: number;
  lives: number;
}

export interface PlayState extends Snapshot {
  attempts: BlockedAttempt[];
  flights: Flight[];
  history: Snapshot[];
}

export function initialPlayState(): PlayState {
  return {
    removed: [],
    queued: [],
    collisions: 0,
    lives: MAX_LIVES,
    attempts: [],
    flights: [],
    history: [],
  };
}

/** One user action, including every automatic departure it unlocks, is one undo step. */
export function tapArrow(
  arrows: readonly Arrow[],
  state: PlayState,
  id: string,
  now: number,
  reducedMotion = false,
): PlayState {
  if (state.lives === 0) return state;
  const removed = new Set(state.removed);
  const arrow = arrows.find((arrow) => arrow.id === id && !removed.has(id));
  if (!arrow || state.queued.includes(id)) return state;
  const index = new PuzzleIndex(arrows);
  state.removed.forEach((id) => index.remove(id));

  const snapshot: Snapshot = {
    removed: state.removed,
    queued: state.queued,
    collisions: state.collisions,
    lives: state.lives,
  };
  const next: PlayState = { ...state, history: [...state.history.slice(-127), snapshot] };
  const hit = index.hit(arrow);
  if (hit) {
    return {
      ...next,
      queued: [...state.queued, id],
      collisions: state.collisions + 1,
      lives: state.lives - 1,
      attempts: [
        ...state.attempts,
        createAttempt(id, hit.arrow.id, hit.distance, now, reducedMotion),
      ],
    };
  }

  const queued = new Set(state.queued);
  const attempts = new Map(state.attempts.map((attempt) => [attempt.id, attempt]));
  next.flights = [...state.flights];
  next.removed = [...state.removed];
  const depart = (departingId: string) => {
    const attempt = attempts.get(departingId);
    next.flights.push({
      id: departingId,
      started: now,
      duration: reducedMotion ? 200 : FLIGHT_DURATION,
      fromDistance: attempt ? attemptDistance(attempt, now) : 0,
      queued: queued.has(departingId),
    });
    next.removed.push(departingId);
    queued.delete(departingId);
    attempts.delete(departingId);
    index.remove(departingId);
  };

  const waiting = new Map<string, string[]>();
  const ready: string[] = [];
  const observe = (queuedId: string) => {
    const arrow = arrows[index.byId.get(queuedId)!];
    const hit = index.hit(arrow);
    if (!hit) ready.push(queuedId);
    else {
      const list = waiting.get(hit.arrow.id) ?? [];
      list.push(queuedId);
      waiting.set(hit.arrow.id, list);
    }
  };
  state.queued.forEach(observe);
  depart(id);
  waiting.get(id)?.forEach(observe);
  waiting.delete(id);
  for (let i = 0; i < ready.length; i++) {
    const readyId = ready[i];
    depart(readyId);
    waiting.get(readyId)?.forEach(observe);
    waiting.delete(readyId);
  }
  next.queued = [...queued];
  next.attempts = [...attempts.values()];
  return next;
}

/** Finishing a failed attempt clears only its movement, never its persistent queue. */
export function finishMotions(state: PlayState, now: number): PlayState {
  const attempts = state.attempts.filter((attempt) => attemptEnd(attempt) > now);
  const flights = state.flights.filter((flight) => flight.started + flight.duration > now);
  return attempts.length === state.attempts.length && flights.length === state.flights.length
    ? state
    : { ...state, attempts, flights };
}

export function undoPlay(state: PlayState): PlayState {
  const previous = state.history.at(-1);
  if (!previous || state.flights.length || state.lives === 0) return state;
  return { ...previous, attempts: [], flights: [], history: state.history.slice(0, -1) };
}

/** Start a fresh life allowance without changing the puzzle or its queued arrows. */
export function continuePlay(state: PlayState): PlayState {
  if (state.lives > 0) return state;
  // Old snapshots belong to the previous allowance and must not undo the refill.
  return { ...state, lives: MAX_LIVES, history: [] };
}
