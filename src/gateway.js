/**
 * Multi-provider gateway - single process handling GitHub + GitLab + future providers
 * GitHub: Probot middleware at /webhooks/github
 * GitLab: Custom router at /webhooks/gitlab  
 * Shared: OAuth at /oauth/:provider
 */

import { Probot, createNodeMiddleware } from 'probot';
import express from 'express';
import { createGitHubApp } from './adapters/github.js';
import { createGitLabRouter } from './adapters/gitlab/gitlab-router.js';
import { environment } from './env.js';
import runCogniApp from '../index.js';
import SmeeClient from 'smee-client';
import { appLogger } from './logging/index.js';

// Shared event handlers (registered once at boot)
let sharedHandlers = null;

/**
 * Check if we should start smee proxy clients
 */
function shouldProxy() {
  const proxyUrls = [
    environment.WEBHOOK_PROXY_URL_GITHUB,
    environment.WEBHOOK_PROXY_URL_GITLAB
  ];
  const hasProxyUrl = proxyUrls.some(url => url && url.trim());
  
  appLogger.debug('shouldProxy() debug', {
    WEBHOOK_PROXY_URL_GITHUB: environment.WEBHOOK_PROXY_URL_GITHUB,
    WEBHOOK_PROXY_URL_GITLAB: environment.WEBHOOK_PROXY_URL_GITLAB,
    hasProxyUrl,
    isDev: environment.isDev,
    NODE_ENV: environment.NODE_ENV
  });
  
  return hasProxyUrl && environment.isDev;
}

/**
 * Start smee clients for webhook proxy URLs
 */
function startSmeeClients(port) {
  const smeeClients = [];
  
  if (environment.WEBHOOK_PROXY_URL_GITHUB) {
    const githubSmee = new SmeeClient({
      source: environment.WEBHOOK_PROXY_URL_GITHUB,
      target: `http://localhost:${port}/api/v1/webhooks/github`,
      logger: console
    });
    githubSmee.start();
    smeeClients.push({ provider: 'github', client: githubSmee });
  }
  
  if (environment.WEBHOOK_PROXY_URL_GITLAB) {
    const gitlabSmee = new SmeeClient({
      source: environment.WEBHOOK_PROXY_URL_GITLAB,
      target: `http://localhost:${port}/api/v1/webhooks/gitlab`,
      logger: console
    });
    gitlabSmee.start();
    smeeClients.push({ provider: 'gitlab', client: gitlabSmee });
  }
  
  return smeeClients;
}

/**
 * Capture handlers from core app registration
 */
const handlerCapture = {
  on(events, handler) {
    if (!sharedHandlers) sharedHandlers = new Map();
    const eventList = Array.isArray(events) ? events : [events];
    eventList.forEach(event => sharedHandlers.set(event, handler));
    appLogger.debug('Gateway: captured handlers for events', { events: eventList });
  }
};

async function startGateway() {
  const app = express();
  
  // Register handlers once at boot
  appLogger.info('Registering shared handlers');
  runCogniApp(handlerCapture);
  appLogger.info('Registered event handlers', { count: sharedHandlers.size });
  
  // GitHub: Create Probot instance and mount middleware  
  const probot = new Probot({
    appId: environment.APP_ID,
    privateKey: Buffer.from(environment.PRIVATE_KEY, 'base64').toString('utf8'),
    secret: environment.WEBHOOK_SECRET_GITHUB
  });
  
  // Mount GitHub middleware at /api/v1/webhooks/github  
  app.use('/api/v1/webhooks/github', createNodeMiddleware(createGitHubApp(sharedHandlers), { probot, webhooksPath: '/' }))
  
  // GitLab: Mount custom router at /api/v1/webhooks/gitlab
  app.use('/api/v1/webhooks/gitlab', createGitLabRouter(sharedHandlers));
  
  // OAuth routes for all providers
  app.get('/oauth/:provider/callback', (req, res) => {
    const { provider } = req.params;
    
    // Validate provider against allowlist
    const allowedProviders = ['github', 'gitlab'];
    if (!allowedProviders.includes(provider)) {
      return res.status(404).json({ error: 'Unknown provider' });
    }
    
    appLogger.info('OAuth callback received', { provider, query: req.query });
    res.send('OAuth - not implemented yet');
  });
  
  // Health check: TODO. move to /health. and make it actually intelligent healthcheck.
  app.get('/api/v1/health', (req, res) => {
    res.json({ 
      status: 'ok',
      version: 'v1',
      providers: ['github', 'gitlab'],
      handlers: Array.from(sharedHandlers.keys()),
      endpoints: {
        github_webhooks: '/api/v1/webhooks/github',
        gitlab_webhooks: '/api/v1/webhooks/gitlab',
        oauth_callbacks: '/oauth/:provider/callback'
      }
    });
  });
  
  // Start server
  const port = environment.PORT || 3000;
  app.listen(port, () => {
    appLogger.info('Multi-provider gateway started', {
      port,
      endpoints: {
        github_webhooks: '/api/v1/webhooks/github',
        gitlab_webhooks: '/api/v1/webhooks/gitlab',
        oauth_callbacks: '/oauth/:provider/callback',
        health_check: '/api/v1/health'
      }
    });
    
    // Start smee proxy clients if needed
    if (shouldProxy()) {
      appLogger.info('Starting smee proxy clients');
      startSmeeClients(port);
    }
  });
}

startGateway().catch(error => {
  appLogger.error('Failed to start gateway', { error: error.message, stack: error.stack });
  process.exit(1);
});