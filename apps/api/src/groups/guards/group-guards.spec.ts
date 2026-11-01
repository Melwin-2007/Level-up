import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { GroupsService } from '../groups.service.js';
import { GroupAdminGuard } from './group-admin.guard.js';
import { GroupMemberGuard } from './group-member.guard.js';

describe('GroupGuards (unit)', () => {
  const mockGroupsService = {
    requireMembership: vi.fn(),
    requireAdmin: vi.fn(),
  } as unknown as GroupsService;

  const memberGuard = new GroupMemberGuard(mockGroupsService);
  const adminGuard = new GroupAdminGuard(mockGroupsService);

  const createMockContext = (
    userId?: string,
    params?: { id?: string; groupId?: string }
  ): ExecutionContext => {
    const request = {
      user: userId ? { userId } : undefined,
      params: params ?? {},
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  describe('GroupMemberGuard', () => {
    it('should throw 404 NOT_FOUND if userId or groupId is missing', async () => {
      const ctx = createMockContext(undefined, { id: 'group-123' });
      await expect(memberGuard.canActivate(ctx)).rejects.toThrowError(NotFoundException);
    });

    it('should call requireMembership and return true when valid', async () => {
      vi.mocked(mockGroupsService.requireMembership).mockResolvedValueOnce({} as never);
      const ctx = createMockContext('user-1', { id: 'group-1' });
      const result = await memberGuard.canActivate(ctx);
      expect(result).toBe(true);
      expect(mockGroupsService.requireMembership).toHaveBeenCalledWith('group-1', 'user-1');
    });
  });

  describe('GroupAdminGuard', () => {
    it('should throw 404 NOT_FOUND if userId or groupId is missing', async () => {
      const ctx = createMockContext('user-1', {});
      await expect(adminGuard.canActivate(ctx)).rejects.toThrowError(NotFoundException);
    });

    it('should call requireAdmin and return true when user is admin/owner', async () => {
      vi.mocked(mockGroupsService.requireAdmin).mockResolvedValueOnce({} as never);
      const ctx = createMockContext('user-1', { groupId: 'group-1' });
      const result = await adminGuard.canActivate(ctx);
      expect(result).toBe(true);
      expect(mockGroupsService.requireAdmin).toHaveBeenCalledWith('group-1', 'user-1');
    });

    it('should rethrow ForbiddenException if requireAdmin throws FORBIDDEN_ROLE', async () => {
      vi.mocked(mockGroupsService.requireAdmin).mockRejectedValueOnce(
        new ForbiddenException({ code: 'FORBIDDEN_ROLE', message: 'Admin or owner role required' })
      );
      const ctx = createMockContext('user-1', { id: 'group-1' });
      await expect(adminGuard.canActivate(ctx)).rejects.toThrowError(ForbiddenException);
    });
  });
});
