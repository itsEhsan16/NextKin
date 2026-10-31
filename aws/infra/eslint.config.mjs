import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['node_modules/**', 'cdk.out/**'] },
  ...tseslint.configs.recommended,
  prettier,
);
