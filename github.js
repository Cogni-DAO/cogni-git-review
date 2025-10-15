/**
 * GitHub entry point - wraps Probot into CogniBaseApp interface
 * This is the adapter that allows the host-agnostic index.js to work with Probot
 */

import runCogniApp from './index.js';

/**
 * Probot app entry point
 * @param {import('probot').Probot} probotApp
 */
export default (probotApp) => {
  // Create CogniBaseApp wrapper around Probot
  const cogniAppAdapter = {
    /**
     * Register event handler - forwards to Probot's app.on()
     * @param {string|string[]} event - Event name(s) 
     * @param {Function} handler - Handler function
     */
    on(event, handler) {
      probotApp.on(event, handler);
    }
  };

  // Call the host-agnostic cogni app with the adapter
  return runCogniApp(cogniAppAdapter);
};