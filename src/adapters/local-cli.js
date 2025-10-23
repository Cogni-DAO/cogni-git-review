#!/usr/bin/env node

/**
 * Local CLI entry point - wraps git CLI into CogniBaseApp interface
 * Enables running Cogni gates locally without GitHub API dependencies
 */

import runCogniApp from '../../index.js';
import { LocalCogniApp } from './local-cli/local-app.js';
import { LocalContext } from './local-cli/local-context.js';
import { makeLogger } from '../logging/logger.js';

/**
 * Run Cogni gates locally using git CLI
 * @param {string} baseRef - Base git reference (e.g. "main", "HEAD~1")
 * @param {string} headRef - Head git reference (e.g. "HEAD", "feature-branch")
 * @param {string} repoPath - Path to git repository (defaults to current directory)
 * @returns {Promise<any>} Gate execution results
 */
export default async function runLocalCLI(baseRef = 'HEAD~1', headRef = 'HEAD', repoPath = process.cwd()) {
  // Create app adapter and register with cogni core FIRST
  const app = new LocalCogniApp();
  runCogniApp(app);  // This registers the handlers
  
  // Create LocalContext from CLI args
  const context = new LocalContext(baseRef, headRef, repoPath);
  context.log = makeLogger({ service: "cogni-git-review" }).child({
    id: 'local-cli',
    repo: repoPath
  });
  
  // Simulate PR event and run gates (handlers are already registered)
  console.log(`🔍 Running Cogni gates on ${baseRef}...${headRef}`);
  const result = await app.simulatePREvent(context);
  
  console.log(`✅ Local review completed`);
  return result;
}

// CLI execution if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const [baseRef, headRef, repoPath] = process.argv.slice(2);
  
  try {
    await runLocalCLI(baseRef, headRef, repoPath);
    process.exit(0);
  } catch (error) {
    console.error('❌ Local CLI execution failed:', error.message);
    process.exit(1);
  }
}