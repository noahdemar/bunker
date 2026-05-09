import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/bunker/',
  server: { host: '127.0.0.1', port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mp:   resolve(__dirname, 'mp.html'),
      },
    },
  },
});
