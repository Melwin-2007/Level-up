import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import type { PlanDiff, PlanVersionResponse } from '@mp/shared';
import type { SheetProps } from '../ui/sheet';
import { PlanDiffView } from '../plans/plan-diff-view';
import { ReoptimizeSheet } from '../plans/reoptimize-sheet';
import { PlanVersionSheet } from '../plans/plan-version-sheet';

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

describe('Plan Version History & Reoptimization Components (P53)', () => {
  const sampleDiff: PlanDiff = {
    summary: '2 tasks rescheduled, 1 task unscheduled across remaining days.',
    movedTasks: [
      {
        taskId: 't-1',
        title: 'Draft API Specification',
        fromDate: '2026-11-08',
        toDate: '2026-11-16',
      },
      {
        taskId: 't-2',
        title: 'Review Schema Migration',
        fromDate: '2026-11-10',
        toDate: '2026-11-17',
      },
    ],
    addedTasks: [
      {
        title: 'Buffer Recovery Task',
        scheduledDate: '2026-11-18',
        estimatedMinutes: 60,
      },
    ],
    removedTasks: [
      {
        taskId: 't-3',
        title: 'Optional Polish Item',
        originalDate: '2026-11-20',
        estimatedMinutes: 45,
      },
    ],
  };

  const sampleVersions: PlanVersionResponse[] = [
    {
      id: 'ver-2',
      cycleId: 'cycle-1',
      userId: 'user-1',
      versionNumber: 2,
      versionType: 'reoptimized',
      approvalStatus: 'pending',
      isBaseline: false,
      planSnapshot: {
        feasibility: {
          verdict: 'tight',
          totalEstimatedHours: 20,
          totalAvailableHours: 22,
          capacityRatio: 0.9,
          goalVerdicts: [],
          conflicts: [],
          rationale: 'Reoptimized',
        },
        milestones: [],
        pacingSummary: 'Reoptimized pacing for remaining 14 days.',
        diff: sampleDiff,
      },
      approvedAt: null,
      createdAt: '2026-11-15T10:00:00Z',
      items: [],
    },
    {
      id: 'ver-1',
      cycleId: 'cycle-1',
      userId: 'user-1',
      versionNumber: 1,
      versionType: 'initial',
      approvalStatus: 'approved',
      isBaseline: true,
      planSnapshot: {
        feasibility: {
          verdict: 'feasible',
          totalEstimatedHours: 40,
          totalAvailableHours: 50,
          capacityRatio: 0.8,
          goalVerdicts: [],
          conflicts: [],
          rationale: 'Initial baseline',
        },
        milestones: [],
        pacingSummary: 'Original baseline pacing.',
      },
      approvedAt: '2026-11-01T10:00:00Z',
      createdAt: '2026-11-01T09:00:00Z',
      items: [],
    },
  ];

  describe('PlanDiffView', () => {
    it('renders diff summary and moved, added, removed tasks', () => {
      render(<PlanDiffView diff={sampleDiff} />);

      expect(
        screen.getByText('2 tasks rescheduled, 1 task unscheduled across remaining days.')
      ).toBeTruthy();
      expect(screen.getByText('Draft API Specification')).toBeTruthy();
      expect(screen.getByText('Review Schema Migration')).toBeTruthy();
      expect(screen.getByText('Buffer Recovery Task')).toBeTruthy();
      expect(screen.getByText('Optional Polish Item')).toBeTruthy();
      expect(screen.getByText('2026-11-08')).toBeTruthy();
      expect(screen.getByText('2026-11-16')).toBeTruthy();
    });
  });

  describe('ReoptimizeSheet', () => {
    it('renders reoptimize form and handles valid submission', async () => {
      const onSubmitMock = jest.fn().mockResolvedValue(undefined);
      const onCloseMock = jest.fn();

      render(<ReoptimizeSheet visible={true} onClose={onCloseMock} onSubmit={onSubmitMock} />);

      expect(screen.getByText('Reoptimize Schedule')).toBeTruthy();

      const input = screen.getByPlaceholderText(
        'e.g. Slipped behind on daily tasks due to urgent client work'
      );
      fireEvent.changeText(input, 'Slipped on daily schedule due to unexpected fever');

      const submitBtn = screen.getByText('Generate Reoptimized Plan');
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      expect(onSubmitMock).toHaveBeenCalledWith(
        'Slipped on daily schedule due to unexpected fever'
      );
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  describe('PlanVersionSheet', () => {
    it('renders version cards and displays diff for selected reoptimized version', () => {
      render(
        <PlanVersionSheet
          visible={true}
          onClose={() => {}}
          versions={sampleVersions}
          onApproveVersion={jest.fn()}
        />
      );

      expect(screen.getByText('Plan Version History')).toBeTruthy();
      expect(screen.getByText('v2 (reoptimized)')).toBeTruthy();
      expect(screen.getByText('v1 (initial)')).toBeTruthy();
      expect(screen.getByText('Baseline')).toBeTruthy();
      expect(screen.getByText('Pending')).toBeTruthy();

      // Displays diff view for active v2
      expect(
        screen.getByText('2 tasks rescheduled, 1 task unscheduled across remaining days.')
      ).toBeTruthy();
      expect(screen.getByText('Approve Reoptimized Plan')).toBeTruthy();
    });

    it('triggers onApproveVersion when approval button is pressed', async () => {
      const onApproveMock = jest.fn().mockResolvedValue(undefined);
      const onCloseMock = jest.fn();

      render(
        <PlanVersionSheet
          visible={true}
          onClose={onCloseMock}
          versions={sampleVersions}
          onApproveVersion={onApproveMock}
        />
      );

      const approveBtn = screen.getByText('Approve Reoptimized Plan');
      await act(async () => {
        fireEvent.press(approveBtn);
      });

      expect(onApproveMock).toHaveBeenCalledWith('ver-2');
      expect(onCloseMock).toHaveBeenCalled();
    });
  });
});
