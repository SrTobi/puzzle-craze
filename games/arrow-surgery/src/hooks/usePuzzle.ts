import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from '../game/audio';
import { attemptEnd } from '../game/motion';
import type { BlockedAttempt } from '../game/motion';
import {
  continuePlay,
  finishMotions,
  initialPlayState,
  tapArrow,
  undoPlay,
} from '../game/playState';
import type { PlayState } from '../game/playState';
import type { Level } from '../game/types';

export function usePuzzle(level: Level, reducedMotion: boolean) {
  const [state, setState] = useState(initialPlayState);
  const current = useRef(state);
  const impacts = useRef(new Map<BlockedAttempt, ReturnType<typeof setTimeout>>());

  const commit = useCallback((next: PlayState) => {
    const previous = current.current;
    if (next === previous) return;
    current.current = next;
    setState(next);
    for (const [attempt, timer] of impacts.current) {
      if (!next.attempts.includes(attempt)) {
        clearTimeout(timer);
        impacts.current.delete(attempt);
      }
    }
    for (const attempt of next.attempts) {
      if (previous.attempts.includes(attempt)) continue;
      const timer = setTimeout(
        () => {
          impacts.current.delete(attempt);
          if (current.current.attempts.includes(attempt)) audio.blocked();
        },
        Math.max(0, attempt.started + attempt.outward - performance.now()),
      );
      impacts.current.set(attempt, timer);
    }
    const oldFlights = new Set(previous.flights);
    next.flights
      .filter((flight) => !oldFlights.has(flight))
      .slice(0, 12)
      .forEach((_, index) => {
        audio.launch(previous.removed.length + index, index * 0.04);
      });
  }, []);

  useEffect(
    () => () => {
      impacts.current.forEach(clearTimeout);
      impacts.current.clear();
    },
    [],
  );

  useEffect(() => {
    const deadlines = [
      ...state.attempts.map(attemptEnd),
      ...state.flights.map((flight) => flight.started + flight.duration),
    ];
    if (!deadlines.length) return;
    const deadline = deadlines.reduce((a, b) => Math.min(a, b), Infinity);
    const timer = setTimeout(
      () => {
        if (current.current === state)
          commit(finishMotions(state, Math.max(deadline, performance.now())));
      },
      Math.max(1, Math.ceil(deadline - performance.now())),
    );
    return () => clearTimeout(timer);
  }, [state, commit]);

  const tap = useCallback(
    (id: string) => {
      const before = current.current;
      const next = tapArrow(level.arrows, before, id, performance.now(), reducedMotion);
      commit(next);
      return next === before ? 'unchanged' : next.queued.includes(id) ? 'queued' : 'launched';
    },
    [level, reducedMotion, commit],
  );

  const reset = useCallback(() => commit(initialPlayState()), [commit]);
  const undo = useCallback(() => commit(undoPlay(current.current)), [commit]);
  const resume = useCallback(() => commit(continuePlay(current.current)), [commit]);
  return {
    ...state,
    tap,
    reset,
    undo,
    resume,
    lost: state.lives === 0,
    canUndo: state.lives > 0 && state.history.length > 0 && !state.flights.length,
  };
}
