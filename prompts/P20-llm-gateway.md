# P20: LLM Gateway

READ: AGENTS.md, docs/PROGRESS.md, docs/SECURITY.md, docs/DECISIONS.md (32, 35).

## Goal

Create `apps/api/src/ai` with a robust, pluggable LLM Gateway supporting structured outputs validated with Zod, timeouts, jittered retries, prompt versioning, and cost/token auditing in `ai_action_logs`.

## Tasks

1. Define `LlmClient` interface in `apps/api/src/ai/llm-client.interface.ts`:
   - `generateStructured<T>(params: { promptId: string; promptVersion: string; systemPrompt: string; userPrompt: string; schema: z.ZodType<T>; userId?: string; actionType: string; }): Promise<LlmResponse<T>>`
   - `LlmResponse<T>` returns `{ data: T; usage: { promptTokens: number; completionTokens: number; totalCost?: number }; model: string; promptVersion: string }`.
2. Implement `FakeLlmClient` returning fixtures for tests or when `AI_PROVIDER=fake`.
3. Implement `GeminiLlmClient` (or fetch-based provider) when `AI_PROVIDER=gemini` using `AI_API_KEY` and `AI_MODEL` (e.g. `gemini-1.5-flash` or `gemini-2.0-flash`).
4. Features:
   - 30s timeout per call.
   - Max 2 retries with exponential backoff and jitter on 429/5xx or validation failure (retries schema validation once on malformed JSON).
   - Write every completed or failed AI call to `ai_action_logs` table (tokens, model, cost, user_id, action_type).
   - Secrets sanitized: `AI_API_KEY` never appears in logs, exception traces, or error responses.
5. Unit and integration tests in `apps/api/src/ai/__tests__/llm-gateway.spec.ts`:
   - Schema violations are rejected and retried once.
   - Timeout triggers error handling.
   - Secrets never appear in error messages or logs.
   - `ai_action_logs` entries are written with correct token/model metadata.

## Verify

```
pnpm --filter api test -- src/ai
```

## Finish

Tick P20 in `docs/PROGRESS.md`, commit `feat(api): llm gateway with structured output and audit logging`.
