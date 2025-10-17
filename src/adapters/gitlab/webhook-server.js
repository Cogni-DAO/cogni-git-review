/**
 * GitLab webhook server - minimal Express setup
 */

import express from 'express';
import { environment } from '../../env.js';
import { createGitLabContext } from './gitlab-context.js';
import { transformGitLabPayload } from './payload-transform.js';

/**
 * Start webhook server
 * @param {import('./gitlab-app.js').GitLabCogniApp} gitLabApp - GitLab app instance
 */
export function startWebhookServer(gitLabApp) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Webhook endpoint
  app.post('/webhooks/gitlab', async (req, res) => {
    const eventType = req.headers['x-gitlab-event'];
    const payload = req.body;
    
    console.log(`GitLab webhook: ${eventType}`, {
      object_kind: payload.object_kind,
      action: payload.object_attributes?.action
    });
    
    // Transform payload and create context
    const transformedPayload = transformGitLabPayload(payload);
    const context = createGitLabContext(transformedPayload);
    
    // Process through app
    try {
      await gitLabApp.processWebhookEvent(
        payload.object_kind,
        transformedPayload.action,
        context
      );
      res.status(200).send('OK');
    } catch (error) {
      console.error('GitLab webhook error:', error);
      res.status(500).send('Handler error');
    }
  });

  // Start server
  const port = environment.PORT || 3000;
  app.listen(port, () => {
    console.log(`GitLab webhook server on port ${port}`);
    console.log(`Registered handlers:`, gitLabApp.getRegisteredEvents());
  });
  
  return app;
}