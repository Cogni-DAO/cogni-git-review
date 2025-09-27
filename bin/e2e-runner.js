#!/usr/bin/env node
/**
 * CLI shim for E2E runner.
 * Parses env vars and delegates to lib implementation.
 */
import { runE2ETest, parseE2EOptionsFromEnv } from '../lib/e2e-runner.js';

async function main() {
  try {
    const options = parseE2EOptionsFromEnv();
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
    process.exit(2);
  }
}

main();