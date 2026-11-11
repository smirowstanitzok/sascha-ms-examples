// eslint.config.mjs
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['cdk.out/**', 'node_modules/**', 'eslint.config.mjs'] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    // Lambda handlers are async on purpose, even if they don't await anything (yet)
    rules: { '@typescript-eslint/require-await': 'off' },
  },
);
