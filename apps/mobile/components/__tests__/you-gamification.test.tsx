import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { GamificationOverview } from '@mp/shared';
import type { SheetProps } from '../ui/sheet';

jest.mock('@/components/ui/sheet', () => ({
  Sheet: ({ visible, children, title }: SheetProps) => {
    const ReactActual = jest.requireActual<typeof import('react')>('react');
    const { View: ViewActual, Text: TextActual } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return visible
      ? ReactActual.createElement(
          ViewActual,
          { testID: 'mock-sheet' },
          title ? ReactActual.createElement(TextActual, null, title) : null,
          children
        )
      : null;
  },
}));

import YouScreen from '../../app/(tabs)/you';

const mockGamification: GamificationOverview = {
  level: {
    level: 3,
    totalXp: 350,
    currentLevelBaseXp: 300,
    nextLevelBaseXp: 600,
    xpIntoCurrentLevel: 50,
    xpNeededForNextLevel: 300,
    progressRatio: 50 / 300,
    transactionsCount: 8,
  },
  streak: {
    currentStreak: 4,
    longestStreak: 6,
    activeToday: true,
    lastActiveDate: '2026-11-21',
  },
  achievements: [
    {
      id: 'first_step',
      title: 'First Step',
      description: 'Complete your first scheduled task.',
      target: 1,
      currentProgress: 1,
      xpReward: 50,
      isUnlocked: true,
      isNewlyUnlocked: false,
    },
    {
      id: 'momentum',
      title: 'Momentum',
      description: 'Maintain a 3-day task execution streak.',
      target: 3,
      currentProgress: 3,
      xpReward: 75,
      isUnlocked: true,
      isNewlyUnlocked: false,
    },
    {
      id: 'week_unbroken',
      title: 'Week Unbroken',
      description: 'Maintain a 7-day task execution streak.',
      target: 7,
      currentProgress: 4,
      xpReward: 150,
      isUnlocked: false,
      isNewlyUnlocked: false,
    },
  ],
};

jest.mock('@/hooks/use-gamification', () => ({
  useGamification: () => ({
    data: mockGamification,
    isLoading: false,
    refetch: jest.fn(),
    isRefetching: false,
  }),
}));

jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({
    data: null,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/stores/session', () => ({
  useSessionStore: (
    selector: (s: {
      profile: { displayName: string; timezone: string };
      signOut: () => Promise<void>;
    }) => unknown
  ) =>
    selector({
      profile: {
        displayName: 'Asha (Member)',
        timezone: 'Asia/Kolkata',
      },
      signOut: jest.fn(),
    }),
}));

describe('You Screen Gamification & Streaks (P71)', () => {
  it('should render level, XP progress, streak, and secondary achievements', () => {
    render(<YouScreen />);

    // Profile details
    expect(screen.getAllByText('Asha (Member)')[0]).toBeTruthy();
    expect(screen.getByText('Asia/Kolkata')).toBeTruthy();

    // Level & XP
    expect(screen.getByText('Level 3')).toBeTruthy();
    expect(screen.getByText('L3')).toBeTruthy();
    expect(screen.getByText('350 total XP')).toBeTruthy();
    expect(screen.getByText('50 / 300 XP to Level 4')).toBeTruthy();

    // Streak
    expect(screen.getByText('4 day streak')).toBeTruthy();
    expect(screen.getByText('Best: 6d')).toBeTruthy();
    expect(screen.getByText('Streak completed for today')).toBeTruthy();

    // Achievements
    expect(screen.getByText('Achievements')).toBeTruthy();
    expect(screen.getByText('First Step')).toBeTruthy();
    expect(screen.getByText('+50 XP')).toBeTruthy();
    expect(screen.getByText('Momentum')).toBeTruthy();
    expect(screen.getByText('+75 XP')).toBeTruthy();
    expect(screen.getByText('Week Unbroken')).toBeTruthy();
    expect(screen.getByText('+150 XP')).toBeTruthy();

    // Actions
    expect(screen.getByLabelText('Sign out')).toBeTruthy();
  });
});
