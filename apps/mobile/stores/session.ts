import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { UserProfile } from '@mp/shared';
import { supabase } from '@/services/supabase';
import { api, ApiError } from '@/services/api';

export interface SessionState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  hasProfile: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  fetchProfile: () => Promise<UserProfile | null>;
  setProfile: (profile: UserProfile) => void;
  signOut: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  hasProfile: false,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const user = session?.user ?? null;

      if (!session) {
        set({
          session: null,
          user: null,
          profile: null,
          hasProfile: false,
          isLoading: false,
          isInitialized: true,
        });
        return;
      }

      set({ session, user });
      await get().fetchProfile();
    } catch {
      set({
        session: null,
        user: null,
        profile: null,
        hasProfile: false,
        isLoading: false,
        isInitialized: true,
      });
    } finally {
      set({ isLoading: false, isInitialized: true });
    }

    // Set up auth state listener only once
    supabase.auth.onAuthStateChange(async (_event, updatedSession) => {
      const currentUser = updatedSession?.user ?? null;
      if (!updatedSession) {
        set({
          session: null,
          user: null,
          profile: null,
          hasProfile: false,
          isLoading: false,
        });
        return;
      }

      set({ session: updatedSession, user: currentUser });
      if (!get().profile) {
        await get().fetchProfile();
      }
    });
  },

  fetchProfile: async () => {
    try {
      const profile = await api.get<UserProfile>('/me');
      set({
        profile,
        hasProfile: Boolean(profile && profile.displayName),
        isLoading: false,
      });
      return profile;
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === 'PROFILE_REQUIRED' || error.status === 403 || error.status === 404)
      ) {
        set({ profile: null, hasProfile: false, isLoading: false });
      } else {
        set({ profile: null, hasProfile: false, isLoading: false });
      }
      return null;
    }
  },

  setProfile: (profile: UserProfile) => {
    set({
      profile,
      hasProfile: Boolean(profile && profile.displayName),
    });
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      set({
        session: null,
        user: null,
        profile: null,
        hasProfile: false,
        isLoading: false,
      });
    }
  },
}));
