/**
 * GitLab Express router - validates auth, transforms payload, calls shared handlers
 */

import express from 'express';
import crypto from 'crypto';
import { transformGitLabPayload } from './payload-transform.js';
import { createGitLabContext } from './gitlab-context.js';

/**
 * Create GitLab webhook router
 * @param {Map<string, Function>} sharedHandlers - Shared event handlers from gateway
 * @returns {express.Router} GitLab router
 */
export function createGitLabRouter(sharedHandlers) {
  const router = express.Router();
  router.use(express.json({ limit: '10mb' }));

  router.post('/', async (req, res) => {
    const eventType = req.headers['x-gitlab-event'];
    const token = req.headers['x-gitlab-token'];
    const payload = req.body;
    
    console.log(`GitLab webhook: ${eventType}`, {
      object_kind: payload.object_kind,
      action: payload.object_attributes?.action,
      project: payload.project?.path_with_namespace
    });
    
    // TODO: Validate GitLab token (simple comparison)
    // const expectedSecret = getWebhookSecret(payload.project.id);
    // if (!token || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedSecret))) {
    //   return res.status(401).send('Invalid token');
    // }
    
    // Transform payload to GitHub-like structure
    const transformedPayload = transformGitLabPayload(payload);
    if (!transformedPayload.action) {
      console.log('No action mapped, ignoring event');
      return res.status(200).send('Ignored');
    }
    
    // Create BaseContext with GitLab VCS interface
    const context = createGitLabContext(transformedPayload);
    
    // Find and execute shared handler
    const eventName = `pull_request.${transformedPayload.action}`;
    const handler = sharedHandlers.get(eventName);
    
    if (handler) {
      console.log(`Executing shared handler: ${eventName}`);
      try {
        await handler(context);
        res.status(200).send('OK');
      } catch (error) {
        console.error('Handler error:', error);
        res.status(500).send('Handler failed');
      }
    } else {
      console.log(`No handler for ${eventName}`);
      res.status(200).send('No handler');
    }
  });
  
  return router;
}