import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import type {
  GroupReportResponse,
  MetricResult,
  PlanComparisonMetric,
  ReportInsight,
} from '@mp/shared';
import type { SheetProps } from '../ui/sheet';
import {
  MetricCard,
  PlanComparisonTab,
  GroupReportTab,
  ReportInsightsList,
  SharingSheet,
  RegenerateSheet,
} from '../reports';

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

describe('Mobile Reports Components (P63)', () => {
  describe('MetricCard', () => {
    it('should render title and display value, and toggle formula on press', () => {
      render(
        <MetricCard
          title="Weighted Achievement"
          displayValue="85%"
          formula="(sum of weighted scores) / total weight"
          inputs={{ totalGoals: 3, totalWeight: 9 }}
          percentage={85}
        />
      );

      expect(screen.getByText('Weighted Achievement')).toBeTruthy();
      expect(screen.getByText('85%')).toBeTruthy();

      // Formula should initially not be visible
      expect(screen.queryByText('(sum of weighted scores) / total weight')).toBeNull();

      // Click to toggle
      fireEvent.press(screen.getByLabelText('Toggle calculation for Weighted Achievement'));

      // Formula and inputs should now be visible
      expect(screen.getByText('(sum of weighted scores) / total weight')).toBeTruthy();
      expect(screen.getByText('totalGoals')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
    });
  });

  describe('PlanComparisonTab', () => {
    const sampleComparison: MetricResult<PlanComparisonMetric> = {
      value: {
        baseline: {
          plannedTasks: 20,
          completedTasks: 16,
          completionRate: 80,
          plannedMinutes: 1200,
          actualMinutes: 1100,
        },
        currentPlan: {
          plannedTasks: 18,
          completedTasks: 16,
          completionRate: 88.9,
          plannedMinutes: 1080,
          actualMinutes: 1100,
        },
        scopeVariance: {
          addedTasks: 2,
          removedTasks: 4,
          rescheduledTasks: 3,
        },
      },
      displayValue: '80.0% baseline vs 88.9% current plan',
      formula: 'completedTasks / plannedTasks',
      inputs: {},
    };

    it('should render baseline vs current plan stats and scope changes', () => {
      render(<PlanComparisonTab planComparison={sampleComparison} />);

      expect(screen.getByText('Plan Performance Comparison')).toBeTruthy();
      expect(screen.getByText('Baseline plan')).toBeTruthy();
      expect(screen.getByText('Current plan')).toBeTruthy();
      expect(screen.getByText('80%')).toBeTruthy();
      expect(screen.getByText('89%')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy(); // added
      expect(screen.getByText('4')).toBeTruthy(); // removed
      expect(screen.getByText('3')).toBeTruthy(); // rescheduled
    });
  });

  describe('GroupReportTab', () => {
    const sampleGroupReport: GroupReportResponse = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      cycleId: '123e4567-e89b-12d3-a456-426614174001',
      reportType: 'group',
      createdAt: '2026-11-21T12:00:00.000Z',
      metrics: {
        totalMembers: 4,
        participatingMembers: 3,
        averageAchievementRate: 75.5,
        totalCompletedTasks: 42,
        averageConsistency: 82.0,
        memberSummaries: [
          {
            userId: 'user-1',
            displayName: 'Asha',
            achievementRate: 90,
            tasksCompleted: 15,
            consistencyRate: 85,
            goalTitles: ['Pass AWS Exam', 'Ship App'],
          },
          {
            userId: 'user-2',
            displayName: 'Ravi (Private)',
            achievementRate: null,
            tasksCompleted: null,
            consistencyRate: null,
            goalTitles: [],
          },
        ],
      },
    };

    it('should render group averages and mask private member data', () => {
      const onOpenSharing = jest.fn();
      render(
        <GroupReportTab groupReport={sampleGroupReport} onOpenSharingSettings={onOpenSharing} />
      );

      expect(screen.getByText('Group Aggregates')).toBeTruthy();
      expect(screen.getByText('76%')).toBeTruthy(); // 75.5 rounded
      expect(screen.getByText('42')).toBeTruthy();
      expect(screen.getByText('Asha')).toBeTruthy();
      expect(screen.getByText(/Pass AWS Exam/)).toBeTruthy();

      // Ravi chose to keep metrics private
      expect(screen.getByText('Ravi (Private)')).toBeTruthy();
      const privateLabels = screen.getAllByText('Private');
      expect(privateLabels.length).toBeGreaterThanOrEqual(3);

      // Sharing button
      fireEvent.press(screen.getByLabelText('Open sharing settings'));
      expect(onOpenSharing).toHaveBeenCalledTimes(1);
    });
  });

  describe('ReportInsightsList', () => {
    const sampleInsights: ReportInsight[] = [
      {
        id: 'ins-1',
        title: 'Strong Morning Execution Pace',
        observation: 'Tasks scheduled before noon had a 95% completion rate.',
        recommendation: 'Prioritize deep work blocks earlier in the week.',
        citations: [
          {
            metricId: 'task_execution',
            metricValue: '95%',
            reason: 'High early-week task completion rate',
          },
        ],
      },
    ];

    it('should render retrospective insights and citations', () => {
      render(<ReportInsightsList insights={sampleInsights} />);

      expect(screen.getByText('Retrospective Insights')).toBeTruthy();
      expect(screen.getByText('Strong Morning Execution Pace')).toBeTruthy();
      expect(
        screen.getByText('Tasks scheduled before noon had a 95% completion rate.')
      ).toBeTruthy();
      expect(screen.getByText('Task execution: 95%')).toBeTruthy();
    });
  });

  describe('SharingSheet', () => {
    it('should toggle sharing options and save updated settings', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();

      render(
        <SharingSheet
          visible={true}
          onClose={onClose}
          initialSettings={{
            shareAchievementRate: true,
            shareCompletedTasksCount: true,
            shareConsistencyScore: true,
            shareGoalTitles: false,
          }}
          onSave={onSave}
        />
      );

      // Toggle Goal Titles from Hidden to Shared
      fireEvent.press(screen.getByLabelText('Share goal titles'));

      // Save
      await act(async () => {
        fireEvent.press(screen.getByLabelText('Save sharing preferences'));
      });

      expect(onSave).toHaveBeenCalledWith({
        shareAchievementRate: true,
        shareCompletedTasksCount: true,
        shareConsistencyScore: true,
        shareGoalTitles: true,
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('RegenerateSheet', () => {
    it('should enforce min 5 character note before submitting', async () => {
      const onRegenerate = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();

      render(<RegenerateSheet visible={true} onClose={onClose} onRegenerate={onRegenerate} />);

      // Try submitting empty
      await act(async () => {
        fireEvent.press(screen.getByLabelText('Confirm report regeneration'));
      });
      expect(onRegenerate).not.toHaveBeenCalled();
      expect(
        screen.getByText('Please provide at least 5 characters explaining the regeneration.')
      ).toBeTruthy();

      // Enter valid note
      fireEvent.changeText(
        screen.getByLabelText('Reason for regeneration'),
        'Updated after retrospective discussion'
      );

      await act(async () => {
        fireEvent.press(screen.getByLabelText('Confirm report regeneration'));
      });

      expect(onRegenerate).toHaveBeenCalledWith('Updated after retrospective discussion');
      expect(onClose).toHaveBeenCalled();
    });
  });
});
