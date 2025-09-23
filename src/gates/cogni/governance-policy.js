import { CONTEXT_TO_WORKFLOW, PR_REVIEW_NAME } from '../../constants.js';

export const type = 'governance-policy';

/**
 * Governance Policy Gate - MVP version
 * Checks that required workflow files exist and have matching names
 * 
 * @param {object} context - Probot context
 * @returns {Promise<GateResult>}
 */
export async function run(context) {
  const startTime = Date.now();
  
  try {
    // Get required contexts from repo spec
    const requiredContexts = context.spec?.required_status_contexts || [];
    
    // Filter out our own check (self-exempt)
    const nonExemptContexts = requiredContexts.filter(c => c !== PR_REVIEW_NAME);
    
    if (nonExemptContexts.length === 0) {
      return {
        status: 'neutral',
        neutral_reason: 'no_contexts_required',
        violations: [],
        stats: { contexts_checked: 0 },
        duration_ms: Date.now() - startTime
      };
    }
    
    const violations = [];
    const { owner, repo } = context.repo();
    
    // Check each required context
    for (const contextName of nonExemptContexts) {
      const workflowPath = CONTEXT_TO_WORKFLOW[contextName];
      
      if (!workflowPath) {
        violations.push({
          code: 'unknown_context',
          message: `Unknown context "${contextName}" - no workflow mapping defined`,
          meta: { context: contextName }
        });
        continue;
      }
      
      try {
        // Check if workflow file exists
        const { data: fileContent } = await context.octokit.repos.getContent({
          owner,
          repo,
          path: workflowPath
        });
        
        // Decode and parse the workflow content
        const workflowYaml = Buffer.from(fileContent.content, 'base64').toString('utf8');
        
        // Check if workflow name matches the required context
        const nameMatch = workflowYaml.match(/^name:\s*(.+)$/m);
        const workflowName = nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, '') : null;
        
        if (workflowName !== contextName) {
          violations.push({
            code: 'workflow_name_mismatch',
            message: `Workflow "${workflowPath}" has name "${workflowName}" but context requires "${contextName}"`,
            path: workflowPath,
            meta: { 
              expected_name: contextName, 
              actual_name: workflowName,
              context: contextName
            }
          });
        }
        
      } catch (error) {
        if (error.status === 404) {
          violations.push({
            code: 'workflow_missing',
            message: `Required workflow file "${workflowPath}" not found for context "${contextName}"`,
            path: workflowPath,
            meta: { context: contextName }
          });
        } else {
          context.log?.error('Error checking workflow file', {
            path: workflowPath,
            context: contextName,
            error: error.message
          });
          violations.push({
            code: 'workflow_check_error',
            message: `Failed to check workflow "${workflowPath}": ${error.message}`,
            path: workflowPath,
            meta: { context: contextName, error: error.message }
          });
        }
      }
    }
    
    // Determine status
    const status = violations.length > 0 ? 'fail' : 'pass';
    
    return {
      status,
      violations,
      stats: { 
        contexts_checked: nonExemptContexts.length,
        contexts_with_issues: violations.length,
        exempt_contexts: [PR_REVIEW_NAME]
      },
      duration_ms: Date.now() - startTime
    };
    
  } catch (error) {
    context.log?.error('Governance policy gate crashed', { error: error.message });
    
    return {
      status: 'neutral',
      neutral_reason: 'internal_error',
      violations: [],
      stats: { error: error.message },
      duration_ms: Date.now() - startTime
    };
  }
}