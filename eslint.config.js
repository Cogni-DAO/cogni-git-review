// ESLint configuration for cogni-git-review (flat config, permissive + safety nets)
import js from '@eslint/js';
import globals from 'globals';
import promise from 'eslint-plugin-promise';
// import n from 'eslint-plugin-n';  // Intentionally disabled: generates false positives about Node.js test runner being "experimental"

export default [
  // Global linter options
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error'
    }
  },

  // Core recommended rules (permissive, bug catchers)
  js.configs.recommended,
  // n.configs['flat/recommended'],  // Re-enable later with selective rules once plugin data catches up
  promise.configs['flat/recommended'],

  // Project rules
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      // Keep permissive choices
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-use-before-define': ['error', { functions: false }]
    }
  },

  // Tests: even more permissive (Node.js native test runner)
  {
    files: ['test/**/*.js'],
    rules: {
      'no-unused-vars': 'off'
    }
  },

  // Ignores
  {
    ignores: [
      'node_modules/',
      'coverage/',
      'coverage/**',
      'dist/',
      'test/fixtures/**/*.json'
    ]
  }
];