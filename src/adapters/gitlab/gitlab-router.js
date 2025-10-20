/**
 * GitLab Express router - validates auth, transforms payload, calls shared handlers
 */

import express from 'express';
import tsscmp from 'tsscmp';
import { transformGitLabPayload } from './payload-transform.js';
import { createGitLabContext } from './gitlab-context.js';
import { environment } from '../../env.js';

/**
 * Create GitLab webhook router
 * @param {Map<string, Function>} sharedHandlers - Shared event handlers from gateway
 * @returns {express.Router} GitLab router
 */
export function createGitLabRouter(sharedHandlers) {
  const router = express.Router();
  router.use(express.json({ limit: '10mb' }));

  router.post('/', async (req, res) => {
    try {
      console.log('GitLab webhook received:', req.headers['x-gitlab-event'], req.body?.object_kind);
      
      // Guard: Check token presence
      const token = req.headers['x-gitlab-token'];
      if (!token) {
        console.log('GitLab webhook rejected: missing token');
        return res.status(401).json({ status: 'error', code: 401, message: 'missing token' });
      }
      
      // Guard: Validate token with timing-safe comparison  
      if (!tsscmp(String(req.get('x-gitlab-token') || ''), String(environment.WEBHOOK_SECRET_GITLAB || ''))) {
        console.log('GitLab webhook rejected: invalid token');
        return res.status(401).json({ status: 'error', code: 401, message: 'invalid token' });
      }
      
      // Transform payload
      const pr = transformGitLabPayload(req.body || {});
      if (!pr.action) {
        console.log('GitLab webhook skipped: unsupported event type', req.body?.object_kind);
        return res.status(202).json({ status: 'ok', code: 202, message: 'unsupported event' });
      }
      
      // Find handler
      const handler = sharedHandlers.get(`pull_request.${pr.action}`);
      if (!handler) {
        console.log('GitLab webhook skipped: no handler for', `pull_request.${pr.action}`);
        return res.status(202).json({ status: 'ok', code: 202, message: 'no handler' });
      }
      
      console.log('GitLab webhook executing handler for:', `pull_request.${pr.action}`);
      // Execute handler
      await handler(createGitLabContext(pr));
      console.log('GitLab webhook completed successfully');
      return res.status(200).json({ status: 'ok', code: 200 });
      
    } catch (error) {
      console.error('GitLab handler error:', error);
      return res.status(500).json({ status: 'error', code: 500, message: 'handler failed' });
    }
  });
  
  return router;
}