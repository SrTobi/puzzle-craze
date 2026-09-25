import { generatePuzzle } from './generator';
import type { GeneratorInput } from './generator';

self.onmessage = (event: MessageEvent<GeneratorInput>) => {
  try {
    const result = generatePuzzle(event.data, (progress) =>
      self.postMessage({ type: 'progress', progress }),
    );
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Could not generate this puzzle.',
    });
  }
};
