import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type {
  CreateGroupInput,
  GroupDetailResponse,
  GroupListResponse,
  JoinGroupInput,
} from '@mp/shared';
import { generateInviteCode } from '../common/utils/invite-code.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class GroupsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  async createGroup(userId: string, dto: CreateGroupInput): Promise<GroupDetailResponse> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const inviteCode = generateInviteCode();
      try {
        const group = await this.prisma.$transaction(async (tx) => {
          const created = await tx.group.create({
            data: {
              name: dto.name,
              ownerId: userId,
              inviteCode,
            },
          });

          await tx.groupMember.create({
            data: {
              groupId: created.id,
              userId,
              role: 'owner',
            },
          });

          return created;
        });

        return this.getGroupById(group.id, userId);
      } catch (err: unknown) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          attempt < 4
        ) {
          continue;
        }
        throw err;
      }
    }

    throw new ConflictException({
      code: 'CYCLE_STATE_INVALID',
      message: 'Failed to generate a unique invite code. Please try again.',
    });
  }

  async getMyGroups(userId: string): Promise<GroupListResponse> {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return {
      items: memberships.map((m) => ({
        id: m.group.id,
        name: m.group.name,
        role: m.role,
        memberCount: m.group._count.members,
        createdAt: m.group.createdAt.toISOString(),
      })),
    };
  }

  async getGroupById(groupId: string, userId: string): Promise<GroupDetailResponse> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: true,
          },
          orderBy: {
            joinedAt: 'asc',
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    const callerMembership = group.members.find((m) => m.userId === userId);
    if (!callerMembership) {
      // DECISION 20: Non-members always receive 404, not 403, for group-scoped resources
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    const isOwnerOrAdmin = callerMembership.role === 'owner' || callerMembership.role === 'admin';

    return {
      id: group.id,
      name: group.name,
      role: callerMembership.role,
      createdAt: group.createdAt.toISOString(),
      inviteCode: isOwnerOrAdmin ? group.inviteCode : undefined,
      members: group.members.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }

  async joinGroup(userId: string, dto: JoinGroupInput): Promise<GroupDetailResponse> {
    const code = dto.inviteCode.trim().toUpperCase();

    const group = await this.prisma.group.findUnique({
      where: { inviteCode: code },
      include: {
        members: true,
      },
    });

    if (!group) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'That code does not match a group',
      });
    }

    const isAlreadyMember = group.members.some((m) => m.userId === userId);
    if (isAlreadyMember) {
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'You are already a member of this group',
      });
    }

    const rawCap = process.env['MAX_GROUP_MEMBERS'] ?? this.configService.get('MAX_GROUP_MEMBERS');
    const cap =
      rawCap !== undefined && rawCap !== null && !Number.isNaN(Number(rawCap))
        ? Number(rawCap)
        : 12;

    if (group.members.length >= cap) {
      throw new ConflictException({
        code: 'GROUP_FULL',
        message: 'This group is full',
      });
    }

    await this.prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: 'member',
      },
    });

    return this.getGroupById(group.id, userId);
  }

  async requireMembership(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
      include: { group: true },
    });

    if (!member) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    return member;
  }

  async requireAdmin(groupId: string, userId: string) {
    const member = await this.requireMembership(groupId, userId);

    if (member.role !== 'owner' && member.role !== 'admin') {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Admin or owner role required',
      });
    }

    return member;
  }
}
