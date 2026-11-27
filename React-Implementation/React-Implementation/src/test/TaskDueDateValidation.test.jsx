import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import TaskCard from '../components/features/TaskCard';
import { renderWithStore } from './test-utils';

describe('Phase 4 - Task Due Date Display, Locking, and Move Action', () => {
  it('renders overdue badge and locked indicator when task due date is in the past', () => {
    const pastTask = {
      id: 'task-1',
      title: 'Setup Database Migrations',
      priority: 'High',
      status: 'In Progress',
      dueDate: '2020-01-01T00:00:00.000Z',
      assigneeName: 'Arjun Sharma',
    };

    renderWithStore(
      <TaskCard
        task={pastTask}
        userRole="Project Owner"
        onMoveDueDate={vi.fn()}
      />
    );

    expect(screen.getByText(/⚠️ Overdue/i)).toBeDefined();
    expect(screen.getByText(/🔒/)).toBeDefined();
    // Move button should not appear because due date has passed
    expect(screen.queryByRole('button', { name: /Move/i })).toBeNull();
  });

  it('renders locked indicator and no Move button when task is already approved/completed', () => {
    const futureCompletedTask = {
      id: 'task-2',
      title: 'Design UI Mockups',
      priority: 'Medium',
      status: 'Completed',
      dueDate: '2028-12-31T00:00:00.000Z',
      assigneeName: 'Priya Patel',
    };

    renderWithStore(
      <TaskCard
        task={futureCompletedTask}
        userRole="Project Owner"
        onMoveDueDate={vi.fn()}
      />
    );

    expect(screen.getByText(/🔒/)).toBeDefined();
    expect(screen.queryByRole('button', { name: /Move/i })).toBeNull();
  });

  it('allows owner to click Move when task has a valid future due date and is not completed', () => {
    const futureOpenTask = {
      id: 'task-3',
      title: 'Implement OAuth Flow',
      priority: 'High',
      status: 'To Do',
      dueDate: '2028-06-15T00:00:00.000Z',
      assigneeName: 'Unassigned',
    };

    const handleMove = vi.fn();

    renderWithStore(
      <TaskCard
        task={futureOpenTask}
        userRole="Project Owner"
        onMoveDueDate={handleMove}
      />
    );

    const moveBtn = screen.getByRole('button', { name: /Move/i });
    expect(moveBtn).toBeDefined();
    fireEvent.click(moveBtn);
    expect(handleMove).toHaveBeenCalledWith(futureOpenTask);
  });
});
