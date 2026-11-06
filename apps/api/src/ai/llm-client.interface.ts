import { z } from 'zod';

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalCost?: number;
}

export interface LlmResponse<T> {
  data: T;
  rawText: string;
  usage: LlmUsage;
  model: string;
  promptId: string;
  promptVersion: string;
}

export interface LlmGenerateParams<T> {
  promptId: string;
  promptVersion: string;
  systemPrompt?: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  userId?: string;
  actionType: string;
  timeoutMs?: number;
}

export interface LlmClient {
  generateStructured<T>(params: LlmGenerateParams<T>): Promise<LlmResponse<T>>;
}

export const LLM_CLIENT = Symbol('LLM_CLIENT');
