import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { EnvConfig } from '../config/env.schema';

export const REDIS_CONNECTION = 'REDIS_CONNECTION';

export const redisProvider: Provider = {
  provide: REDIS_CONNECTION,
  useFactory: (configService: ConfigService<EnvConfig, true>) => {
    const logger = new Logger('RedisProvider');
    const redisUrl = configService.get('REDIS_URL', { infer: true });
    const nodeEnv = configService.get('NODE_ENV', { infer: true });

    if (nodeEnv === 'test' || !redisUrl) {
      logger.log('Redis URL not configured or test environment: running jobs in in-memory mode');
      return null;
    }

    logger.log(`Connecting to Redis at ${redisUrl.replace(/\/\/[^@]*@/, '//***@')}`);
    return new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  },
  inject: [ConfigService],
};
