/**
 * GitLab Express router - validates auth, transforms payload, calls shared handlers
 */

import express from 'express';
import tsscmp from 'tsscmp';
import { transformGitLabPayload } from './payload-transform.js';
import { createGitLabContext } from './gitlab-context.js';
import { environment } from '../../env.js';
import { appLogger } from '../../logging/index.js';

/**
 * Create GitLab webhook router
 * @param {Map<string, Function>} sharedHandlers - Shared event handlers from gateway
 * @returns {express.Router} GitLab router
 */
export function createGitLabRouter(sharedHandlers) {
  const router = express.Router();
  const log = appLogger.child({ module: 'gitlab-router' });
  router.use(express.json({ limit: '10mb' }));

  router.post('/', async (req, res) => {
    try {
      log.info('GitLab webhook received', {
        event: req.headers['x-gitlab-event'],
        object_kind: req.body?.object_kind,
        repo: req.body?.project?.path_with_namespace
      });
      
      // Guard: Check token presence
      const token = req.headers['x-gitlab-token'];
      if (!token) {
        log.warn('GitLab webhook rejected: missing token', {
          event: req.headers['x-gitlab-event'],
          repo: req.body?.project?.path_with_namespace
        });
        return res.status(401).json({ status: 'error', code: 401, message: 'missing token' });
      }
      
      // Guard: Validate token with timing-safe comparison  
      if (!tsscmp(String(req.get('x-gitlab-token') || ''), String(environment.WEBHOOK_SECRET_GITLAB || ''))) {
        return res.status(401).json({ status: 'error', code: 401, message: 'invalid token' });
      }
      
      // Transform payload
      const pr = transformGitLabPayload(req.body || {});
      if (!pr.action) {
        log.info('GitLab webhook skipped: unsupported event type', {
          event: req.headers['x-gitlab-event'],
          object_kind: req.body?.object_kind,
          repo: req.body?.project?.path_with_namespace
        });
        return res.status(202).json({ status: 'ok', code: 202, message: 'unsupported event' });
      }
      
      // Find handler
      const handler = sharedHandlers.get(`pull_request.${pr.action}`);
      if (!handler) {
        log.info('GitLab webhook skipped: no handler available', {
          event: `pull_request.${pr.action}`,
          action: pr.action,
          repo: req.body?.project?.path_with_namespace
        });
        return res.status(202).json({ status: 'ok', code: 202, message: 'no handler' });
      }
      
      log.info('GitLab webhook executing handler', {
        event: `pull_request.${pr.action}`,
        action: pr.action,
        repo: req.body?.project?.path_with_namespace,
        mr_id: pr.number
      });
      // Execute handler
      await handler(createGitLabContext(pr));
      log.info('GitLab webhook completed successfully', {
        event: `pull_request.${pr.action}`,
        repo: req.body?.project?.path_with_namespace,
        mr_id: pr.number
      });
      return res.status(200).json({ status: 'ok', code: 200 });
      
    } catch (error) {
      log.error('GitLab handler error', {
        error: error.message,
        stack: error.stack,
        event: req.headers['x-gitlab-event'],
        repo: req.body?.project?.path_with_namespace,
        mr_id: req.body?.object_attributes?.iid
      });
      return res.status(500).json({ status: 'error', code: 500, message: 'handler failed' });
    }
  });
  
  return router;
}