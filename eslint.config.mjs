import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-electron/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.agents/**',
      '**/scripts/**',
      '**/*.cjs',
      '**/repro-*.mjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(error|_|e)$',
        },
      ],
    },
  },
  {
    files: ['site/**'],
    languageOptions: {
      globals: {
        document: 'readonly',
        fetch: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        getComputedStyle: 'readonly',
        requestAnimationFrame: 'readonly',
        performance: 'readonly',
        IntersectionObserver: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
);
