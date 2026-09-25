import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL('./index.html', import.meta.url)),
        arrowSurgery: fileURLToPath(new URL('./games/arrow-surgery/index.html', import.meta.url)),
        logicSnake: fileURLToPath(new URL('./games/logic-snake/index.html', import.meta.url)),
      },
    },
  },
});
