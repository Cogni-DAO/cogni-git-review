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

// Shared event handlers (registered once at boot)
let sharedHandlers = null;

/**
 * Capture handlers from core app registration
 */
const handlerCapture = {
  on(events, handler) {
    if (!sharedHandlers) sharedHandlers = new Map();
    const eventList = Array.isArray(events) ? events : [events];
    eventList.forEach(event => sharedHandlers.set(event, handler));
    console.log('Gateway: captured handlers for', eventList);
  }
};

async function startGateway() {
  const app = express();
  
  // Register handlers once at boot
  console.log('Registering shared handlers...');
  runCogniApp(handlerCapture);
  console.log(`Registered ${sharedHandlers.size} event handlers`);
  
  // GitHub: Create Probot instance and mount middleware  
  const probot = new Probot({
    appId: environment.APP_ID,
    privateKey: Buffer.from(environment.PRIVATE_KEY, 'base64').toString('utf8'),
    secret: environment.WEBHOOK_SECRET
  });
  
  // Mount GitHub middleware at /api/v1/webhooks/github  
  app.use('/api/v1/webhooks/github', createNodeMiddleware(createGitHubApp(sharedHandlers), { probot, webhooksPath: '/' }))
  
  // GitLab: Mount custom router at /api/v1/webhooks/gitlab
  app.use('/api/v1/webhooks/gitlab', createGitLabRouter(sharedHandlers));
  
  // OAuth routes for all providers
  app.get('/oauth/:provider/callback', (req, res) => {
    const { provider } = req.params;
    console.log(`OAuth callback: ${provider}`, req.query);
    res.send(`${provider} OAuth - not implemented yet`);
  });
  
  // Health check
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
    console.log(`Multi-provider gateway on port ${port}`);
    console.log(`GitHub webhooks: /api/v1/webhooks/github`);
    console.log(`GitLab webhooks: /api/v1/webhooks/gitlab`);
    console.log(`OAuth callbacks: /oauth/:provider/callback`);
    console.log(`Health check: /health`);
  });
}

startGateway().catch(console.error);