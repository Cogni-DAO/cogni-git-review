#!/usr/bin/env node
/**
 * CLI wrapper for E2E runner.
 * Exits 0 on success, 1 on failure (for CI promotion gates).
 */
import { runE2ETest } from '../lib/e2e-runner.js';

function env(name, fallback) {
  const v = process.env[name];
  if (!v && fallback === undefined) {
    console.error(`Missing required env: ${name}`);
    process.exit(2);
  }
  return v ?? fallback;
}

async function main() {
  const options = {
    ghToken: env('GH_TOKEN'),
    testRepo: env('TEST_REPO', 'Cogni-DAO/test-repo'),
    checkName: env('CHECK_NAME', 'Cogni Git PR Review'),
    timeoutSec: parseInt(env('TIMEOUT_SEC', '480'), 10),
    sleepMs: parseInt(env('SLEEP_MS', '5000'), 10)
  };

  console.log('Starting E2E test...');
  console.log(`Target: ${options.testRepo}`);
  console.log(`Check: ${options.checkName}`);
  console.log(`Timeout: ${options.timeoutSec}s`);

  try {
    const result = await runE2ETest(options);
    
    if (result.success) {
      console.log('✅ E2E test passed!');
      console.log('Summary:', JSON.stringify(result.summary, null, 2));
      process.exit(0);
    } else {
      console.error('❌ E2E test failed!');
      console.error('Error:', result.error);
      console.error('Summary:', JSON.stringify(result.summary, null, 2));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ E2E runner crashed:', error.message);
    process.exit(1);
  }
}

main();