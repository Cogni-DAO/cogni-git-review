import { env } from "./env.js";

const BASE_CHECK_NAME = 'Cogni Git PR Review';

export const PR_REVIEW_NAME =
  env.app === 'prod' ? BASE_CHECK_NAME : `${BASE_CHECK_NAME} (${env.app})`;

// Context name → workflow file mapping for governance policy
export const CONTEXT_TO_WORKFLOW = {
    'CI - PR': '.github/workflows/ci.yaml',
    'Security': '.github/workflows/security.yaml'
  };

// Template bundle path for Setup PRs
export const RAILS_TEMPLATE_PATH = 'cogni-rails-templates-v0.1'; // Note: package.json still hardcodes this path for linting.
