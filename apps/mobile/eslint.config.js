const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

// Style properties that carry a length. Anything measured on the 520px Figma artboard must be
// projected onto the device before it reaches one of these — see src/theme/scaleTheme.ts.
const LENGTH_PROPS = [
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingHorizontal',
  'paddingVertical',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'gap',
  'rowGap',
  'columnGap',
  'borderRadius',
  'borderWidth',
  'top',
  'bottom',
  'left',
  'right',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'strokeWidth',
].join('|');

const IN_STYLESHEET =
  "CallExpression[callee.object.name='StyleSheet'][callee.property.name='create'] " +
  `Property[key.name=/^(${LENGTH_PROPS})$/]`;

const STYLESHEET_MESSAGE =
  'Artboard lengths must reach the style tree through the scaled theme or s(). ' +
  'StyleSheet.create runs at module scope, which cannot see the device width, so a literal here ' +
  'renders at its raw 520px artboard value. Move it into the component body.';

const RAW_TOKEN_MESSAGE =
  'Read tokens off useTheme(), not the module exports. The exports are unscaled 520px artboard ' +
  'space; useTheme() returns them projected onto this device. `import type` is fine.';

/** Raw token modules and the value names that must not be imported from them outside the theme. */
const rawTokenSelectors = ['@/theme', '@/theme/tokens', '@/theme/typography'].map((source) => ({
  selector:
    `ImportDeclaration[importKind!='type'][source.value='${source}'] > ` +
    "ImportSpecifier[importKind!='type']" +
    '[imported.name=/^(spacing|radii|sizes|shadows|shadowSpecs|typography)$/]',
  message: RAW_TOKEN_MESSAGE,
}));

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
      'no-restricted-syntax': [
        'warn',
        // `raw` starting with a digit picks out numeric literals, so percentage strings like
        // '100%' — which are already device-relative — do not trip the rule.
        {
          selector: `${IN_STYLESHEET} > Literal[raw=/^[0-9]/][value!=0]`,
          message: STYLESHEET_MESSAGE,
        },
        {
          selector: `${IN_STYLESHEET} > UnaryExpression[operator='-']`,
          message: STYLESHEET_MESSAGE,
        },
        ...rawTokenSelectors,
      ],
    },
  },
  {
    // The theme builds the scaled values, the dev oracle deliberately lays out at 520, and the
    // dev gallery and tests read raw artboard tokens on purpose.
    files: ['src/theme/**', 'src/dev/**', 'app/dev/**', '**/__tests__/**', '**/*.test.*'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['src/data/**', '**/__tests__/**', '**/*.test.*', 'app/dev/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
