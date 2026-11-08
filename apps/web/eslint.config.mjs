import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

/**
 * Web lint rules. The Next presets carry the framework and a11y rules; everything below is the
 * web half of the conventions `apps/mobile/eslint.config.js` enforces on the native side.
 */
const config = [
  { ignores: ['.next/**', '.next-*/**', 'out/**', 'coverage/**', 'next-env.d.ts'] },

  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,

  {
    rules: {
      // Mirrors the mobile fence: screens read data through the query hooks, never the fixtures.
      // Without this the shared package would be a hole straight through the data-layer boundary.
      // Types are exempt — the storage adapter contract is a type, and importing it couples
      // nothing at runtime, which is the thing the fence exists to prevent.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nextkin/shared/mock', '@nextkin/shared/mock/*'],
              message: 'Import data through @nextkin/shared/queries hooks, not mock fixtures.',
              allowTypeImports: true,
            },
            {
              // The server package holds database drivers and secrets. Only the /api/v1
              // catch-all mounts it (ImBackendImplementationPlan P1-03); screens reach the backend
              // through the shared repositories, never by importing it.
              group: ['@nextkin/server', '@nextkin/server/*'],
              message: 'Only app/api/** may import @nextkin/server. Screens use @nextkin/shared/queries.',
            },
          ],
        },
      ],

      // Colour and motion live in src/theme and nowhere else — the web analogue of "hex literals
      // exist only in src/theme". Catches both raw CSS values and Tailwind arbitrary values
      // (bg-[#4f46e5], duration-[220ms]), which is how a token would realistically get bypassed.
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/]',
          message:
            'Raw colour. Use a token from src/theme/theme.css (e.g. text-text-primary, bg-brand-600).',
        },
        {
          selector: 'Literal[value=/\b\d+ms\b/]',
          message:
            'Raw duration. Use a motion token from src/theme/theme.css (e.g. duration-base).',
        },
      ],
    },
  },

  // Jest and PostCSS configs are CommonJS by necessity — next/jest is a CJS factory.
  {
    files: ['*.config.js', 'jest.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  // The API catch-all is the one place the server package is mounted. It keeps the fixture fence.
  {
    files: ['app/api/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nextkin/shared/mock', '@nextkin/shared/mock/*'],
              message: 'The API never serves mock fixtures.',
            },
          ],
        },
      ],
    },
  },

  // The one file allowed through the fixture fence: it is the host wiring that hands the shared
  // mock-mode store somewhere to persist, which is the whole point of the adapter.
  {
    files: ['src/lib/mockMode.ts'],
    rules: { '@typescript-eslint/no-restricted-imports': 'off' },
  },

  // The token source is where raw values are supposed to be, and tests assert against them.
  {
    files: [
      'src/theme/**',
      '**/__tests__/**',
      '**/*.test.*',
      // Lives outside __tests__ on purpose, so jest's testMatch does not treat it as a suite —
      // the same arrangement as apps/mobile/testSupport.
      'testSupport/**',
      'jest.setup.ts',
    ],
    rules: { 'no-restricted-syntax': 'off', '@typescript-eslint/no-restricted-imports': 'off' },
  },
];

export default config;
