/**
 * Gate Registry - Runtime discovery of available gates by scanning directories
 * Enables "drop a file" deployment without central configuration
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Build registry of available gates by scanning gate directories
 * @returns {Promise<{cogni: Map<string, Function>, external: Map<string, Function>}>}
 */
export async function buildRegistry() {
  const registry = {
    cogni: new Map(),
    external: new Map()
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

        // Register external gates by their 'runner' export
        if (kind === 'external' && module.runner && typeof module.run === 'function') {
          registry.external.set(module.runner, module.run);
        }
      } catch (error) {
        // Skip files that can't be loaded - they might be invalid or have syntax errors
        console.warn(`Failed to load gate file ${file}:`, error.message);
      }
    }
  };

  // Scan gate directories
  const basePath = path.join(process.cwd(), 'src', 'gates');
  await loadGatesFromDir(path.join(basePath, 'cogni'), 'cogni');
  await loadGatesFromDir(path.join(basePath, 'external'), 'external');

  return registry;
}

/**
 * Resolve gate handler function from registry
 * @param {object} registry - Registry from buildRegistry()
 * @param {object} gate - Gate configuration from spec
 * @returns {Function|null} Gate handler function or null if not found
 */
export function resolveHandler(registry, gate) {
  // Determine gate source (defaults to 'cogni')
  const source = gate.source ?? 'cogni';

  if (source === 'external') {
    // External gates use 'runner' field
    const runner = gate.runner || '';
    return registry.external.get(runner) ?? null;
  } else {
    // Cogni gates use 'id' field
    return registry.cogni.get(gate.id) ?? null;
  }
}