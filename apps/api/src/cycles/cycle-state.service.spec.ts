import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  CYCLE_OPERATIONS,
  CYCLE_STATUSES,
  type CycleOperation,
  type CycleStatus,
} from '@mp/shared';
import { FakeClock } from '../../test/helpers/clock.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CycleStateService, STATE_MATRIX } from './cycle-state.service.js';

describe('CycleStateService (State Matrix unit tests - TESTING.md item 10)', () => {
  const fakeClock = new FakeClock();
  const mockPrisma = {} as unknown as PrismaService;
  const service = new CycleStateService(mockPrisma, fakeClock);

  for (const operation of CYCLE_OPERATIONS) {
    describe(`Operation: ${operation}`, () => {
      for (const status of CYCLE_STATUSES) {
        const expectedAllowed = STATE_MATRIX[operation as CycleOperation][status as CycleStatus];

        it(`should ${expectedAllowed ? 'allow' : 'reject'} in status '${status}'`, () => {
          if (expectedAllowed) {
            expect(() => service.assertAllows({ status }, operation)).not.toThrow();
          } else {
            expect(() => service.assertAllows({ status }, operation)).toThrowError(
              ConflictException
            );
            try {
              service.assertAllows({ status }, operation);
            } catch (err) {
              const res = (err as ConflictException).getResponse() as Record<string, unknown>;
              expect(res['code']).toBe('CYCLE_STATE_INVALID');
              expect((res['details'] as Record<string, unknown>)?.['phase']).toBe(status);
            }
          }
        });
      }
    });
  }
});
