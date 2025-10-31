import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Cogni Git Review
 * 
 * Unified test runner for:
 * - GitLab webhook integration tests (e2e)
 * - Future GitHub e2e tests migration from lib/e2e-runner.js
 */
export default defineConfig({
  testDir: './e2e/tests',
  
  /* Run tests in files in parallel */
  fullyParallel: false, // Sequential to avoid API rate limits
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Limit parallel tests on CI to avoid rate limits. */
  workers: process.env.CI ? 4 : undefined,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'e2e/artifacts/playwright-report', open: 'never' }],
    ['json', { outputFile: 'e2e/artifacts/results.json' }],
    ['list'] // Console output
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_GITLAB_DEPLOYMENT_URL || 'http://localhost:3000',
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Test output directory */
  outputDir: 'e2e/artifacts/test-results',
  
  /* Configure projects for different test types */
  projects: [
    {
      name: 'github-e2e',
      testMatch: '**/github-*.spec.js',
      timeout: 300000, // 5 minutes for GitHub webhook processing
      use: {
        // No browser needed for GitHub CLI tests
      },
    },
    {
      name: 'gitlab-e2e',
      testMatch: '**/gitlab-*.spec.js',
      timeout: 300000, // 5 minutes for GitLab webhook processing
      use: {
        // No browser needed for GitLab CLI tests
      },
    },
  ],

  /* Environment variable validation */
  expect: {
    timeout: 10000, // 10 second timeout for assertions
  },
});