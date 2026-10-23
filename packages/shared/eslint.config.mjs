import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * The phone-safety fence (ImBackendImplementationPlan P1-02, ground rule G8). Everything in this
 * package runs inside Expo Go on a phone, so it may not pull in the server, a database driver, the
 * AWS SDK or any Node built-in. Because the workspace uses `nodeLinker: hoisted`, a server
 * dependency would *resolve* from here at runtime anyway — this lint rule is the only guard, which
 * is why it runs in the root gate.
 */
const PHONE_SAFE = 'packages/shared runs on the phone (G8): no server code, Node built-ins, drivers or AWS SDK.';

export default tseslint.config(
  { ignores: ['node_modules/**'] },
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      // The codebase marks deliberately unused bindings (destructured-away fields) with a leading _.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          // Exact module names: a pattern such as 'http' would also match a relative path through
          // a folder of that name (src/repos/http), which is phone-safe code.
          paths: [
            'fs', 'path', 'os', 'http', 'https', 'net', 'tls', 'child_process', 'crypto', 'stream', 'zlib',
            'pg', 'kysely', 'iovalkey', 'ioredis', 'pino', 'hono', 'server-only', '@nextkin/server',
          ].map((name) => ({ name, message: PHONE_SAFE })),
          patterns: [
            { group: ['@nextkin/server/*', 'node:*', 'pg-*', 'hono/*', '@aws-sdk/*'], message: PHONE_SAFE },
          ],
        },
      ],
    },
  },
);
