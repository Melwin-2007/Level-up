import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z
    .string({ required_error: 'Group name is required' })
    .trim()
    .min(1, 'Group name cannot be empty')
    .max(60, 'Group name cannot exceed 60 characters'),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const joinGroupSchema = z.object({
  inviteCode: z
    .string({ required_error: 'Invite code is required' })
    .trim()
    .min(1, 'Invite code is required')
    .max(16, 'Invite code is invalid'),
});

export type JoinGroupInput = z.infer<typeof joinGroupSchema>;

export interface GroupMemberSummary {
  userId: string;
  displayName: string;
  role: string;
  joinedAt: string;
}

export interface GroupDetailResponse {
  id: string;
  name: string;
  role: string;
  members: GroupMemberSummary[];
  inviteCode?: string;
  createdAt: string;
}

export interface GroupListItem {
  id: string;
  name: string;
  role: string;
  memberCount: number;
  createdAt: string;
}

export interface GroupListResponse {
  items: GroupListItem[];
}
