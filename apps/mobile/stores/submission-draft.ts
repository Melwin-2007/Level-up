import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_WEEKLY_HOURS,
  type FormAvailability,
  type FormCommitment,
  type FormGoal,
  type FormSubmissionState,
} from '@/services/submission-mapper';

export interface SubmissionDraftStore {
  drafts: Record<string, FormSubmissionState>;
  getDraft: (cycleId: string) => FormSubmissionState;
  setDraft: (cycleId: string, updater: (prev: FormSubmissionState) => FormSubmissionState) => void;
  setGoals: (cycleId: string, goals: FormGoal[]) => void;
  upsertGoal: (cycleId: string, goal: FormGoal, index?: number) => void;
  deleteGoal: (cycleId: string, index: number) => void;
  setWeeklyHours: (cycleId: string, hours: FormAvailability) => void;
  setWeekdayHours: (cycleId: string, day: keyof FormAvailability, hours: number) => void;
  setCommitments: (cycleId: string, commitments: FormCommitment[]) => void;
  setMaxDailyHours: (cycleId: string, hours?: number) => void;
  clearDraft: (cycleId: string) => void;
}

const createDefaultDraft = (): FormSubmissionState => ({
  goals: [],
  weeklyHours: { ...DEFAULT_WEEKLY_HOURS },
  fixedCommitments: [],
  maxDailyHours: 8,
});

export const useSubmissionDraftStore = create<SubmissionDraftStore>()(
  persist(
    (set, get) => ({
      drafts: {},

      getDraft: (cycleId: string): FormSubmissionState => {
        const existing = get().drafts[cycleId];
        if (existing) {
          return existing;
        }
        return createDefaultDraft();
      },

      setDraft: (cycleId, updater) => {
        set((state) => {
          const current = state.drafts[cycleId] ?? createDefaultDraft();
          return {
            drafts: {
              ...state.drafts,
              [cycleId]: updater(current),
            },
          };
        });
      },

      setGoals: (cycleId, goals) => {
        get().setDraft(cycleId, (prev) => ({
          ...prev,
          goals,
        }));
      },

      upsertGoal: (cycleId, goal, index) => {
        get().setDraft(cycleId, (prev) => {
          const newGoals = [...prev.goals];
          if (index !== undefined && index >= 0 && index < newGoals.length) {
            newGoals[index] = goal;
          } else {
            newGoals.push(goal);
          }
          return {
            ...prev,
            goals: newGoals,
          };
        });
      },

      deleteGoal: (cycleId, index) => {
        get().setDraft(cycleId, (prev) => ({
          ...prev,
          goals: prev.goals.filter((_, i) => i !== index),
        }));
      },

      setWeeklyHours: (cycleId, hours) => {
        get().setDraft(cycleId, (prev) => ({
          ...prev,
          weeklyHours: hours,
        }));
      },

      setWeekdayHours: (cycleId, day, hours) => {
        get().setDraft(cycleId, (prev) => ({
          ...prev,
          weeklyHours: {
            ...prev.weeklyHours,
            [day]: hours,
          },
        }));
      },

      setCommitments: (cycleId, commitments) => {
        get().setDraft(cycleId, (prev) => ({
          ...prev,
          fixedCommitments: commitments,
        }));
      },

      setMaxDailyHours: (cycleId, hours) => {
        get().setDraft(cycleId, (prev) => ({
          ...prev,
          maxDailyHours: hours,
        }));
      },

      clearDraft: (cycleId) => {
        set((state) => {
          const next = { ...state.drafts };
          delete next[cycleId];
          return { drafts: next };
        });
      },
    }),
    {
      name: 'mp_submission_drafts',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
