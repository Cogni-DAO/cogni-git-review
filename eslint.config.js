// eslint.config.js (flat)
import js from '@eslint/js';
import globals from 'globals';
import promise from 'eslint-plugin-promise';
import yml from 'eslint-plugin-yml';
import { RAILS_TEMPLATE_PATH } from './src/constants.js';
// import n from 'eslint-plugin-n'; // optional; see note below

export default [
  // Global options
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },

  // Global ignores (keep ESLint off GitHub Actions YAML)
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'test/fixtures/**/*.json',
      '.venv/**',
      '.github/workflows/**', // <-- actionlint handles these
      `${RAILS_TEMPLATE_PATH}/.github/workflows/**` // <-- template workflows
    ]
  },

  // Core recommended sets
  js.configs.recommended,
  promise.configs['flat/recommended'],

  // YAML linting (generic YAML only; workflows are globally ignored)
  ...yml.configs['flat/recommended'],

  // Project JS rules
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-use-before-define': ['error', { functions: false }]
    }
  },

  // Tests: even more permissive
  {
    files: ['test/**/*.js'],
    rules: { 'no-unused-vars': 'off' }
  }
];
