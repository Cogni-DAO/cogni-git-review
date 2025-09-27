const BASE_CHECK_NAME = 'Cogni Git PR Review';
const ENV = process.env.APP_ENV || 'dev';

export const PR_REVIEW_NAME =
  ENV === 'prod' ? BASE_CHECK_NAME : `${BASE_CHECK_NAME} (${ENV})`;

// Context name → workflow file mapping for governance policy
export const CONTEXT_TO_WORKFLOW = {
    'CI - PR': '.github/workflows/ci.yaml',
    'Security': '.github/workflows/security.yaml', 
    'Release': '.github/workflows/release-please.yaml'
  };

// Template bundle path for Setup PRs
export const RAILS_TEMPLATE_PATH = 'cogni-rails-templates-v0.1'; // Note: package.json still hardcodes this path for linting.