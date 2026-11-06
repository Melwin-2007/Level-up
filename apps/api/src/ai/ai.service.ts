import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  LLM_CLIENT,
  type LlmClient,
  type LlmGenerateParams,
  type LlmResponse,
} from './llm-client.interface.js';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(LLM_CLIENT) private readonly llmClient: LlmClient,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async generateStructured<T>(params: LlmGenerateParams<T>): Promise<LlmResponse<T>> {
    try {
      const response = await this.llmClient.generateStructured(params);

      // Log action and cost to database audit table
      try {
        await this.prisma.aiActionLog.create({
          data: {
            userId: params.userId ?? null,
            actionType: params.actionType,
            model: response.model,
            promptTokens: response.usage.promptTokens,
            completionTokens: response.usage.completionTokens,
            totalCost: response.usage.totalCost ?? 0,
          },
        });
      } catch (logErr) {
        this.logger.error(
          `Failed to write to ai_action_logs: ${logErr instanceof Error ? logErr.message : logErr}`
        );
      }

      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI call failed [${params.promptId}:${params.promptVersion}]: ${message}`);
      throw err;
    }
  }
}
