/**
 * Single Statement Evaluation Workflow - ReAct Agent with Structured Output
 * Called ONLY by src/ai/provider.js
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

// Schema for structured output - matches new provider-result format
const EvaluationSchema = z.object({
  metrics: z.object({
    score: z.object({
      value: z.number().min(0).max(1).describe("Alignment score between 0 and 1"),
      observations: z.array(z.string()).describe("Specific observations for this score")
    })
  }).describe("Metrics with per-metric observations"),
  summary: z.string().describe("Brief explanation of the evaluation")
});

/**
 * Create ReAct agent with pre-built LLM client
 * @param {ChatOpenAI} client - Pre-configured OpenAI client
 * @returns {Object} Configured ReAct agent
 */
function createAgent(client) {
  return createReactAgent({
    llm: client,
    tools: [], // No tools - pure reasoning
    responseFormat: {
      prompt: "Evaluate if the <PR Information> aligns with the given <evaluation_statement>.",
      schema: EvaluationSchema
    }
  });
}

/**
 * Evaluate PR against statement using ReAct agent
 * @param {Object} input - { evaluation_statement, pr_title, pr_body, diff_summary }
 * @param {Object} options - { timeoutMs, client }
 * @returns {Promise<Object>} standard_ai_rule_eval: { metrics: { score: {value, observations} }, summary }
 */
export async function evaluate(input, { timeoutMs: _timeoutMs, client } = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is missing or empty');
  }

  if (!client) {
    throw new Error('Pre-built LLM client is required');
  }

  const startTime = Date.now();

  // Create agent with pre-built client
  const agent = createAgent(client);

  const promptText = `You are an expert in analyzing code pull requests against a given set of criteria. Here is the current PR you are evaluating:

<PR Information>
<PR Title> ${input.pr_title} </PR Title>

<PR Body> ${input.pr_body} </PR Body>

<Diff Summary> ${input.diff_summary} </Diff Summary>

</PR Information>

Now, evaluate this PR against the following criteria:
<evaluation_statement> ${input.evaluation_statement} </evaluation_statement>

Provide your response in the following format:
- metrics: { score: {value: number from 0.0-1.0, observations: [list of 1-5 observations]} }
- summary: brief explanation of the evaluation`;


  const message = new HumanMessage(promptText);

  console.log('🤖 LangGraph: Prompt input:', promptText);
  console.log('🤖 LangGraph: Invoking agent...');
  const result = await agent.invoke({
    messages: [message]
  });

  console.log(`🤖 LangGraph: Completed in ${Date.now() - startTime}ms`, result.structuredResponse);
  return result.structuredResponse;
}