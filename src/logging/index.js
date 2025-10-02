// src/logging/index.js
import { makeLogger, noopLogger } from "./logger.js";
export const appLogger = makeLogger({ service: "cogni-git-review" });
export const noop = noopLogger;
