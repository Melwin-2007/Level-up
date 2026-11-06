import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { FakeLlmClient } from '../fake-llm.client.js';
import { GeminiLlmClient } from '../gemini-llm.client.js';
import { AiService } from '../ai.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('LLM Gateway (P20)', () => {
  describe('FakeLlmClient', () => {
    it('should generate structured output matching schema', async () => {
      const client = new FakeLlmClient();
      const schema = z.object({
        status: z.enum(['ok', 'fail']),
        count: z.number(),
      });

      client.setDefaultResponse({ status: 'ok', count: 42 });

      const result = await client.generateStructured({
        promptId: 'test-prompt',
        promptVersion: 'v1',
        userPrompt: 'give me status',
        schema,
        actionType: 'test',
      });

      expect(result.data).toEqual({ status: 'ok', count: 42 });
      expect(result.usage.promptTokens).toBeGreaterThan(0);
      expect(result.model).toBe('fake-model-v1');
    });

    it('should reject output that violates schema', async () => {
      const client = new FakeLlmClient();
      const schema = z.object({
        requiredField: z.string(),
      });

      client.setDefaultResponse({ wrongField: 123 });

      await expect(
        client.generateStructured({
          promptId: 'test-prompt',
          promptVersion: 'v1',
          userPrompt: 'test',
          schema,
          actionType: 'test',
        })
      ).rejects.toThrow();
    });

    it('should invoke prompt-specific handlers', async () => {
      const client = new FakeLlmClient();
      const schema = z.object({ name: z.string() });

      client.setHandler('custom-prompt', () => ({ name: 'custom-output' }));

      const result = await client.generateStructured({
        promptId: 'custom-prompt',
        promptVersion: 'v1',
        userPrompt: 'test',
        schema,
        actionType: 'test',
      });

      expect(result.data.name).toBe('custom-output');
    });
  });

  describe('GeminiLlmClient', () => {
    const secretKey = 'super-secret-gemini-key-12345';

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('should sanitize API key from error messages', async () => {
      const client = new GeminiLlmClient({ apiKey: secretKey });
      const schema = z.object({ value: z.string() });

      // Mock fetch to simulate a 400 error containing the key in the URL/body
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => `Invalid request for key ${secretKey}`,
      } as unknown as Response);

      let caughtError: Error | null = null;
      try {
        await client.generateStructured({
          promptId: 'test',
          promptVersion: 'v1',
          userPrompt: 'hello',
          schema,
          actionType: 'test',
          timeoutMs: 1000,
        });
      } catch (err: unknown) {
        caughtError = err as Error;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError?.message).not.toContain(secretKey);
      expect(caughtError?.message).toContain('[REDACTED_API_KEY]');
    });

    it('should retry once on schema violation and succeed if second attempt passes', async () => {
      const client = new GeminiLlmClient({ apiKey: 'test-key' });
      const schema = z.object({ answer: z.string() });

      const firstBadResponse = {
        candidates: [{ content: { parts: [{ text: JSON.stringify({ wrongKey: 123 }) }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 },
      };

      const secondGoodResponse = {
        candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: '42' }) }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 15 },
      };

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => firstBadResponse,
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => secondGoodResponse,
        } as unknown as Response);

      const res = await client.generateStructured({
        promptId: 'test',
        promptVersion: 'v1',
        userPrompt: 'what is 6x7',
        schema,
        actionType: 'test',
      });

      expect(res.data).toEqual({ answer: '42' });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error when max retries exceeded for schema violation', async () => {
      const client = new GeminiLlmClient({ apiKey: 'test-key' });
      const schema = z.object({ answer: z.string() });

      const badResponse = {
        candidates: [{ content: { parts: [{ text: JSON.stringify({ wrongKey: 123 }) }] } }],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => badResponse,
      } as unknown as Response);

      await expect(
        client.generateStructured({
          promptId: 'test',
          promptVersion: 'v1',
          userPrompt: 'test',
          schema,
          actionType: 'test',
        })
      ).rejects.toThrow(/schema validation failed/i);
    });

    it('should handle timeout via AbortController', async () => {
      const client = new GeminiLlmClient({ apiKey: 'test-key' });
      const schema = z.object({ ok: z.boolean() });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            setTimeout(() => reject(err), 50);
          })
      );

      await expect(
        client.generateStructured({
          promptId: 'timeout-test',
          promptVersion: 'v1',
          userPrompt: 'test',
          schema,
          actionType: 'test',
          timeoutMs: 30,
        })
      ).rejects.toThrow(/timed out/i);
    });
  });

  describe('AiService Audit Logging', () => {
    it('should write token usage, model, and cost to ai_action_logs', async () => {
      const fakeClient = new FakeLlmClient();
      fakeClient.setDefaultResponse({ result: 'done' });

      const mockCreate = vi.fn().mockResolvedValue({ id: 'log-123' });
      const mockPrisma = {
        aiActionLog: {
          create: mockCreate,
        },
      } as unknown as PrismaService;

      const aiService = new AiService(fakeClient, mockPrisma);
      const schema = z.object({ result: z.string() });

      const res = await aiService.generateStructured({
        promptId: 'audit-test',
        promptVersion: 'v1.0',
        userPrompt: 'run audit',
        schema,
        userId: '11111111-1111-1111-1111-111111111111',
        actionType: 'plan_generation',
      });

      expect(res.data.result).toBe('done');
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: '11111111-1111-1111-1111-111111111111',
          actionType: 'plan_generation',
          model: 'fake-model-v1',
          promptTokens: 150,
          completionTokens: 250,
        }),
      });
    });
  });
});
