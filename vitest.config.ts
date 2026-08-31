import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const repositoryRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@echo-reader/domain': resolve(repositoryRoot, 'packages/domain/src/index.ts'),
      '@echo-reader/reader-core': resolve(repositoryRoot, 'packages/reader-core/src/index.ts'),
      '@echo-reader/storage': resolve(repositoryRoot, 'packages/storage/src/index.ts'),
      '@echo-reader/library': resolve(repositoryRoot, 'packages/library/src/index.ts'),
      '@echo-reader/reader-cbz': resolve(repositoryRoot, 'packages/reader-cbz/src/index.ts'),
      '@echo-reader/reader-pdf': resolve(repositoryRoot, 'packages/reader-pdf/src/index.ts'),
      '@echo-reader/reader-epub': resolve(repositoryRoot, 'packages/reader-epub/src/index.ts'),
      '@echo-reader/reader-session': resolve(repositoryRoot, 'packages/reader-session/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/tests/**/*.test.ts'],
    passWithNoTests: false,
    coverage: {
      reporter: ['text', 'json-summary'],
    },
  },
});
