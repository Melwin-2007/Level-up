import { apiClient, ApiError, mapApiError, ERROR_MESSAGES } from '../api';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      refreshSession: jest.fn(),
    },
  },
}));

describe('services/api', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('mapApiError', () => {
    it('should map all known ApiError codes to COPY.md strings', () => {
      expect(mapApiError(new ApiError('VALIDATION_FAILED', 'err', 400))).toBe(
        'Validation failed. Check the fields and try again.'
      );

      expect(mapApiError(new ApiError('UNAUTHENTICATED', 'err', 401))).toBe(
        'Your session ended. Sign in again.'
      );

      expect(mapApiError(new ApiError('TOKEN_EXPIRED', 'err', 401))).toBe(
        'Your session ended. Sign in again.'
      );

      expect(mapApiError(new ApiError('PROFILE_REQUIRED', 'err', 403))).toBe(
        'Profile setup required. Set up your display name and timezone.'
      );

      expect(mapApiError(new ApiError('NOT_FOUND', 'err', 404))).toBe(
        'That code does not match a group. Check it and try again.'
      );

      expect(mapApiError(new ApiError('SUBMISSION_LOCKED', 'err', 409))).toBe(
        'This submission is locked and cannot be edited.'
      );

      expect(mapApiError(new ApiError('GROUP_FULL', 'err', 409))).toBe(
        'This group is full. Ask the owner to make room.'
      );

      expect(mapApiError(new ApiError('RATE_LIMITED', 'err', 429))).toBe(
        'You are doing that too fast. Please wait a moment and try again.'
      );
    });

    it('should map network errors to standard connection failure message', () => {
      expect(mapApiError(new Error('Network request failed'))).toBe(
        'Could not reach the server. Check your connection and try again.'
      );
      expect(mapApiError(new TypeError('Failed to fetch'))).toBe(
        'Could not reach the server. Check your connection and try again.'
      );
      expect(mapApiError('unknown failure')).toBe(
        'Could not reach the server. Check your connection and try again.'
      );
    });
  });

  describe('apiClient', () => {
    it('should make GET request with Bearer token and parse response', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: 'test-token-123' } },
      });

      const mockResponse = { id: 'user-1', displayName: 'Alex' };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as unknown as Response);

      const result = await apiClient<typeof mockResponse>('/me');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/me'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should refresh token on 401 and retry successfully', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: 'expired-token' } },
      });

      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: 'refreshed-token' } },
        error: null,
      });

      const mockData = { id: 'group-1', name: 'Focus Group' };
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({
            error: { code: 'TOKEN_EXPIRED', message: 'Token expired' },
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockData,
        } as unknown as Response);

      const result = await apiClient<typeof mockData>('/groups');

      expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockData);

      // Verify the second call used the refreshed token
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/groups'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer refreshed-token',
          }),
        })
      );
    });

    it('should throw UNAUTHENTICATED ApiError if 401 refresh fails', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { access_token: 'expired-token' } },
      });

      (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
        data: { session: null },
        error: new Error('Refresh failed'),
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: { code: 'TOKEN_EXPIRED', message: 'Token expired' },
        }),
      } as unknown as Response);

      await expect(apiClient('/groups')).rejects.toThrow(ERROR_MESSAGES.UNAUTHENTICATED);
    });

    it('should parse standard error JSON and throw ApiError with status and code', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'SUBMISSION_LOCKED',
            message: 'This submission is locked and cannot be edited.',
          },
        }),
      } as unknown as Response);

      try {
        await apiClient('/submissions/123/goals');
        fail('Should have thrown ApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.code).toBe('SUBMISSION_LOCKED');
        expect(apiError.status).toBe(409);
        expect(apiError.message).toBe('This submission is locked and cannot be edited.');
      }
    });

    it('should wrap fetch network failure into InternalServerError ApiError', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(apiClient('/me')).rejects.toThrow(
        'Could not reach the server. Check your connection and try again.'
      );
    });
  });
});
