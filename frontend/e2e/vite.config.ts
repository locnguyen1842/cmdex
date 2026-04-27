// Vite config for E2E tests — aliases @wailsio/runtime to the mock.
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@wailsio/runtime': path.resolve(__dirname, 'mocks/runtime'),
    },
  },
  server: {
    port: 9246,
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
