import { Injectable, Logger } from '@nestjs/common';
import { LlmClient, LlmGenerateParams, LlmResponse } from './llm-client.interface.js';

interface GeminiTokenUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiTokenUsage;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

@Injectable()
export class GeminiLlmClient implements LlmClient {
  private readonly logger = new Logger(GeminiLlmClient.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gemini-2.0-flash';
  }

  private sanitize(message: string): string {
    if (!this.apiKey) return message;
    return message.split(this.apiKey).join('[REDACTED_API_KEY]');
  }

  private calculateCost(promptTokens: number, completionTokens: number): number {
    // Gemini 2.0 Flash approx rates: $0.10 / 1M prompt, $0.40 / 1M completion
    const cost = (promptTokens * 0.1 + completionTokens * 0.4) / 1_000_000;
    return Number(cost.toFixed(6));
  }

  async generateStructured<T>(params: LlmGenerateParams<T>): Promise<LlmResponse<T>> {
    const timeoutMs = params.timeoutMs ?? 30_000;
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        const jitter = Math.random() * 200;
        await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const url = `${this.baseUrl}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

        const body: Record<string, unknown> = {
          contents: [
            {
              role: 'user',
              parts: [{ text: params.userPrompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        };

        if (params.systemPrompt) {
          body.systemInstruction = {
            parts: [{ text: params.systemPrompt }],
          };
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          const sanitizedErr = this.sanitize(errText);
          const status = res.status;

          // Transient errors (429, 500, 503) can be retried
          if ((status === 429 || status >= 500) && attempt < maxRetries) {
            this.logger.warn(
              `Gemini API returned status ${status}, retrying (attempt ${attempt + 1}/${maxRetries})...`
            );
            continue;
          }

          throw new NonRetryableError(`Gemini API error (status ${status}): ${sanitizedErr}`);
        }

        const json = (await res.json()) as GeminiResponse;

        if (json.error) {
          throw new NonRetryableError(`Gemini API error: ${this.sanitize(json.error.message)}`);
        }

        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
          throw new Error('Gemini API returned empty response candidate');
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          if (attempt < maxRetries) {
            this.logger.warn(
              `Malformed JSON from model, retrying (attempt ${attempt + 1}/${maxRetries})...`
            );
            continue;
          }
          throw new Error(`Failed to parse model JSON: ${rawText}`);
        }

        const validation = params.schema.safeParse(parsed);
        if (!validation.success) {
          if (attempt < maxRetries) {
            this.logger.warn(
              `Schema validation failed on attempt ${attempt + 1}: ${validation.error.message}. Retrying...`
            );
            continue;
          }
          throw new Error(
            `Structured output schema validation failed: ${validation.error.message}`
          );
        }

        const promptTokens = json.usageMetadata?.promptTokenCount ?? 0;
        const completionTokens = json.usageMetadata?.candidatesTokenCount ?? 0;
        const totalCost = this.calculateCost(promptTokens, completionTokens);

        return {
          data: validation.data,
          rawText,
          usage: {
            promptTokens,
            completionTokens,
            totalCost,
          },
          model: this.model,
          promptId: params.promptId,
          promptVersion: params.promptVersion,
        };
      } catch (err: unknown) {
        clearTimeout(timer);
        const rawMessage = err instanceof Error ? err.message : String(err);
        const isAbort = err instanceof Error && err.name === 'AbortError';
        const isNonRetryable = err instanceof NonRetryableError;
        const sanitized = isAbort
          ? `Request timed out after ${timeoutMs}ms`
          : this.sanitize(rawMessage);

        lastError = new Error(sanitized);

        if (attempt < maxRetries && !isAbort && !isNonRetryable) {
          continue;
        }
        break;
      }
    }

    throw lastError || new Error('Unknown LLM failure');
  }
}
