import { Inject, Injectable } from '@nestjs/common';
import type { MemberSubmissionStatus } from '@mp/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SubmissionsStatusPort } from './submissions-status.port.js';

@Injectable()
export class PrismaSubmissionsStatusRepository implements SubmissionsStatusPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMemberSubmissionStatuses(
    cycleId: string,
    memberUserIds: string[]
  ): Promise<Map<string, MemberSubmissionStatus>> {
    const statusMap = new Map<string, MemberSubmissionStatus>();
    for (const id of memberUserIds) {
      statusMap.set(id, 'none');
    }

    if (memberUserIds.length === 0) {
      return statusMap;
    }

    const submissions = await this.prisma.monthlySubmission.findMany({
      where: {
        cycleId,
        userId: { in: memberUserIds },
      },
      select: {
        userId: true,
        status: true,
      },
    });

    for (const sub of submissions) {
      if (sub.status === 'draft' || sub.status === 'submitted' || sub.status === 'locked') {
        statusMap.set(sub.userId, sub.status);
      }
    }

    return statusMap;
  }
}
