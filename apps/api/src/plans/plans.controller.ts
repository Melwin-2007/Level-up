import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  generatePlanInputSchema,
  type GeneratePlanInput,
  approvePlanInputSchema,
  type ApprovePlanInput,
} from '@mp/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { PlansService, type PlanVersionResponse } from './plans.service.js';

@Controller('cycles/:id')
export class PlansController {
  constructor(@Inject(PlansService) private readonly plansService: PlansService) {}

  @Post('generate-plan')
  async generatePlan(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) cycleId: string,
    @Body(new ZodValidationPipe(generatePlanInputSchema)) body: GeneratePlanInput
  ): Promise<{ planVersion: PlanVersionResponse }> {
    const planVersion = await this.plansService.generatePlan(cycleId, user.userId, body);
    return { planVersion };
  }

  @Post('approve-plan')
  async approvePlan(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) cycleId: string,
    @Body(new ZodValidationPipe(approvePlanInputSchema)) body: ApprovePlanInput
  ): Promise<{ planVersion: PlanVersionResponse }> {
    const planVersion = await this.plansService.approvePlan(cycleId, user.userId, body);
    return { planVersion };
  }

  @Get('plan')
  async getPlan(
    @CurrentUser() user: { userId: string },
    @Param('id', new ParseUUIDPipe()) cycleId: string
  ): Promise<{ planVersion: PlanVersionResponse }> {
    const planVersion = await this.plansService.getLatestPlan(cycleId, user.userId);
    if (!planVersion) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'No plan found for this cycle',
        },
      });
    }
    return { planVersion };
  }
}
