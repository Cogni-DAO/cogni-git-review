import { createWelcomePR } from './createWelcomePR.js';

/**
 * Handle installation_repositories.added event
 * Initiates setup process for each newly added repository
 */
export async function handleInstallationAdded(context) {
  const repos = context.payload.repositories_added || [];
  const log = context.log.child({ module: 'installation-handler' });
  
  log.info('Installation setup initiated', {
    repository_count: repos.length,
    repositories: repos.map(r => r.full_name)
  });
  
  for (const repo of repos) {
    try {
      const [owner, name] = (repo.full_name || `${repo.owner?.login}/${repo.name}`).split('/');
      const repoInfo = { owner, repo: name };
      log.info('Setting up repository', {
        repository: repo.full_name,
        owner,
        repo: name
      });
      
      await createWelcomePR(context, repoInfo);
      
    } catch (error) {
      log.error('Setup failed for repository', {
        repository: repo.full_name,
        error: error.message,
        stack: error.stack
      });
    }
  }
}