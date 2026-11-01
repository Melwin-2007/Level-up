import type { MemberSubmissionStatus } from '@mp/shared';

export const SUBMISSIONS_STATUS_PORT = Symbol('SUBMISSIONS_STATUS_PORT');

export interface SubmissionsStatusPort {
  getMemberSubmissionStatuses(
    cycleId: string,
    memberUserIds: string[]
  ): Promise<Map<string, MemberSubmissionStatus>>;
}
