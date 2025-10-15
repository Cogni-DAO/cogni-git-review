/**
 * Abstract base class for host adapters
 * Provides interface abstraction for different git hosting platforms
 */
export class HostAdapter {
  // File and diff operations
  async getFileList(prNumber) {
    throw new Error('getFileList must be implemented by adapter');
  }

  async getDiff(baseRef, headRef) {
    throw new Error('getDiff must be implemented by adapter');
  }

  // Configuration and results
  async loadConfig(path) {
    throw new Error('loadConfig must be implemented by adapter');
  }

  async publishResults(results) {
    throw new Error('publishResults must be implemented by adapter');
  }

  // Metadata and logging
  getLogger() {
    throw new Error('getLogger must be implemented by adapter');
  }

  getRepoInfo() {
    throw new Error('getRepoInfo must be implemented by adapter');
  }
}