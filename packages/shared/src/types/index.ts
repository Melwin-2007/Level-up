export * from '../errors.js';
export * from '../status.js';

export interface UserProfile {
  id: string;
  displayName: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  role: import('../status.js').GroupRole;
  memberCount: number;
}
