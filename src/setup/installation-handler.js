import { createWelcomePR } from './createWelcomePR.js';

/**
 * Handle installation_repositories.added event
 * Initiates setup process for each newly added repository
 */
export async function handleInstallationAdded(context) {
  const repos = context.payload.repositories_added || [];
  
  console.log(`📦 Installation setup initiated for ${repos.length} repositories`);
  
  for (const repo of repos) {
    try {
      const repoInfo = { owner: repo.owner.login, repo: repo.name };
      console.log(`📦 Setting up repository: ${repo.full_name}`);
      
      await createWelcomePR(context, repoInfo);
      
    } catch (error) {
      console.error(`📦 Setup failed for ${repo.full_name}:`, error);
    }
  }
}