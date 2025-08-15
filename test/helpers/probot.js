import { Probot, ProbotOctokit } from 'probot';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, "../fixtures");
const privateKey = fs.readFileSync(path.join(fixturesPath, "mock-cert.pem"), "utf-8");

export const TestOctokit = ProbotOctokit.defaults({
  request: { 
    fetch: (url, options) => {
      console.log('🔍 TestOctokit REQUEST:', options?.method || 'GET', url);
      return fetch(url, options);
    }
  },
  retry: { enabled: false },
  throttle: { enabled: false }
});

export function makeProbot(appFn) {
  const probot = new Probot({
    appId: 123456,
    privateKey,
    Octokit: TestOctokit
  });
  
  console.log('🔍 Probot created with TestOctokit:', !!probot.Octokit);
  
  probot.load(appFn);
  return probot;
}