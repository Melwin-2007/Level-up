import { Injectable } from '@nestjs/common';
import { LlmClient, LlmGenerateParams, LlmResponse } from './llm-client.interface.js';

export type FakeResponseHandler = (
  params: LlmGenerateParams<unknown>
) => unknown | Promise<unknown>;

@Injectable()
export class FakeLlmClient implements LlmClient {
  private handlers = new Map<string, FakeResponseHandler>();
  private defaultResponse: unknown = null;

  setHandler(promptId: string, handler: FakeResponseHandler): void {
    this.handlers.set(promptId, handler);
  }

  setDefaultResponse(response: unknown): void {
    this.defaultResponse = response;
  }

  clearHandlers(): void {
    this.handlers.clear();
    this.defaultResponse = null;
  }

  async generateStructured<T>(params: LlmGenerateParams<T>): Promise<LlmResponse<T>> {
    const handler = this.handlers.get(params.promptId);
    let rawOutput: unknown;

    if (handler) {
      rawOutput = await handler(params as LlmGenerateParams<unknown>);
    } else if (this.defaultResponse !== null) {
      rawOutput = this.defaultResponse;
    } else {
      rawOutput = {};
    }

    const rawText = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput);
    let parsedJson: unknown;
    try {
      parsedJson = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
    } catch {
      throw new Error(`FakeLlmClient: output is not valid JSON: ${rawText}`);
    }

    const validated = params.schema.parse(parsedJson);

    return {
      data: validated,
      rawText,
      usage: {
        promptTokens: 150,
        completionTokens: 250,
        totalCost: 0.00008,
      },
      model: 'fake-model-v1',
      promptId: params.promptId,
      promptVersion: params.promptVersion,
    };
  }
}
