/**
 * Goal-evaluation workflow.
 * Called ONLY by src/ai/provider.js
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

// Schema for structured output - matches provider-result format directly
const EvaluationSchema = z.object({
  metrics: z.object({
    "statement-1": z.object({
      value: z.number().min(0).max(1).describe("Score for evaluation statement 1"),
      observations: z.array(z.string()).describe("Observations for statement 1")
    }),
    "statement-2": z.object({
      value: z.number().min(0).max(1).describe("Score for evaluation statement 2"), 
      observations: z.array(z.string()).describe("Observations for statement 2")
    })
  }).describe("Metrics with per-metric observations"),
  summary: z.string().describe("Summary of both evaluations")
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
      prompt: "Evaluate the <PR Information> against two separate evaluation statements.",
      schema: EvaluationSchema
    }
  });
}

/**
 * Evaluate PR against dual statements using ReAct agent - Goal Alignment v2
 * @param {Object} input - { evaluation_statement_1, evaluation_statement_2, pr_title, pr_body, diff_summary }
 * @param {Object} options - { timeoutMs, client }
 * @returns {Promise<Object>} { metrics: { "statement-1": score1, "statement-2": score2 }, observations, summary }
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

  const promptText = `You are an expert in analyzing code pull requests against evaluation criteria. Here is the current PR:

<PR Information>
<PR Title> ${input.pr_title} </PR Title>

<PR Body> ${input.pr_body} </PR Body>

<Diff Summary> ${input.diff_summary} </Diff Summary>
</PR Information>

Evaluate this PR against TWO separate statements. Evaluate each statement separately and independently:

1. <evaluation_statement_1> ${input.evaluation_statement_1} </evaluation_statement_1>

2. <evaluation_statement_2> ${input.evaluation_statement_2} </evaluation_statement_2>

For each statement, provide:
- A score from 0.0-1.0 (1.0 = best)
- Short observations (1-5) justifying the score
- Brief summary explanation

Expected output format:
- metrics: {"statement-1": {value: score1, observations: [obs1, obs2]}, "statement-2": {value: score2, observations: [obs3, obs4]}}
- summary: "Combined summary of both evaluations"`;


  const message = new HumanMessage(promptText);
  
  console.log('🤖 LangGraph: Prompt input:', promptText);
  console.log('🤖 LangGraph: Invoking agent...');
  const result = await agent.invoke({
    messages: [message]
  });
  
  console.log(`🤖 LangGraph: Completed in ${Date.now() - startTime}ms`, result.structuredResponse);
  return result.structuredResponse;
}