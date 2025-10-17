/**
 * TypeScript definitions for CogniBaseApp interface 
 * This abstracts the app/event system layer (app.on() method)
 */

import type { BaseContext } from './base-context.d.ts';

/**
 * Base app interface that host adapters must implement
 * Abstracts event registration system (Probot's app.on(), CLI event simulation, etc.)
 */
export interface CogniBaseApp {
  /**
   * Register event handler
   * @param event - Event name (e.g., "pull_request.opened", "check_suite.rerequested") 
   * @param handler - Handler function that receives BaseContext
   */
  on(event: string, handler: (context: BaseContext) => Promise<void>): void;
  
  /**
   * Register handler for multiple events
   * @param events - Array of event names
   * @param handler - Handler function that receives BaseContext
   */
  on(events: string[], handler: (context: BaseContext) => Promise<void>): void;
}