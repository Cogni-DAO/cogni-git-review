// eslint.config.js (flat)
import js from '@eslint/js';
import globals from 'globals';
import promise from 'eslint-plugin-promise';
import yml from 'eslint-plugin-yml';
import n from 'eslint-plugin-n';
import { RAILS_TEMPLATE_PATH } from './src/constants.js';

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
    plugins: { n },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-use-before-define': ['error', { functions: false }],
      'n/no-process-env': 'error'
    }
  },

  // Tests: even more permissive
  {
    files: ['test/**/*.js'],
    rules: { 
      'no-unused-vars': 'off',
      'n/no-process-env': 'off'  // Tests may need direct env access
    }
  },
  
  // Allow process.env only in env.js and E2E infrastructure
  {
    files: ['src/env.js', 'lib/e2e-runner.js', 'bin/e2e-runner.js', 'e2e/**/*.js', 'playwright.config.js'],
    rules: { 'n/no-process-env': 'off' }
  }
];
