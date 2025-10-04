// src/logging/logger.js
import pino from "pino";
import {PR_REVIEW_NAME} from "../constants.js";
import {env} from "../env.js";

const redactPaths = [
  // auth + secrets
  "password", "token", "access_token", "refresh_token", "secret", "apiKey",
  // HTTP headers
  "req.headers.authorization", "req.headers.cookie",
  "res.headers.set-cookie", "headers.authorization", "headers.cookie",
];

export function makeLogger(bindings = {}) {
  const isTest = env.isTest;
  
  const LOKI_URL   = process.env.LOKI_URL;
  const LOKI_USER  = process.env.LOKI_USER;
  const LOKI_TOKEN = process.env.LOKI_TOKEN;
  const lokiEnabled = !!(LOKI_URL && LOKI_USER && LOKI_TOKEN);

  let transport;
  if (env.isDev) {
    transport = { target: "pino-pretty", options: { singleLine: true } };
  } else if (lokiEnabled) {
    transport = {
      target: "pino-loki",
      options: {
        host: LOKI_URL,
        basicAuth: {
          username: LOKI_USER,
          password: LOKI_TOKEN,
        },
        batching: true,
        labels: { app: PR_REVIEW_NAME, env: env.app },
        timeout: 5000,
      },
    };
  }

  const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    enabled: !isTest,                     // tests stay silent
    base: {
      app: PR_REVIEW_NAME,
      env: env.app,
      version: process.env.APP_VERSION,   // inject at build
      commit: process.env.GIT_SHA,        // inject at build
      ...bindings,
    },

    messageKey: "msg",
    timestamp: pino.stdTimeFunctions.epochTime,  // easy to index
    redact: { paths: redactPaths, censor: "[REDACTED]" }, // switch to remove: true for cookies later
    transport,
  });

  // Log transport configuration on startup (only for non-test environments)
  if (!isTest) {
    if (env.isDev) {
      logger.info("Logger configured with pino-pretty transport (development mode)");
    } else if (lokiEnabled) {
      logger.info({ lokiUrl: LOKI_URL, lokiUser: LOKI_USER }, "Logger configured with Loki transport");
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
