import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const repositoryRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@clio-reader/domain': resolve(repositoryRoot, 'packages/domain/src/index.ts'),
      '@clio-reader/reader-core': resolve(repositoryRoot, 'packages/reader-core/src/index.ts'),
      '@clio-reader/storage': resolve(repositoryRoot, 'packages/storage/src/index.ts'),
      '@clio-reader/storage/drizzle': resolve(repositoryRoot, 'packages/storage/src/drizzle.ts'),
      '@clio-reader/storage/drizzle-test': resolve(
        repositoryRoot,
        'packages/storage/drizzle-test-src.ts',
      ),
      '@clio-reader/library': resolve(repositoryRoot, 'packages/library/src/index.ts'),
      '@clio-reader/reader-cbz': resolve(repositoryRoot, 'packages/reader-cbz/src/index.ts'),
      '@clio-reader/reader-pdf': resolve(repositoryRoot, 'packages/reader-pdf/src/index.ts'),
      '@clio-reader/reader-epub': resolve(repositoryRoot, 'packages/reader-epub/src/index.ts'),
      '@clio-reader/reader-md': resolve(repositoryRoot, 'packages/reader-md/src/index.ts'),
      '@clio-reader/annotations': resolve(repositoryRoot, 'packages/annotations/src/index.ts'),
      '@clio-reader/reader-session': resolve(
        repositoryRoot,
        'packages/reader-session/src/index.ts',
      ),
    },
  },
  test: {
    include: [
      'packages/**/tests/**/*.test.ts',
      'apps/desktop/src/**/*.test.ts',
      'apps/mobile/tests/**/*.test.ts',
    ],
    passWithNoTests: false,
    coverage: {
      reporter: ['text', 'json-summary'],
    },
  },
});
