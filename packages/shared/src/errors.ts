export const API_ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'FORBIDDEN_ROLE',
  'PROFILE_REQUIRED',
  'NOT_FOUND',
  'SUBMISSION_LOCKED',
  'CYCLE_STATE_INVALID',
  'ALREADY_MEMBER',
  'CYCLE_EXISTS',
  'REVIEW_EXISTS',
  'GROUP_FULL',
  'RATE_LIMITED',
  'INTERNAL_SERVER_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}
