/**
 * Goal-evaluation workflow.
 * Called ONLY by src/ai/provider.js
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

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
 * @param {Object} input - { evaluations, pr_title, pr_body, diff_summary }
 * @param {Object} options - { timeoutMs, client, callbacks }
 * @returns {Promise<Object>} { metrics: { metricId: {value, observations} }, summary }
 */
export async function evaluate(input, { timeoutMs: _timeoutMs, client, callbacks = [] } = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is missing or empty');
  }

  if (!client) {
    throw new Error('Pre-built LLM client is required');
  }

  const startTime = Date.now();

  // Parse evaluations array into usable format
  const evaluationsObj = {};
  for (const evaluation of input.evaluations) {
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
<PR Title> ${input.pr_title} </PR Title>

<PR Body> ${input.pr_body} </PR Body>

<Diff Summary> ${input.diff_summary} </Diff Summary>
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
  
  console.log('🤖 LangGraph: Prompt input:', promptText);
  console.log('🤖 LangGraph: Invoking agent...');
  const result = await agent.invoke({
    messages: [message]
  }, { callbacks });
  
  console.log(`🤖 LangGraph: Completed in ${Date.now() - startTime}ms`, result.structuredResponse);
  return result.structuredResponse;
}