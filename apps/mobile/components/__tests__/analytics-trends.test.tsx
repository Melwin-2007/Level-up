import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { MonthOverMonthResponse } from '@mp/shared';

jest.mock('@/components/ui/sheet', () => ({
  Sheet: () => null,
}));

import { TrendsCard } from '../analytics/trends-card';

const insufficientMock: MonthOverMonthResponse = {
  status: 'insufficient_data',
  completedCyclesCount: 1,
  requiredCyclesCount: 2,
  cycleTrends: [],
  summary: null,
  categoryBreakdown: [],
  observations: [],
};

const sufficientMock: MonthOverMonthResponse = {
  status: 'sufficient_data',
  completedCyclesCount: 2,
  requiredCyclesCount: 2,
  cycleTrends: [
    {
      cycleId: '11111111-1111-1111-1111-111111111111',
      year: 2026,
      month: 10,
      label: 'Oct 2026',
      weightedAchievement: 70,
      taskCompletionRate: 75,
      estimateAccuracy: 80,
      consistency: 60,
      totalTasksCompleted: 15,
    },
    {
      cycleId: '22222222-2222-2222-2222-222222222222',
      year: 2026,
      month: 11,
      label: 'Nov 2026',
      weightedAchievement: 85,
      taskCompletionRate: 90,
      estimateAccuracy: 88,
      consistency: 75,
      totalTasksCompleted: 18,
    },
  ],
  summary: {
    achievementProgression: 15,
    accuracyProgression: 8,
    consistencyProgression: 15,
    averageAchievement: 77.5,
    averageAccuracy: 84,
    averageConsistency: 67.5,
    totalCyclesAnalyzed: 2,
  },
  categoryBreakdown: [
    {
      category: 'Engineering',
      totalGoals: 2,
      averageScore: 85,
      successRate: 100,
    },
  ],
  observations: [
    {
      id: 'obs-1',
      metricKey: 'achievement_trend',
      text: 'Achievement rate progressed by +15% from Oct 2026 to Nov 2026.',
    },
  ],
};

describe('TrendsCard Component (P90)', () => {
  it('should render informational message when insufficient cycles are available', () => {
    render(<TrendsCard analytics={insufficientMock} />);

    expect(screen.getByText('Longitudinal Trends')).toBeTruthy();
    expect(
      screen.getByText(
        'Month-over-month trend analytics require at least 2 completed monthly cycles.'
      )
    ).toBeTruthy();
    expect(screen.getByText('Completed: 1 / 2 cycles')).toBeTruthy();
  });

  it('should render progression chips, cycle history, categories, and observations when data is sufficient', () => {
    render(<TrendsCard analytics={sufficientMock} />);

    expect(screen.getByText('Month-over-Month Trends')).toBeTruthy();

    // Progression values
    expect(screen.getAllByText('+15%')).toHaveLength(2); // Achievement & Consistency
    expect(screen.getByText('+8%')).toBeTruthy(); // Accuracy

    // Cycle history
    expect(screen.getByText('Oct 2026')).toBeTruthy();
    expect(screen.getByText('Nov 2026')).toBeTruthy();
    expect(screen.getByText('15 tasks completed')).toBeTruthy();
    expect(screen.getByText('18 tasks completed')).toBeTruthy();

    // Category breakdown
    expect(screen.getByText('Engineering')).toBeTruthy();
    expect(screen.getByText('2 goals · 100% met')).toBeTruthy();
    expect(screen.getAllByText('85%').length).toBeGreaterThanOrEqual(1);

    // Observations
    expect(
      screen.getByText('Achievement rate progressed by +15% from Oct 2026 to Nov 2026.')
    ).toBeTruthy();
  });
});
