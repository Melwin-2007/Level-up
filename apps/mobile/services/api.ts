import { type ApiErrorCode } from '@mp/shared';
import { supabase } from './supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api/v1';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message: string,
    status: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_FAILED: 'Validation failed. Check the fields and try again.',
  UNAUTHENTICATED: 'Your session ended. Sign in again.',
  TOKEN_EXPIRED: 'Your session ended. Sign in again.',
  FORBIDDEN_ROLE: 'You do not have permission to perform this action.',
  PROFILE_REQUIRED: 'Profile setup required. Set up your display name and timezone.',
  NOT_FOUND: 'That code does not match a group. Check it and try again.',
  SUBMISSION_LOCKED: 'This submission is locked and cannot be edited.',
  CYCLE_STATE_INVALID: 'This step is closed for the current cycle phase.',
  ALREADY_MEMBER: 'You are already a member of this group.',
  CYCLE_EXISTS: 'A cycle already exists for this month.',
  REVIEW_EXISTS: 'A review already exists for this cycle.',
  GROUP_FULL: 'This group is full. Ask the owner to make room.',
  RATE_LIMITED: 'You are doing that too fast. Please wait a moment and try again.',
  INTERNAL_SERVER_ERROR: 'Could not reach the server. Check your connection and try again.',
};

export function mapApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code in ERROR_MESSAGES) {
      return ERROR_MESSAGES[error.code];
    }
    return error.message;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('failed to fetch') ||
      msg.includes('abort')
    ) {
      return 'Could not reach the server. Check your connection and try again.';
    }
  }
  return 'Could not reach the server. Check your connection and try again.';
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  token?: string;
  isRetry?: boolean;
}

export async function apiClient<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, token, isRetry = false, headers, ...restOptions } = options;

  let accessToken = token;
  if (!accessToken) {
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token;
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...restOptions,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new ApiError('INTERNAL_SERVER_ERROR', mapApiError(error), 0);
  }

  if (response.status === 401 && !isRetry) {
    // Attempt single refresh
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshData.session?.access_token) {
      return apiClient<T>(endpoint, {
        ...options,
        token: refreshData.session.access_token,
        isRetry: true,
      });
    }
    throw new ApiError('UNAUTHENTICATED', ERROR_MESSAGES.UNAUTHENTICATED, 401);
  }

  if (!response.ok) {
    let errorCode: ApiErrorCode = 'INTERNAL_SERVER_ERROR';
    let errorMessage = 'An error occurred';
    let errorDetails: Record<string, unknown> | undefined;

    try {
      const errJson = (await response.json()) as {
        error?: {
          code?: ApiErrorCode;
          message?: string;
          details?: Record<string, unknown>;
        };
      };
      if (errJson.error?.code) {
        errorCode = errJson.error.code;
        errorMessage = errJson.error.message || ERROR_MESSAGES[errorCode];
        errorDetails = errJson.error.details;
      }
    } catch {
      // response body was not valid JSON
    }

    throw new ApiError(errorCode, errorMessage, response.status, errorDetails);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return (await response.json()) as T;
}

export const api = {
  get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return apiClient<T>(endpoint, { ...options, method: 'GET' });
  },
  post<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return apiClient<T>(endpoint, { ...options, method: 'POST', body });
  },
  put<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return apiClient<T>(endpoint, { ...options, method: 'PUT', body });
  },
  patch<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return apiClient<T>(endpoint, { ...options, method: 'PATCH', body });
  },
  delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return apiClient<T>(endpoint, { ...options, method: 'DELETE' });
  },
};
