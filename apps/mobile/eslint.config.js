const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'coverage/*'],
  },
  {
    rules: {
      'import/no-unresolved': 'off',
      // Screens must consume data through query hooks, never fixtures directly.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/data/mock/*', '**/data/mock/*'],
              message: 'Import data through @/data/queries hooks, not mock fixtures.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/data/**', '**/__tests__/**', '**/*.test.*', 'app/dev/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
