import { generatePuzzle } from './generator';
import type { Options } from './types';

self.onmessage = (event: MessageEvent<Options>) => {
  try {
    const puzzle = generatePuzzle(event.data, (message) =>
      self.postMessage({ type: 'progress', message }),
    );
    self.postMessage({ type: 'result', puzzle });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Could not generate this puzzle. Try another seed.',
    });
  }
};
