import {
  generateLevel,
  graphPage,
  inspectPosition,
  type GeneratedLevel,
  type GenerationProgress,
  type StateFilter,
} from './analysis';
import type { Board } from './engine';

export type WorkerRequest =
  | { type: 'generate'; number: number }
  | { type: 'continue' }
  | { type: 'pause' }
  | { type: 'position'; board: Board }
  | { type: 'page'; offset: number; filter: StateFilter };
let generator: ReturnType<typeof generateLevel> | null = null;
let generated: GeneratedLevel | null = null;
let latest: GenerationProgress | null = null;
let paused = false;
let limit = 100000;
let timer: ReturnType<typeof setTimeout> | undefined;
const started = { time: 0 };
function pump() {
  if (!generator || paused) return;
  try {
    const result = generator.next();
    if (result.done) {
      generated = result.value;
      generator = null;
      self.postMessage({
        type: 'ready',
        level: generated.level,
        summary: generated.graph.summary,
        attempts: generated.attempts,
        elapsedMs: performance.now() - started.time,
      });
      return;
    }
    latest = result.value;
    if (latest.phase === 'exploring' && latest.discovered >= limit) paused = true;
    self.postMessage({ type: 'progress', progress: latest, paused, limit });
    if (!paused) timer = setTimeout(pump, 0);
  } catch (error) {
    generator = null;
    self.postMessage({
      type: 'error',
      message:
        error instanceof Error ? error.message : 'Analysis could not finish. Try an earlier level.',
    });
  }
}
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === 'generate') {
    clearTimeout(timer);
    generator = generateLevel(request.number);
    generated = null;
    latest = null;
    paused = false;
    limit = 100000;
    started.time = performance.now();
    pump();
  } else if (request.type === 'continue' && paused) {
    paused = false;
    limit = Math.max(limit, (latest?.discovered ?? 0) * 2);
    pump();
  } else if (request.type === 'pause' && generator) {
    paused = true;
    clearTimeout(timer);
    self.postMessage({ type: 'progress', progress: latest, paused, limit });
  } else if (request.type === 'position' && generated) {
    self.postMessage({ type: 'position', stats: inspectPosition(generated.graph, request.board) });
  } else if (request.type === 'page' && generated) {
    self.postMessage({
      type: 'page',
      page: graphPage(generated.graph, request.offset, request.filter),
    });
  }
};
