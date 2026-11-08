import { Module, Global } from '@nestjs/common';
import { redisProvider } from './redis.provider';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';

@Global()
@Module({
  controllers: [JobsController],
  providers: [redisProvider, JobsService],
  exports: [JobsService],
})
export class JobsModule {}
