/**
 * GitLabCogniApp class - implements CogniBaseApp interface like LocalCogniApp
 * Stores event handlers for webhook processing
 */

export class GitLabCogniApp {
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
   * Process GitLab webhook event
   * @param {string} eventType - GitLab event type (e.g., 'merge_request')
   * @param {string} action - Event action (e.g., 'opened')
   * @param {import('../base-context.d.ts').BaseContext} context - GitLab context
   * @returns {Promise<any>} Handler result
   */
  async processWebhookEvent(eventType, action, context) {
    // Map GitLab events to GitHub event names
    let githubEventName;
    if (eventType === 'merge_request') {
      githubEventName = `pull_request.${action}`;
    } else {
      githubEventName = `${eventType}.${action}`;
    }
    
    const handler = this.eventHandlers.get(githubEventName);
    if (handler) {
      return await handler(context);
    }
    
    console.log(`No handler found for GitLab event: ${eventType}.${action} (mapped to ${githubEventName})`);
  }

  /**
   * Get registered event handlers (for debugging)
   * @returns {Array<string>} List of registered event names
   */
  getRegisteredEvents() {
    return Array.from(this.eventHandlers.keys());
  }
}