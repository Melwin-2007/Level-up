import { useSessionStore } from '../session';
import { supabase } from '@/services/supabase';
import { api, ApiError } from '@/services/api';

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
    },
  },
}));

jest.mock('@/services/api', () => ({
  api: {
    get: jest.fn(),
  },
  ApiError: class MockApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

describe('stores/session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState({
      session: null,
      user: null,
      profile: null,
      hasProfile: false,
      isLoading: true,
      isInitialized: false,
    });
  });

  it('should initialize with no session when supabase has no session', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });

    await useSessionStore.getState().initialize();

    const state = useSessionStore.getState();
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.hasProfile).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.isInitialized).toBe(true);
  });

  it('should load profile and set hasProfile=true when session exists', async () => {
    const mockUser = { id: 'u1', email: 'test@example.com' };
    const mockSession = { user: mockUser, access_token: 'valid-token' };
    const mockProfile = {
      id: 'u1',
      displayName: 'Alex Chen',
      timezone: 'Asia/Kolkata',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
    });
    (api.get as jest.Mock).mockResolvedValue(mockProfile);

    await useSessionStore.getState().initialize();

    const state = useSessionStore.getState();
    expect(state.session).toEqual(mockSession);
    expect(state.user).toEqual(mockUser);
    expect(state.profile).toEqual(mockProfile);
    expect(state.hasProfile).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.isInitialized).toBe(true);
  });

  it('should set hasProfile=false when user has no profile (403 PROFILE_REQUIRED)', async () => {
    const mockUser = { id: 'u2', email: 'new@example.com' };
    const mockSession = { user: mockUser, access_token: 'valid-token' };

    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
    });
    (api.get as jest.Mock).mockRejectedValue(
      new ApiError('PROFILE_REQUIRED', 'Profile required', 403)
    );

    await useSessionStore.getState().initialize();

    const state = useSessionStore.getState();
    expect(state.session).toEqual(mockSession);
    expect(state.user).toEqual(mockUser);
    expect(state.profile).toBeNull();
    expect(state.hasProfile).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('should update profile and hasProfile via setProfile', () => {
    const mockProfile = {
      id: 'u3',
      displayName: 'Morgan',
      timezone: 'Europe/London',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    useSessionStore.getState().setProfile(mockProfile);

    const state = useSessionStore.getState();
    expect(state.profile).toEqual(mockProfile);
    expect(state.hasProfile).toBe(true);
  });

  it('should clear session and profile on signOut', async () => {
    useSessionStore.setState({
      session: { access_token: 'token' } as unknown as import('@supabase/supabase-js').Session,
      user: { id: 'u1' } as unknown as import('@supabase/supabase-js').User,
      profile: { id: 'u1', displayName: 'Test', timezone: 'UTC', createdAt: '', updatedAt: '' },
      hasProfile: true,
      isLoading: false,
      isInitialized: true,
    });

    (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });

    await useSessionStore.getState().signOut();

    expect(supabase.auth.signOut).toHaveBeenCalled();
    const state = useSessionStore.getState();
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.hasProfile).toBe(false);
  });
});
