// src/logging/logger.js
import pino from "pino";

const redactPaths = [
  // auth + secrets
  "password", "token", "access_token", "refresh_token", "secret", "apiKey",
  // HTTP headers
  "req.headers.authorization", "req.headers.cookie",
  "res.headers.set-cookie", "headers.authorization", "headers.cookie",
];

export function makeLogger(bindings = {}) {
  const isTest = process.env.NODE_ENV === "test";

  return pino({
    level: process.env.LOG_LEVEL || "info",
    enabled: !isTest,                     // tests stay silent
    base: {
      app: process.env.APP_NAME || "cogni-git-review",
      env: process.env.NODE_ENV || "dev",
      version: process.env.APP_VERSION,   // inject at build
      commit: process.env.GIT_SHA,        // inject at build
      ...bindings,
    },
    messageKey: "msg",
    timestamp: pino.stdTimeFunctions.epochTime,  // easy to index
    redact: { paths: redactPaths, censor: "[REDACTED]" }, // switch to remove: true for cookies later
    transport: process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { singleLine: true } }
      : undefined,                        // prod: raw JSON to stdout
  });
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
