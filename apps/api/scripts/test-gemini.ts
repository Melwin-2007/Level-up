import { z } from 'zod';
import { GeminiLlmClient } from '../src/ai/gemini-llm.client.js';

const apiKey = process.env.AI_API_KEY;
const model = process.env.AI_MODEL || 'gemini-3.5-flash';

if (!apiKey) {
  console.error('ERROR: AI_API_KEY is not set in environment');
  process.exit(1);
}

const client = new GeminiLlmClient({ apiKey, model });

const testSchema = z.object({
  status: z.enum(['ready', 'ok']),
  message: z.string(),
  latencyTest: z.string(),
});

console.log(`Connecting to Gemini API with model: ${model}...`);
const startTime = Date.now();

try {
  const response = await client.generateStructured({
    promptId: 'live-connectivity-test',
    promptVersion: '1.0',
    systemPrompt:
      'You are an AI planner assistant. Always respond with valid JSON matching the schema.',
    userPrompt:
      'Respond with status: "ready", a greeting in message, and the word "pass" in latencyTest.',
    schema: testSchema,
    actionType: 'connectivity_test',
  });

  const durationMs = Date.now() - startTime;
  console.log('STATUS: SUCCESS');
  console.log(`LATENCY: ${durationMs}ms`);
  console.log(`DATA: ${JSON.stringify(response.data)}`);
  console.log(
    `TOKENS: prompt=${response.usage.promptTokens}, completion=${response.usage.completionTokens}`
  );
  console.log(`MODEL: ${response.model}`);
} catch (err) {
  console.error('STATUS: FAILED');
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
