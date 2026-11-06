import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service.js';
import { LLM_CLIENT } from './llm-client.interface.js';
import { FakeLlmClient } from './fake-llm.client.js';
import { GeminiLlmClient } from './gemini-llm.client.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: LLM_CLIENT,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('AI_PROVIDER', 'fake');
        if (provider === 'gemini') {
          const apiKey = config.get<string>('AI_API_KEY', '');
          const model = config.get<string>('AI_MODEL', 'gemini-2.0-flash');
          return new GeminiLlmClient({ apiKey, model });
        }
        return new FakeLlmClient();
      },
      inject: [ConfigService],
    },
    AiService,
  ],
  exports: [AiService, LLM_CLIENT],
})
export class AiModule {}
