import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Headers,
  Inject,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  type QueryTasksInput,
  type LogTaskActionInput,
  type TaskResponse,
  type TaskLogResponse,
  queryTasksSchema,
  logTaskActionSchema,
} from '@mp/shared';
import { CurrentUser, type CurrentUserPayload } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { TasksService } from './tasks.service.js';

@Controller('tasks')
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasksService: TasksService) {}

  @Get()
  async getTasks(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(queryTasksSchema)) query: QueryTasksInput
  ): Promise<{ tasks: TaskResponse[] }> {
    const tasks = await this.tasksService.getTasks(user.userId, query);
    return { tasks };
  }

  @Get(':id')
  async getTask(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<{ task: TaskResponse }> {
    const task = await this.tasksService.getTask(user.userId, id);
    return { task };
  }

  @Post(':id/log')
  async logTaskAction(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(logTaskActionSchema)) body: LogTaskActionInput,
    @Headers('idempotency-key') idempotencyKey?: string
  ): Promise<{ task: TaskResponse; log: TaskLogResponse }> {
    return this.tasksService.logTaskAction(user.userId, id, body, idempotencyKey);
  }
}
