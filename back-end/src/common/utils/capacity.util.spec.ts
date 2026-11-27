import {
  getApprovedCollaboratorsCount,
  getEffectiveMaxCollaborators,
  isProjectFull,
} from './capacity.util';

describe('capacity.util - isProjectFull', () => {
  it('returns false when active collaborators are under the limit', () => {
    const project = {
      id: 'proj-under',
      ownerId: 'owner-1',
      mentorId: 'mentor-1',
      maxCollaborators: 3,
      collaborators: [
        { id: 'c1', name: 'Collab 1', role: 'Collaborator' },
        { id: 'c2', name: 'Collab 2', role: 'Collaborator' },
      ],
    };

    expect(getApprovedCollaboratorsCount(project)).toBe(2);
    expect(getEffectiveMaxCollaborators(project)).toBe(3);
    expect(isProjectFull(project)).toBe(false);
  });

  it('returns true when active collaborators equal the limit (both maxCollaborators and teamSize)', () => {
    const byMax = {
      id: 'proj-equal-max',
      ownerId: 'owner-1',
      maxCollaborators: 3,
      collaborators: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
    };
    const byTeamSize = {
      id: 'proj-equal-teamsize',
      ownerId: 'owner-1',
      teamSize: 2,
      collaborators: [{ id: 'c1' }, { id: 'c2' }],
    };

    expect(isProjectFull(byMax)).toBe(true);
    expect(isProjectFull(byTeamSize)).toBe(true);
  });

  it('returns true when active collaborators are over the limit (legacy data)', () => {
    const project = {
      id: 'proj-over',
      ownerId: 'owner-1',
      maxCollaborators: 2,
      collaborators: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
    };

    expect(getApprovedCollaboratorsCount(project)).toBe(3);
    expect(isProjectFull(project)).toBe(true);
  });

  it('never counts the owner or the mentor toward used seats', () => {
    const projectWithOneCollab = {
      id: 'proj-roles',
      ownerId: 'owner-1',
      mentorId: 'mentor-1',
      maxCollaborators: 2,
      collaborators: [
        { id: 'owner-1', name: 'Owner', role: 'Owner' },
        { id: 'mentor-1', name: 'Mentor', role: 'Mentor' },
        { id: 'random-role-owner', name: 'Owner Copy', role: 'owner' },
        { id: 'random-role-mentor', name: 'Mentor Copy', role: 'mentor' },
        { id: 'c1', name: 'Collab 1', role: 'Collaborator' },
      ],
    };

    expect(getApprovedCollaboratorsCount(projectWithOneCollab)).toBe(1);
    expect(isProjectFull(projectWithOneCollab)).toBe(false);

    const projectFullPlusOwnerMentor = {
      ...projectWithOneCollab,
      collaborators: [
        ...projectWithOneCollab.collaborators,
        { id: 'c2', name: 'Collab 2', role: 'Collaborator' },
      ],
    };

    expect(getApprovedCollaboratorsCount(projectFullPlusOwnerMentor)).toBe(2);
    expect(isProjectFull(projectFullPlusOwnerMentor)).toBe(true);
  });
});
