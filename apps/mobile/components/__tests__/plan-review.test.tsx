import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import PlanReviewScreen from '../../app/cycles/[id]/plan';
import * as useCyclesHook from '../../hooks/use-cycles';
import * as usePlansHook from '../../hooks/use-plans';
import type { SheetProps } from '../ui/sheet';
import type { PlanVersionResponse, CycleDetailResponse } from '@mp/shared';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'cycle-123' }),
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
  }),
}));

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

describe('PlanReviewScreen (Mobile - P25)', () => {
  const mockCycle: CycleDetailResponse = {
    id: 'cycle-123',
    groupId: 'group-1',
    year: 2026,
    month: 11,
    status: 'planning',
    submissionDeadline: '2026-11-05T00:00:00.000Z',
    reviewDeadline: '2026-11-10T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    members: [],
  };

  const mockPlan: PlanVersionResponse = {
    id: 'plan-1',
    cycleId: 'cycle-123',
    userId: 'user-1',
    versionNumber: 1,
    versionType: 'initial',
    approvalStatus: 'pending',
    isBaseline: false,
    approvedAt: null,
    createdAt: '2026-11-01T12:00:00.000Z',
    planSnapshot: {
      feasibility: {
        verdict: 'feasible',
        totalEstimatedHours: 20,
        totalAvailableHours: 80,
        capacityRatio: 0.25,
        goalVerdicts: [
          {
            goalId: '11111111-1111-1111-1111-111111111111',
            status: 'achievable',
            risks: [],
            recommendations: ['Deliver ahead of schedule'],
          },
        ],
        conflicts: [],
        rationale: 'Balanced distribution.',
      },
      milestones: [
        {
          goalId: '11111111-1111-1111-1111-111111111111',
          title: 'Design scheduler interface and state machine',
          targetWeek: 1,
          estimatedMinutes: 600,
          dependencies: [],
        },
        {
          goalId: '11111111-1111-1111-1111-111111111111',
          title: 'Implement AI planner generator endpoint',
          targetWeek: 2,
          estimatedMinutes: 600,
          dependencies: [],
        },
      ],
      pacingSummary: '10 hours weekly delivery.',
    },
    items: [],
  };

  const mockApproveMutateAsync = jest.fn();
  const mockGenerateMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(useCyclesHook, 'useCycle').mockReturnValue({
      data: mockCycle,
      isLoading: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useCyclesHook.useCycle>);

    jest.spyOn(usePlansHook, 'usePlan').mockReturnValue({
      data: mockPlan,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof usePlansHook.usePlan>);

    jest.spyOn(usePlansHook, 'useGeneratePlanMutation').mockReturnValue({
      mutateAsync: mockGenerateMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof usePlansHook.useGeneratePlanMutation>);

    jest.spyOn(usePlansHook, 'useApprovePlanMutation').mockReturnValue({
      mutateAsync: mockApproveMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof usePlansHook.useApprovePlanMutation>);
  });

  it('renders feasibility verdict and weekly milestones', () => {
    render(<PlanReviewScreen />);

    expect(screen.getByTestId('feasibility-verdict-badge')).toBeTruthy();
    expect(screen.getByText('FEASIBLE')).toBeTruthy();
    expect(screen.getByText('Design scheduler interface and state machine')).toBeTruthy();
    expect(screen.getByText('Implement AI planner generator endpoint')).toBeTruthy();
  });

  it('shows "Proposed by AI" badge when plan is unapproved', () => {
    render(<PlanReviewScreen />);
    expect(screen.getByTestId('proposed-by-ai-badge')).toBeTruthy();
    expect(screen.getByText(/Proposed by AI \(Version 1\)/)).toBeTruthy();
  });

  it('hides "Proposed by AI" badge when plan is approved as baseline', () => {
    jest.spyOn(usePlansHook, 'usePlan').mockReturnValue({
      data: { ...mockPlan, isBaseline: true, approvalStatus: 'approved' },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof usePlansHook.usePlan>);

    render(<PlanReviewScreen />);
    expect(screen.queryByTestId('proposed-by-ai-badge')).toBeNull();
    expect(screen.getByText('Baseline Plan Approved & Locked')).toBeTruthy();
  });

  it('renders conflicts when feasibility report contains conflicts', () => {
    const planWithConflicts: PlanVersionResponse = {
      ...mockPlan,
      planSnapshot: {
        ...mockPlan.planSnapshot,
        feasibility: {
          ...mockPlan.planSnapshot.feasibility,
          verdict: 'tight',
          conflicts: [
            {
              type: 'capacity',
              description: 'Week 2 workload exceeds weekly availability by 4 hours',
              goalIds: ['11111111-1111-1111-1111-111111111111'],
            },
          ],
        },
      },
    };

    jest.spyOn(usePlansHook, 'usePlan').mockReturnValue({
      data: planWithConflicts,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof usePlansHook.usePlan>);

    render(<PlanReviewScreen />);
    expect(screen.getByText('TIGHT')).toBeTruthy();
    expect(screen.getByText(/Conflicts Detected \(1\)/)).toBeTruthy();
    expect(
      screen.getByText(/\[CAPACITY\] Week 2 workload exceeds weekly availability/)
    ).toBeTruthy();
  });

  it('opens confirmation sheet and triggers approve mutation on confirmation', async () => {
    mockApproveMutateAsync.mockResolvedValueOnce({
      ...mockPlan,
      isBaseline: true,
      approvalStatus: 'approved',
    });

    render(<PlanReviewScreen />);

    // Click "Approve Plan" to open confirmation sheet
    const approveButton = screen.getByText('Approve Plan');
    fireEvent.press(approveButton);

    // Click "Confirm Approval" inside the sheet
    const confirmButton = screen.getByText('Confirm Approval');
    await act(async () => {
      fireEvent.press(confirmButton);
    });

    expect(mockApproveMutateAsync).toHaveBeenCalledWith({
      planVersionId: 'plan-1',
    });
  });

  it('renders MonthStrip and scheduled daily tasks within weekly breakdown', () => {
    const planWithDailyTasks: PlanVersionResponse = {
      ...mockPlan,
      items: [
        {
          id: 'task-1',
          planVersionId: 'plan-1',
          goalId: '11111111-1111-1111-1111-111111111111',
          itemType: 'daily_task',
          title: 'Draft scheduler interface (Day 1)',
          description: 'Core interfaces and types',
          plannedDate: '2026-11-04T00:00:00.000Z',
          weekNumber: 1,
          estimatedMinutes: 90,
          orderIndex: 0,
          createdAt: '2026-11-01T12:00:00.000Z',
        },
        {
          id: 'task-2',
          planVersionId: 'plan-1',
          goalId: '11111111-1111-1111-1111-111111111111',
          itemType: 'daily_task',
          title: 'Implement pure scheduler function',
          description: 'Knapsack constraint solver',
          plannedDate: '2026-11-05T00:00:00.000Z',
          weekNumber: 1,
          estimatedMinutes: 120,
          orderIndex: 1,
          createdAt: '2026-11-01T12:00:00.000Z',
        },
      ],
    };

    jest.spyOn(usePlansHook, 'usePlan').mockReturnValue({
      data: planWithDailyTasks,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof usePlansHook.usePlan>);

    render(<PlanReviewScreen />);

    // Month strip is rendered
    expect(screen.getByTestId('plan-month-strip')).toBeTruthy();
    expect(screen.getByText('Daily Scheduled Load')).toBeTruthy();
    expect(screen.getByText('2 active days')).toBeTruthy();

    // Weekly breakdown contains daily tasks section
    expect(screen.getByTestId('week-daily-tasks-1')).toBeTruthy();
    expect(screen.getByText('Draft scheduler interface (Day 1)')).toBeTruthy();
    expect(screen.getByText('Implement pure scheduler function')).toBeTruthy();
    expect(screen.getByText('Nov 4')).toBeTruthy();
    expect(screen.getByText('Nov 5')).toBeTruthy();
    expect(screen.getByText('1h 30m')).toBeTruthy();
    expect(screen.getAllByText('2h').length).toBeGreaterThanOrEqual(1);
  });

  it('complies with design tokens: zero raw hex literals outside tokens.ts', () => {
    const fs = jest.requireActual<typeof import('fs')>('fs');
    const path = jest.requireActual<typeof import('path')>('path');
    const planFile = path.resolve(__dirname, '../../app/cycles/[id]/plan.tsx');
    const content = fs.readFileSync(planFile, 'utf-8');

    // Matches #RGB, #RGBA, #RRGGBB, #RRGGBBAA
    const hexRegex = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
    const matches = content.match(hexRegex);
    expect(matches).toBeNull();
  });
});
