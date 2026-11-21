import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { XpController } from './xp.controller.js';
import { XpService } from './xp.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [XpController],
  providers: [XpService],
  exports: [XpService],
})
export class XpModule {}
