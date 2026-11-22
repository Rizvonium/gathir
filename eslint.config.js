// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'drizzle/*', 'design/**', 'android/*', 'ios/*'],
  },
  {
    // Some files keep disable comments for stricter rule sets (typescript-eslint strict, no-control-regex).
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  {
    // Tests load module mocks with require() inside jest.mock factories, after the jest.mock calls.
    files: ['**/__tests__/**', 'src/test/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/first': 'off',
    },
  },
]);
