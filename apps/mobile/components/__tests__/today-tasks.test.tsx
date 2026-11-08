import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import type { TaskResponse } from '@mp/shared';
import type { SheetProps } from '../ui/sheet';
import { TaskCard } from '../today/task-card';
import { TaskActionSheet } from '../today/task-action-sheet';

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

describe('Today Execution Components (P45)', () => {
  const mockTask: TaskResponse = {
    id: 'task-1',
    cycleId: 'cycle-1',
    userId: 'user-1',
    goalId: 'goal-1',
    planItemId: 'item-1',
    title: 'Implement database triggers',
    description: 'Ensure immutable task logs',
    status: 'pending',
    scheduledDate: '2026-11-06',
    estimatedMinutes: 90,
    actualMinutes: 0,
    completedAt: null,
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
  };

  describe('TaskCard', () => {
    it('renders task title, estimated duration, and description', () => {
      render(<TaskCard task={mockTask} onPress={() => {}} />);

      expect(screen.getByText('Implement database triggers')).toBeTruthy();
      expect(screen.getByText('Ensure immutable task logs')).toBeTruthy();
      expect(screen.getByText('1h 30m')).toBeTruthy();
      expect(screen.getByText('Not started')).toBeTruthy();
    });

    it('triggers onPress when task card is clicked', () => {
      const onPressMock = jest.fn();
      render(<TaskCard task={mockTask} onPress={onPressMock} />);

      fireEvent.press(screen.getByLabelText('Task: Implement database triggers, Status: pending'));
      expect(onPressMock).toHaveBeenCalledWith(mockTask);
    });

    it('triggers onQuickStart when Start button is pressed', () => {
      const onStartMock = jest.fn();
      render(<TaskCard task={mockTask} onPress={() => {}} onQuickStart={onStartMock} />);

      const startBtn = screen.getByLabelText('Start task');
      fireEvent.press(startBtn);
      expect(onStartMock).toHaveBeenCalledWith(mockTask);
    });

    it('renders in-progress status with Pause and Done buttons', () => {
      const inProgressTask: TaskResponse = {
        ...mockTask,
        status: 'in_progress',
        actualMinutes: 45,
      };

      const onPauseMock = jest.fn();
      const onCompleteMock = jest.fn();

      render(
        <TaskCard
          task={inProgressTask}
          onPress={() => {}}
          onQuickPause={onPauseMock}
          onQuickComplete={onCompleteMock}
        />
      );

      expect(screen.getByText('45m spent')).toBeTruthy();
      expect(screen.getByLabelText('Pause task')).toBeTruthy();
      expect(screen.getByLabelText('Complete task')).toBeTruthy();

      fireEvent.press(screen.getByLabelText('Pause task'));
      expect(onPauseMock).toHaveBeenCalledWith(inProgressTask);

      fireEvent.press(screen.getByLabelText('Complete task'));
      expect(onCompleteMock).toHaveBeenCalledWith(inProgressTask);
    });
  });

  describe('TaskActionSheet', () => {
    it('renders task execution controls and timer', () => {
      render(
        <TaskActionSheet
          task={mockTask}
          visible={true}
          onClose={() => {}}
          onLogAction={async () => {}}
        />
      );

      expect(screen.getByText('Task Execution')).toBeTruthy();
      expect(screen.getByText('Stopwatch Timer')).toBeTruthy();
      expect(screen.getByText('Start Timer')).toBeTruthy();
      expect(screen.getByText('Complete Task')).toBeTruthy();
      expect(screen.getByText('Postpone')).toBeTruthy();
    });

    it('allows completing task with note', async () => {
      const onLogActionMock = jest.fn().mockResolvedValue(undefined);
      const onCloseMock = jest.fn();

      render(
        <TaskActionSheet
          task={mockTask}
          visible={true}
          onClose={onCloseMock}
          onLogAction={onLogActionMock}
        />
      );

      // Switch to Complete Task view
      fireEvent.press(screen.getByText('Complete Task'));
      expect(screen.getByText('Actual Duration (minutes)')).toBeTruthy();

      // Enter completion note
      const noteInput = screen.getByPlaceholderText('What did you accomplish?');
      fireEvent.changeText(noteInput, 'Completed all unit tests.');

      // Confirm completion
      await act(async () => {
        fireEvent.press(screen.getByText('Confirm Completion'));
      });

      expect(onLogActionMock).toHaveBeenCalledWith('complete', 90, 'Completed all unit tests.');
    });

    it('allows postponing task with target date and reason', async () => {
      const onLogActionMock = jest.fn().mockResolvedValue(undefined);
      const onCloseMock = jest.fn();

      render(
        <TaskActionSheet
          task={mockTask}
          visible={true}
          onClose={onCloseMock}
          onLogAction={onLogActionMock}
        />
      );

      // Switch to Postpone view
      fireEvent.press(screen.getByText('Postpone'));
      expect(screen.getByText('New Scheduled Date (YYYY-MM-DD)')).toBeTruthy();

      const reasonInput = screen.getByPlaceholderText('Why is this postponed?');
      fireEvent.changeText(reasonInput, 'Waiting for API review');

      await act(async () => {
        fireEvent.press(screen.getByText('Confirm Postpone'));
      });

      expect(onLogActionMock).toHaveBeenCalledWith(
        'postpone',
        0,
        'Waiting for API review',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      );
    });
  });
});
