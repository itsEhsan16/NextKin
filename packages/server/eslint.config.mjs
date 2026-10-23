import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**'] },
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['src/**/*.ts'],
    rules: {
      // The server never reaches into the apps; the apps reach into it (apps/web's catch-all).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@nextkin/mobile', '@nextkin/web', '@nextkin/web/*'], message: 'The server never imports an app.' },
            { group: ['@nextkin/shared/mock', '@nextkin/shared/mock/*'], message: 'Mock fixtures are for clients and tests, not the server.' },
            {
              // Node (tsx, the worker) loads @nextkin/shared as CommonJS and cannot see names re-exported
              // through `export *`. Import the schema file directly: @nextkin/shared/schemas/<file>.
              regex: '^@nextkin/(shared(/schemas|/models)?|engines)$',
              message: 'Import a specific file (e.g. @nextkin/shared/schemas/envelope, @nextkin/engines/completeness); barrels break under plain Node.',
              allowTypeImports: true,
            },
            {
              // G7: every query goes through withUser/withAnonymous/withSystem/withStaff, which bind
              // the identity RLS reads. A raw driver import would be a path around that.
              group: ['pg', 'pg-*'],
              message: 'Use the Database from src/db (withUser and friends); never the pg driver directly.',
            },
          ],
        },
      ],
      // P11-06: every outbound request goes through src/net/egress.ts (the allowlist), never fetch.
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Use guardedFetch from src/net/egress (the egress allowlist).' }],
      // Configuration is read once, validated, in src/config. Nothing else touches process.env.
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Read configuration through loadConfig() in src/config.' },
      ],
    },
  },
  {
    files: ['src/config/**', 'test/**'],
    rules: { 'no-restricted-properties': 'off' },
  },
  // The database layer itself, the migration runner, the liveness probe's `select 1`, and the
  // local seed are the only places allowed to hold a raw connection. The seed also reads the
  // shared mock fixtures, which is its whole job (P2-08).
  {
    files: ['src/db/**', 'src/health/checks.ts', 'src/seed/**', 'src/entrypoints/seed.ts', 'src/auth/adapters/local/**', 'src/auth/build.ts', 'src/entrypoints/migrate.ts', 'test/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  { ignores: ['src/db/types.generated.ts'] },
);
