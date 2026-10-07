import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

function removeCrossorigin(): Plugin {
  return {
    name: 'remove-crossorigin',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '');
    },
  };
}

function copyPreloadScript(): Plugin {
  return {
    name: 'copy-preload',
    configResolved() {
      mkdirSync('dist-electron', { recursive: true });
      copyFileSync('electron/preload.cjs', 'dist-electron/preload.cjs');
      copyFileSync(
        '../../packages/storage/drizzle/0000_initial.sql',
        'dist-electron/0000_initial.sql',
      );
    },
  };
}

function nodeGlobals(): Plugin {
  return {
    name: 'node-globals',
    enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('electron/main.ts') || id.includes('electron/main.ts')) {
        return {
          code:
            `
import { fileURLToPath } from 'url';
import { dirname } from 'path';
globalThis.__filename = fileURLToPath(import.meta.url);
globalThis.__dirname = dirname(globalThis.__filename);
` + code,
          map: null,
        };
      }
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        reader: resolve(__dirname, 'reader.html'),
      },
    },
  },
  plugins: [
    react(),
    removeCrossorigin(),
    copyPreloadScript(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          plugins: [nodeGlobals()],
          build: {
            rollupOptions: {
              external: ['better-sqlite3'],
            },
          },
          resolve: {
            alias: {
              '@clio-reader/domain': resolve(__dirname, '../../packages/domain/src'),
              '@clio-reader/storage': resolve(__dirname, '../../packages/storage/src'),
              '@clio-reader/library': resolve(__dirname, '../../packages/library/src'),
              '@clio-reader/annotations': resolve(__dirname, '../../packages/annotations/src'),
              '@clio-reader/reader-core': resolve(__dirname, '../../packages/reader-core/src'),
            },
          },
        },
      },
    ]),
    electronRenderer(),
  ],
  resolve: {
    alias: {
      '@clio-reader/domain': resolve(__dirname, '../../packages/domain/src'),
      '@clio-reader/reader-core': resolve(__dirname, '../../packages/reader-core/src'),
      '@clio-reader/reader-epub': resolve(__dirname, '../../packages/reader-epub/src'),
      '@clio-reader/reader-pdf': resolve(__dirname, '../../packages/reader-pdf/src'),
      '@clio-reader/reader-cbz': resolve(__dirname, '../../packages/reader-cbz/src'),
      '@clio-reader/reader-session': resolve(__dirname, '../../packages/reader-session/src'),
      '@clio-reader/storage': resolve(__dirname, '../../packages/storage/src'),
      '@clio-reader/library': resolve(__dirname, '../../packages/library/src'),
      '@clio-reader/annotations': resolve(__dirname, '../../packages/annotations/src'),
    },
  },
});
