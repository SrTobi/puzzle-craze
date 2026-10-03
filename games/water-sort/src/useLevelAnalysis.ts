import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Attempt,
  GenerationProgress,
  GraphSummary,
  PositionStats,
  StateFilter,
  graphPage,
} from './game/analysis';
import type { Board } from './game/engine';
import type { Level } from './game/levels';
import type { WorkerRequest } from './game/analysis.worker';

export type AnalysisReady = {
  level: Level;
  summary: GraphSummary;
  attempts: Attempt[];
  elapsedMs: number;
};
export type AnalysisPage = ReturnType<typeof graphPage>;
export function useLevelAnalysis(number: number) {
  const worker = useRef<Worker | null>(null);
  const [ready, setReady] = useState<AnalysisReady | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<PositionStats | null>(null);
  const [page, setPage] = useState<AnalysisPage | null>(null);
  useEffect(() => {
    setReady(null);
    setProgress(null);
    setPaused(false);
    setError(null);
    setPosition(null);
    setPage(null);
    let current: Worker;
    try {
      current = new Worker(new URL('./game/analysis.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      setError('The analysis worker could not start. Reload to try again.');
      return;
    }
    worker.current = current;
    current.onmessage = ({ data }) => {
      if (data.type === 'ready') setReady(data);
      if (data.type === 'progress') {
        setProgress(data.progress);
        setPaused(data.paused);
      }
      if (data.type === 'error') setError(data.message);
      if (data.type === 'position') setPosition(data.stats);
      if (data.type === 'page') setPage(data.page);
    };
    current.onerror = (event) =>
      setError(
        event.message ||
          'The analysis worker could not load or ran out of resources. Reload to retry, or choose an earlier level.',
      );
    current.postMessage({ type: 'generate', number } satisfies WorkerRequest);
    return () => {
      current.terminate();
      worker.current = null;
    };
  }, [number]);
  const send = useCallback((message: WorkerRequest) => worker.current?.postMessage(message), []);
  const inspect = useCallback((board: Board) => send({ type: 'position', board }), [send]);
  const requestPage = useCallback(
    (offset: number, filter: StateFilter) => {
      setPage(null);
      send({ type: 'page', offset, filter });
    },
    [send],
  );
  // Hide the previous result immediately when the selection changes, even before effects run.
  return {
    ready: ready?.level.number === number ? ready : null,
    progress,
    paused,
    error,
    position,
    page,
    inspect,
    requestPage,
    pause: () => send({ type: 'pause' }),
    resume: () => send({ type: 'continue' }),
  };
}
