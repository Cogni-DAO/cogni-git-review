/**
 * LocalCogniApp class - implements CogniBaseApp interface for CLI execution
 * Stores event handlers and simulates PR events for local gate execution
 */

export class LocalCogniApp {
  constructor() {
    this.eventHandlers = new Map();
  }

  /**
   * Register event handler (implements CogniBaseApp interface)
   * @param {string|string[]} event - Event name(s) 
   * @param {Function} handler - Handler function
   */
  on(event, handler) {
    if (Array.isArray(event)) {
      event.forEach(e => this.eventHandlers.set(e, handler));
    } else {
      this.eventHandlers.set(event, handler);
    }
  }

  /**
   * Simulate PR event for CLI execution
   * @param {import('../base-context.d.ts').BaseContext} context - Local context
   * @returns {Promise<any>} Handler result
   */
  async simulatePREvent(context) {
    // Look for pull request event handler (the main gate execution handler)
    const prHandler = this.eventHandlers.get('pull_request.opened') ||
                     this.eventHandlers.get('pull_request.synchronize') ||
                     this.eventHandlers.get('pull_request.reopened');
                     
    if (prHandler) {
      return await prHandler(context);
    }
    
    throw new Error('No pull request handler found. Make sure runCogniApp() was called to register handlers.');
  }

  /**
   * Get registered event handlers (for debugging)
   * @returns {Array<string>} List of registered event names
   */
  getRegisteredEvents() {
    return Array.from(this.eventHandlers.keys());
  }
}