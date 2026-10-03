import { useCallback, useEffect, useRef, useState } from 'react';
import { CAMPAIGN_STORAGE_KEY, readCampaignProgress } from '../game/campaignProgress';
import type { Level } from '../game/types';
import type { GeneratedPuzzle, GenerationProgress } from '../generation/generator';
import { campaignInput, isCampaignLevel, tutorialLevel } from '../levels/campaign';

interface Puzzle {
  level: Level;
  number?: number;
  generated?: GeneratedPuzzle;
  revision: number;
}

export function useCampaign() {
  const [progress, setProgress] = useState(readCampaignProgress);
  const [saved, setSaved] = useState(true);
  const initialSelection = useRef(progress.selected);
  const [puzzle, setPuzzle] = useState<Puzzle>({ level: tutorialLevel, number: 1, revision: 0 });
  const [pending, setPending] = useState<{ number: number; progress: GenerationProgress } | null>(
    null,
  );
  const [error, setError] = useState<{ number: number; message: string } | null>(null);
  const worker = useRef<Worker | null>(null);

  const stopWorker = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
  }, []);
  const cancel = useCallback(() => {
    stopWorker();
    setPending(null);
    setError(null);
  }, [stopWorker]);

  const selectLevel = useCallback(
    (number: number) => {
      if (!isCampaignLevel(number)) return;
      cancel();
      if (number === 1) {
        setPuzzle((old) => ({ level: tutorialLevel, number, revision: old.revision + 1 }));
        setProgress((old) => ({ ...old, selected: number }));
        return;
      }
      setPending({ number, progress: { phase: 'Preparing level', fraction: 0 } });
      const fail = (message: string) => {
        stopWorker();
        setPending(null);
        setError({ number, message });
      };
      try {
        const instance = new Worker(new URL('../generation/generator.worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.current = instance;
        instance.onmessage = (event) => {
          if (worker.current !== instance) return;
          if (event.data.type === 'progress') setPending({ number, progress: event.data.progress });
          else if (event.data.type === 'result') {
            const generated = event.data.result as GeneratedPuzzle;
            cancel();
            setPuzzle((old) => ({
              level: generated.level,
              generated,
              number,
              revision: old.revision + 1,
            }));
            setProgress((old) => ({ ...old, selected: number }));
          } else fail(event.data.message);
        };
        instance.onerror = () => {
          if (worker.current === instance) fail('Could not generate this level. Please try again.');
        };
        instance.postMessage(campaignInput(number));
      } catch {
        fail('Could not start generation. Please try again.');
      }
    },
    [cancel, stopWorker],
  );

  useEffect(() => {
    if (initialSelection.current !== 1) selectLevel(initialSelection.current);
    return stopWorker;
  }, [selectLevel, stopWorker]);
  useEffect(() => {
    try {
      localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(progress));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [progress]);

  const complete = useCallback((number: number) => {
    if (!isCampaignLevel(number)) return;
    setProgress((old) =>
      old.completed.includes(number)
        ? old
        : {
            ...old,
            completed: [...old.completed, number].sort((a, b) => a - b),
          },
    );
  }, []);
  const playCustom = useCallback(
    (generated: GeneratedPuzzle) => {
      cancel();
      setPuzzle((old) => ({ level: generated.level, generated, revision: old.revision + 1 }));
    },
    [cancel],
  );

  return { puzzle, progress, saved, pending, error, selectLevel, complete, playCustom, cancel };
}
