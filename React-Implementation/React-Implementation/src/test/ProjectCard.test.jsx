import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import ProjectCard from '../components/features/ProjectCard';
import { renderWithStore } from './test-utils';

describe('ProjectCard - Phase 1 Closed Status & Badges', () => {
  it('renders closed badge and closure reason banner when project is closed', () => {
    const closedProject = {
      id: 'proj-1',
      title: 'Decentralized Identity Hub',
      description: 'Self-sovereign identity framework',
      status: 'Closed',
      closureReason: 'Owner suspended',
      owner: 'Arjun Sharma',
      difficulty: 'Hard',
      skills: ['Solidity', 'React'],
    };

    renderWithStore(<ProjectCard project={closedProject} variant="marketplace" />);

    expect(screen.getByText('Decentralized Identity Hub')).toBeDefined();
    // Badge and disabled button both show Closed
    expect(screen.getAllByText('Closed').length).toBe(2);
    // Closure banner shows reason
    expect(screen.getByText(/Owner suspended/)).toBeDefined();

    // Marketplace Apply button is replaced by disabled Closed button
    const closedBtn = screen.getByRole('button', { name: 'Closed' });
    expect(closedBtn.hasAttribute('disabled')).toBe(true);
  });

  it('renders normal active project with Apply button when open', () => {
    const openProject = {
      id: 'proj-2',
      title: 'Campus Food Delivery',
      description: 'Peer to peer food delivery network',
      status: 'Open',
      owner: 'Priya Patel',
      difficulty: 'Intermediate',
      skills: ['Node.js', 'React'],
    };

    renderWithStore(<ProjectCard project={openProject} variant="marketplace" />);

    expect(screen.getByText('Campus Food Delivery')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDefined();
  });
});
