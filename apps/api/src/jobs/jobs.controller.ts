import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JobsService } from './jobs.service';
import type { QueueStatus } from './jobs.types';

@Controller('admin/queues')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  async getQueueStatuses(): Promise<{ queues: QueueStatus[] }> {
    const statuses = await this.jobsService.getAllQueueStatuses();
    return { queues: statuses };
  }
}
