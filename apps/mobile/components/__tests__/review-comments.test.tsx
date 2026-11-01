import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ReviewCommentList } from '../review/review-comment-list';
import type { ReviewCommentResponse } from '@mp/shared';

describe('ReviewCommentList', () => {
  const mockComments: ReviewCommentResponse[] = [
    {
      id: 'c-1',
      submissionGoalId: 'goal-1',
      authorId: 'user-ravi',
      authorName: 'Ravi',
      comment: 'Ten hours a week fits well.',
      createdAt: '2026-11-01T10:00:00Z',
    },
    {
      id: 'c-2',
      submissionGoalId: 'goal-1',
      authorId: 'user-meera',
      authorName: 'Meera',
      comment: 'Needs a specific deadline.',
      createdAt: '2026-11-01T11:00:00Z',
    },
  ];

  it('renders all comments with correct author names and text', () => {
    render(<ReviewCommentList comments={mockComments} currentUserId="user-meera" />);

    expect(screen.getByText('Ravi')).toBeTruthy();
    expect(screen.getByText('Ten hours a week fits well.')).toBeTruthy();

    expect(screen.getByText('Meera (You)')).toBeTruthy();
    expect(screen.getByText('Needs a specific deadline.')).toBeTruthy();
  });

  it('renders empty message when no comments exist', () => {
    render(<ReviewCommentList comments={[]} />);
    expect(screen.getByText('No comments yet.')).toBeTruthy();
  });
});
