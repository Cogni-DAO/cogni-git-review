// src/logging/logger.js
import pino from "pino";
import {PR_REVIEW_NAME} from "../constants.js";
import {environment} from "../env.js";

const redactPaths = [
  // auth + secrets
  "password", "token", "access_token", "refresh_token", "secret", "apiKey",
  // HTTP headers
  "req.headers.authorization", "req.headers.cookie",
  "res.headers.set-cookie", "headers.authorization", "headers.cookie",
];

export function makeLogger(bindings = {}) {
  const isTest = environment.isTest;

  let transport;
  if (environment.isDev) {
    transport = { target: "pino-pretty", options: { singleLine: true } };
  } else if (environment.loki.enabled) {
    transport = {
      target: "pino-loki",
      options: {
        host: environment.loki.url,
        basicAuth: {
          username: environment.loki.user,
          password: environment.loki.token,
        },
        batching: true,
        labels: { app: PR_REVIEW_NAME, env: environment.APP_ENV },
        timeout: 5000,
      },
    };
  }

  const logger = pino({
    level: environment.LOG_LEVEL,
    enabled: !isTest,                     // tests stay silent
    base: {
      app: PR_REVIEW_NAME,
      env: environment.APP_ENV,
      version: environment.SERVICE_VERSION,
      commit: environment.COMMIT_SHA,
      ...bindings,
    },

    messageKey: "msg",
    timestamp: pino.stdTimeFunctions.epochTime,  // easy to index
    redact: { paths: redactPaths, censor: "[REDACTED]" }, // switch to remove: true for cookies later
    transport,
  });

  // Log transport configuration on startup (only for non-test environments)
  if (!isTest) {
    if (environment.isDev) {
      logger.info("Logger configured with pino-pretty transport (development mode)");
    } else if (environment.loki.enabled) {
      logger.info({ 
        lokiUrl: environment.loki.url, 
        lokiUser: environment.loki.user 
      }, "Logger configured with Loki transport");
    } else {
      logger.info("Logger configured with JSON stdout transport (production mode)");
    }
  }

  return logger;
}

export const noopLogger = {
  info: () => {}, 
  warn: () => {}, 
  error: () => {}, 
  debug: () => {}, 
  child() { return this; }
};

// Usage
// const logger = makeLogger({ service: "webhook", reqId });
// logger.info({ pr: 123 }, "gate passed");
