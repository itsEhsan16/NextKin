import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * The purity fence (ImBackendImplementationPlan P1-01). Engines decide scores, verdicts and
 * ledgers, so the same input must give the same output on the phone, on the server and months
 * later (G12, G14). That rules out anything that reads the outside world: the clock (`as_of` is an
 * argument), randomness, the network, the process, Node built-ins, and Intl, whose output depends
 * on the runtime's ICU data. Money and weights use integer basis points, never floats.
 */
const IMPURE = 'Engines are pure: pass this in as an argument instead.';

export default tseslint.config(
  { ignores: ['node_modules/**'] },
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: IMPURE },
        { name: 'process', message: IMPURE },
        { name: 'Intl', message: 'Intl depends on the runtime ICU data; engines must not.' },
        { name: 'setTimeout', message: IMPURE },
        { name: 'setInterval', message: IMPURE },
        { name: 'crypto', message: IMPURE },
        { name: 'performance', message: IMPURE },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[object.name='Date'][property.name='now']", message: IMPURE },
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: IMPURE },
        { selector: "MemberExpression[object.name='Math'][property.name='random']", message: IMPURE },
        {
          selector: "CallExpression[callee.property.name=/^toLocale/]",
          message: 'Locale formatting depends on the runtime; engines must not.',
        },
        {
          selector: "CallExpression[callee.property.name='localeCompare']",
          message: 'Use code-point ordering; localeCompare depends on the runtime.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*'], message: IMPURE },
            {
              group: ['fs', 'path', 'os', 'http', 'https', 'net', 'child_process', 'crypto'],
              message: IMPURE,
            },
            { group: ['@nextkin/server', '@nextkin/server/*'], message: 'Engines never import the server.' },
            { group: ['@nextkin/shared', '@nextkin/shared/*'], message: 'Shared imports engines, not the reverse.' },
          ],
        },
      ],
    },
  },
);
