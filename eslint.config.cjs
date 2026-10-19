const js = require('@eslint/js');

module.exports = [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/build/**', '**/*.ts', '**/*.tsx'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
    },
  },
];
