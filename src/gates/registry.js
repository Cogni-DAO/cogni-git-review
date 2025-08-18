/**
 * Gate Registry - Runtime discovery of available gates by scanning directories
 * Enables "drop a file" deployment without central configuration
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

/**
 * Build registry of available gates by scanning gate directories
 * @param {object} logger - Optional Probot-style logger
 * @returns {Promise<{cogni: Map<string, Function>}>}
 */
export async function buildRegistry(logger) {
  const log = logger || console;
  const registry = {
    cogni: new Map()
  };

  // Load gates from a directory
  const loadGatesFromDir = async (dir, kind) => {
    if (!fs.existsSync(dir)) {
      return;
    }

    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      if (!file.endsWith('.js')) {
        continue;
      }

      try {
        const filePath = path.join(dir, file);
        const fileUrl = pathToFileURL(filePath).href;
        const module = await import(fileUrl);

        // Register cogni gates by their 'id' export
        if (kind === 'cogni' && module.id && typeof module.run === 'function') {
          registry.cogni.set(module.id, module.run);
        }
      } catch (error) {
        // Log gate loading failures via Probot logger
        if (log.warn) {
          log.warn(`Failed to load gate file ${file}`, { 
            error: error.message, 
            kind, 
            file_path: path.join(dir, file)
          });
        } else {
          console.warn(`Failed to load gate file ${file}:`, error.message);
        }
      }
    }
  };

  // Scan gate directories using module-relative paths
  const currentModuleDir = path.dirname(fileURLToPath(import.meta.url));
  await loadGatesFromDir(path.join(currentModuleDir, 'cogni'), 'cogni');

  return registry;
}

/**
 * Resolve gate handler function from registry
 * @param {object} registry - Registry from buildRegistry()
 * @param {object} gate - Gate configuration from spec
 * @returns {Function|null} Gate handler function or null if not found
 */
export function resolveHandler(registry, gate) {
  // All gates are cogni gates - use 'id' field
  return registry.cogni.get(gate.id) ?? null;
}