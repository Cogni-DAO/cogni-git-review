/**
 * Goal Alignment Workflow - ReAct Agent with Structured Output
 * Called ONLY by src/ai/provider.js
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

// Schema for structured output
const EvaluationSchema = z.object({
  score: z.number().min(0).max(1).describe("Alignment score between 0 and 1"),
  annotations: z.array(z.string()).describe("List of specific observations or issues"),
  summary: z.string().describe("Brief explanation of the evaluation")
});

// Create ReAct agent with structured output
const agent = createReactAgent({
  llm: new ChatOpenAI({ 
    model: "gpt-4o-mini", 
    temperature: 0 
  }),
  tools: [], // No tools - pure reasoning
  responseFormat: {
    prompt: "Evaluate if the <PR Information> aligns with the given <criteria>.",
    schema: EvaluationSchema
  }
});

/**
 * Evaluate PR against statement using ReAct agent
 * @param {Object} input - { statement, pr_title, pr_body, diff_summary }
 * @returns {Promise<Object>} { score, annotations, summary }
 */
export async function evaluate(input) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is missing or empty');
  }

  const startTime = Date.now();

  const promptText = `You are an expert in analyzing code pull requests against a given set of criteria. Here is the current PR you are evaluating:

<PR Information>
<PR Title> ${input.pr_title} </PR Title>

<PR Body> ${input.pr_body} </PR Body>

<Diff Summary> ${input.diff_summary} </Diff Summary>

</PR Information>

Now, evaluate this PR against the following criteria:
<criteria> ${input.statement} </criteria>

Provide a score from 0.0-1.0, with 1.0 being the best score. 
Provide a short list (1-5) of concise annotations that justify the score.`;


  const message = new HumanMessage(promptText);
  
  console.log('🤖 LangGraph: Prompt input:', promptText);
  console.log('🤖 LangGraph: Invoking agent...');
  const result = await agent.invoke({
    messages: [message]
  });
  
  console.log(`🤖 LangGraph: Completed in ${Date.now() - startTime}ms`, result.structuredResponse);
  return result.structuredResponse;
}