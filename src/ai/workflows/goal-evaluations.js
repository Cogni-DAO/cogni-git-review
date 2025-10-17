/**
 * Goal-evaluation workflow.
 * Called ONLY by src/ai/provider.js
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

/**
 * Gather evidence from PR changes based on rule capabilities
 * Works directly with Probot context object
 */
async function gatherEvidence(context, capabilities = [], budgets = {}) {
  // If no diff_summary capability requested, return simple summary
  if (!capabilities.includes('diff_summary')) {
    return null;
  }

  try {
    const pullNumber = context.pr?.number;
    if (!pullNumber) {
      return 'No PR number available';
    }

    const { owner, repo } = context.repo();
    const { data: files } = await context.vcs.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber
    });

    const maxFiles = budgets.max_files || 25;
    const maxPatchBytes = budgets.max_patch_bytes_per_file || 16000;
    const maxPatches = budgets.max_patches || 3;

    // Sort files deterministically by churn (changes) then path
    const sortedFiles = files
      .slice(0, maxFiles)
      .sort((a, b) => {
        const churnDiff = (b.changes || 0) - (a.changes || 0);
        return churnDiff !== 0 ? churnDiff : a.filename.localeCompare(b.filename);
      });

    const totals = sortedFiles.reduce((acc, f) => ({
      files: acc.files + 1,
      additions: acc.additions + (f.additions || 0),
      deletions: acc.deletions + (f.deletions || 0)
    }), { files: 0, additions: 0, deletions: 0 });

    // Build deterministic diff summary string
    let summary = `${totals.files} file${totals.files === 1 ? '' : 's'} changed, +${totals.additions}/−${totals.deletions} total\n`;

    // Add file list
    for (const f of sortedFiles) {
      const status = f.status || 'modified';
      const adds = f.additions || 0;
      const dels = f.deletions || 0;
      summary += `• ${f.filename} (${status}) +${adds}/−${dels}\n`;
    }

    // Add patch content if file_patches capability requested
    if (capabilities.includes('file_patches') && maxPatches > 0) {
      summary += '\nTop patches (truncated):\n';

      const filesToPatch = sortedFiles.slice(0, maxPatches);
      for (const f of filesToPatch) {
        if (f.patch) {
          let patch = f.patch;
          if (patch.length > maxPatchBytes) {
            patch = patch.slice(0, maxPatchBytes) + '\n… [truncated]';
          }
          summary += `=== ${f.filename} ===\n${patch}\n\n`;
        }
      }
    }

    return summary.trim();

  } catch (error) {
    // Return error info but don't fail the gate
    return `Error gathering diff: ${error.message}`;
  }
}

/**
 * Create dynamic evaluation schema based on input evaluations
 * @param {Object} evaluationsObj - Parsed evaluations object
 * @returns {z.ZodObject} Dynamic Zod schema
 */
function createEvaluationSchema(evaluationsObj) {
  const metricsSchema = {};
  for (const metricId of Object.keys(evaluationsObj)) {
    metricsSchema[metricId] = z.object({
      value: z.number().min(0).max(1).describe(`Score for ${metricId} evaluation`),
      observations: z.array(z.string()).describe(`Observations for ${metricId}`)
    });
  }
  return z.object({
    metrics: z.object(metricsSchema).describe("Metrics with per-metric observations"),
    summary: z.string().describe(`Summary of all ${Object.keys(evaluationsObj).length} evaluations`)
  });
}

/**
 * Create ReAct agent with pre-built LLM client and dynamic schema
 * @param {ChatOpenAI} client - Pre-configured OpenAI client
 * @param {z.ZodObject} schema - Dynamic evaluation schema
 * @param {number} evalCount - Number of evaluations
 * @returns {Object} Configured ReAct agent
 */
function createAgent(client, schema, evalCount) {
  const evalText = evalCount === 1 ? "evaluation statement" : `${evalCount} separate evaluation statements`;
  return createReactAgent({
    llm: client,
    tools: [], // No tools - pure reasoning
    responseFormat: {
      prompt: `Evaluate the <PR Information> against ${evalText}.`,
      schema: schema
    }
  });
}

/**
 * Evaluate PR against dynamic evaluations using ReAct agent
 * @param {Object} input - { context, rule }
 * @param {Object} options - { timeoutMs, client, callbacks, tags, metadata, configurable }
 * @returns {Promise<Object>} { metrics: { metricId: {value, observations} }, summary }
 */
export async function evaluate(input, { timeoutMs: _timeoutMs, client, callbacks = [], tags = [], metadata = {}, configurable = {}, logger } = {}) {
  // Note: OPENAI_API_KEY validation now handled in centralized env module

  if (!client) {
    throw new Error('Pre-built LLM client is required');
  }

  const startTime = Date.now();
  const log = logger?.child({ module: 'ai-workflows/goal-evaluations' });

  // Extract context and rule from input
  const { context, rule } = input;

  // Build budget configuration with review-limits as authoritative source for file limits
  const budgets = {
    // Use review-limits max_changed_files as max_files, fallback to hardcoded default
    max_files: context.reviewLimitsConfig?.max_changed_files || 25,
    max_patch_bytes_per_file: 16000,  // Keep workflow-specific default
    max_patches: 3                    // Keep workflow-specific default
  };

  // Gather evidence based on rule capabilities
  const enhancedDiffSummary = await gatherEvidence(
    context, 
    rule.x_capabilities || [], 
    budgets
  );

  // Get basic PR data from context
  const prData = context.pr;
  
  // Fall back to basic summary if evidence gathering disabled or failed
  let diff_summary;
  if (enhancedDiffSummary) {
    diff_summary = enhancedDiffSummary;
  } else {
    const fileCount = prData?.changed_files || 0;
    const totalAdditions = prData?.additions || 0;
    const totalDeletions = prData?.deletions || 0;
    diff_summary = `PR "${prData?.title || 'Untitled'}" modifies ${fileCount} file${fileCount === 1 ? '' : 's'} (+${totalAdditions} -${totalDeletions} lines)`;
  }

  // Parse evaluations array into usable format
  const evaluationsObj = {};
  for (const evaluation of rule.evaluations) {
    const [metricId, statement] = Object.entries(evaluation)[0];
    evaluationsObj[metricId] = statement;
  }

  // Create dynamic schema and agent
  const schema = createEvaluationSchema(evaluationsObj);
  const agent = createAgent(client, schema, Object.keys(evaluationsObj).length);

  // Generate dynamic prompt
  const statements = Object.entries(evaluationsObj)
    .map(([id, text], i) => `${i+1}. <${id}> ${text} </${id}>`)
    .join('\n\n');

  const evalCount = Object.keys(evaluationsObj).length;
  const evalText = evalCount === 1 ? "statement" : `${evalCount} separate statements`;
  const exampleMetrics = Object.keys(evaluationsObj)
    .map(id => `"${id}": {value: scoreX, observations: [obsX]}`)
    .join(', ');

  const promptText = `You are an expert in analyzing code pull requests against evaluation criteria. Here is the current PR:

<PR Information>
<PR Title> ${prData.title || ''} </PR Title>

<PR Body> ${prData.body || ''} </PR Body>

<Diff Summary> ${diff_summary} </Diff Summary>
</PR Information>

Evaluate this PR against ${evalText}. Evaluate each statement separately and independently:

${statements}

For each statement, provide:
- A score from 0.0-1.0 (1.0 = best)
- Short observations (1-5) justifying the score
- Brief summary explanation

Expected output format:
- metrics: {${exampleMetrics}}
- summary: "Combined summary of all evaluations"`;


  const message = new HumanMessage(promptText);
  
  log?.debug({ prompt_length: promptText.length }, 'LangGraph prompt prepared');
  log?.debug('LangGraph agent starting');
  // Create PR-specific metadata for this workflow
  const workflowMeta = {
    ...metadata, // Generic provider metadata (workflow_id, model, environment)
    // PR-specific tracing metadata
    repo: context.payload?.repository?.full_name,
    pr_number: context.pr?.number,
    commit_sha: context.payload?.pull_request?.head?.sha,
    installation_id: context.payload?.installation?.id,
    repo_owner: context.repo().owner,
    repo_name: context.repo().repo,
    rule_id: rule.rule_key,
    evaluation_count: Object.keys(evaluationsObj).length
  };

  const result = await agent.invoke({
    messages: [message]
  }, {
    callbacks,
    // Extend provider tags with workflow-specific context
    tags: [...tags, "agent:goal-evaluations", `repo:${workflowMeta.repo}`].filter(Boolean),
    metadata: workflowMeta,
    configurable: { 
      ...configurable,
      sessionId: workflowMeta.pr_number ? `pr-${workflowMeta.pr_number}` : undefined 
    }
  });
  
  const duration = Date.now() - startTime;
  log?.debug({ duration_ms: duration, has_metrics: !!result.structuredResponse?.metrics }, 'LangGraph completed');
  return result.structuredResponse;
}