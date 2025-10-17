/**
 * Multi-provider gateway - single process handling GitHub + GitLab + future providers
 * GitHub: Probot middleware at /webhooks/github
 * GitLab: Custom router at /webhooks/gitlab  
 * Shared: OAuth at /oauth/:provider
 */

import { Probot, createNodeMiddleware } from 'probot';
import express from 'express';
import githubApp from './adapters/github.js';
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
    privateKey: environment.PRIVATE_KEY,
    webhookSecret: environment.WEBHOOK_SECRET
  });
  
  // Mount GitHub middleware at /webhooks/github  
  app.use('/webhooks/github', createNodeMiddleware((probot) => githubApp(probot, sharedHandlers), { 
    probot, 
    webhooksPath: '/webhooks/github' 
  }));
  
  // GitLab: Mount custom router at /webhooks/gitlab
  app.use('/webhooks/gitlab', createGitLabRouter(sharedHandlers));
  
  // OAuth routes for all providers
  app.get('/oauth/:provider/callback', (req, res) => {
    const { provider } = req.params;
    console.log(`OAuth callback: ${provider}`, req.query);
    res.send(`${provider} OAuth - not implemented yet`);
  });
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok',
      providers: ['github', 'gitlab'],
      handlers: Array.from(sharedHandlers.keys())
    });
  });
  
  // Start server
  const port = environment.PORT || 3000;
  app.listen(port, () => {
    console.log(`Multi-provider gateway on port ${port}`);
    console.log(`GitHub webhooks: /webhooks/github`);
    console.log(`GitLab webhooks: /webhooks/gitlab`);
    console.log(`OAuth callbacks: /oauth/:provider/callback`);
  });
}

startGateway().catch(console.error);