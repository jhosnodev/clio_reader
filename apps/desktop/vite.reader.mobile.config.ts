import { defineConfig, type Plugin } from 'vite';
import { resolve, basename } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

/* ==========================================================================
   Build del lector para mobile (Android).

   Produce un único `reader.html` autocontenido (JS + CSS inline, assets como
   data URLs) que se copia a `apps/mobile/assets/reader.html`. El WebView de
   React Native carga ese HTML y le inyecta los bytes del libro mediante
   `window.__initFromHost(...)`, igual que hace Electron.
   ========================================================================== */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inlineEverything(): Plugin {
  const mobileAsset = resolve(__dirname, '../mobile/assets/reader.html');

  return {
    name: 'clio-inline-everything',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlKey = Object.keys(bundle).find((key) => key.endsWith('.html'));
      if (!htmlKey) return;
      const htmlAsset = bundle[htmlKey];
      if (htmlAsset.type !== 'asset') return;

      let html =
        typeof htmlAsset.source === 'string'
          ? htmlAsset.source
          : Buffer.from(htmlAsset.source).toString('utf8');

      for (const [key, item] of Object.entries(bundle)) {
        if (item.type === 'asset' && key.endsWith('.css')) {
          const css =
            typeof item.source === 'string'
              ? item.source
              : Buffer.from(item.source).toString('utf8');
          const re = new RegExp(`<link[^>]+href="[^"]*${escapeRegExp(basename(key))}"[^>]*>`);
          html = html.replace(re, () => `<style>${css}</style>`);
        }
      }

      for (const [key, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && key.endsWith('.js')) {
          const code = item.code.replace(/<\/script>/gi, '<\\/script>');
          const re = new RegExp(
            `<script[^>]+src="[^"]*${escapeRegExp(basename(key))}"[^>]*>\\s*</script>`,
          );
          html = html.replace(re, () => `<script type="module">${code}</script>`);
        }
      }

      html = html.replace(/<link[^>]+rel="modulepreload"[^>]*>/g, '');
      html = html.replace(/ crossorigin/g, '');

      htmlAsset.source = html;

      for (const key of Object.keys(bundle)) {
        if (key !== htmlKey) delete bundle[key];
      }
    },
    closeBundle() {
      const built = resolve(__dirname, 'dist-reader-mobile/reader.html');
      mkdirSync(resolve(__dirname, '../mobile/assets'), { recursive: true });
      copyFileSync(built, mobileAsset);
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-reader-mobile',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        reader: resolve(__dirname, 'reader.html'),
      },
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'assets/reader.js',
        assetFileNames: 'assets/reader.[ext]',
      },
    },
  },
  plugins: [inlineEverything()],
  resolve: {
    alias: {
      '@clio-reader/domain': resolve(__dirname, '../../packages/domain/src'),
      '@clio-reader/reader-core': resolve(__dirname, '../../packages/reader-core/src'),
      '@clio-reader/reader-epub': resolve(__dirname, '../../packages/reader-epub/src'),
      '@clio-reader/reader-pdf': resolve(__dirname, '../../packages/reader-pdf/src'),
      '@clio-reader/reader-cbz': resolve(__dirname, '../../packages/reader-cbz/src'),
      '@clio-reader/reader-md': resolve(__dirname, '../../packages/reader-md/src'),
      '@clio-reader/reader-session': resolve(__dirname, '../../packages/reader-session/src'),
      '@clio-reader/storage': resolve(__dirname, '../../packages/storage/src'),
      '@clio-reader/library': resolve(__dirname, '../../packages/library/src'),
      '@clio-reader/annotations': resolve(__dirname, '../../packages/annotations/src'),
    },
  },
});
