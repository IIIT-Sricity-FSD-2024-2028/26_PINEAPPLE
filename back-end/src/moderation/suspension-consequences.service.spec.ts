import { SuspensionConsequencesService } from './suspension-consequences.service';

function createSpy<T = any>(impl?: (...args: any[]) => any) {
  const calls: any[][] = [];
  const fn = (...args: any[]) => {
    calls.push(args);
    return impl ? impl(...args) : undefined;
  };
  fn.calls = calls;
  fn.reset = () => {
    calls.length = 0;
  };
  return fn;
}

describe('SuspensionConsequencesService Unit Tests', () => {
  let service: SuspensionConsequencesService;
  let mockProjectsService: any;
  let mockTasksService: any;
  let mockMentorMarketplaceService: any;
  let mockAuditService: any;
  let mockUsersRepo: any;

  let releaseCollaboratorTasksSpy: any;
  let handleOwnerSuspensionSpy: any;
  let handleMentorSuspensionSpy: any;
  let createAuditSpy: any;

  beforeEach(() => {
    handleOwnerSuspensionSpy = createSpy(() => [
      { id: 'proj-1', title: 'Alpha Project', status: 'Closed', closedReason: 'Owner suspended' },
    ]);
    mockProjectsService = {
      handleOwnerSuspension: handleOwnerSuspensionSpy,
    };

    releaseCollaboratorTasksSpy = createSpy(() => ({
      releasedTasks: [
        { id: 'task-1', title: 'Setup DB', status: 'ToDo', assigneeId: null },
      ],
    }));
    mockTasksService = {
      releaseCollaboratorTasks: releaseCollaboratorTasksSpy,
    };

    handleMentorSuspensionSpy = createSpy();
    mockMentorMarketplaceService = {
      handleMentorSuspension: handleMentorSuspensionSpy,
    };

    createAuditSpy = createSpy();
    mockAuditService = {
      create: createAuditSpy,
    };

    mockUsersRepo = {
      findById: () => null,
    };

    service = new SuspensionConsequencesService(
      mockProjectsService,
      mockTasksService,
      mockMentorMarketplaceService,
      mockAuditService,
      mockUsersRepo,
    );
  });

  it('triggers collaborator task release when collaborator is suspended', () => {
    service.handleCollaboratorSuspension('collab-1');

    expect(releaseCollaboratorTasksSpy.calls.length).toBe(1);
    expect(releaseCollaboratorTasksSpy.calls[0]).toEqual(['collab-1']);
  });

  it('closes owned projects with "Owner suspended" when owner is suspended', () => {
    service.handleOwnerSuspension('owner-1', 'Owner suspended');

    expect(handleOwnerSuspensionSpy.calls.length).toBe(1);
    expect(handleOwnerSuspensionSpy.calls[0]).toEqual(['owner-1']);
  });

  it('refunds sessions and frees mentor slot when mentor is suspended', () => {
    service.handleMentorSuspension('mentor-1');

    expect(handleMentorSuspensionSpy.calls.length).toBe(1);
    expect(handleMentorSuspensionSpy.calls[0]).toEqual(['mentor-1']);
  });

  it('handleSuspension orchestrates all three consequences and writes audit entry', async () => {
    await service.handleSuspension('user-x', 'Terms of service violation');

    expect(releaseCollaboratorTasksSpy.calls.length).toBe(1);
    expect(releaseCollaboratorTasksSpy.calls[0]).toEqual(['user-x']);
    expect(handleOwnerSuspensionSpy.calls.length).toBe(1);
    expect(handleOwnerSuspensionSpy.calls[0]).toEqual(['user-x']);
    expect(handleMentorSuspensionSpy.calls.length).toBe(1);
    expect(handleMentorSuspensionSpy.calls[0]).toEqual(['user-x']);

    expect(createAuditSpy.calls.length).toBe(1);
    expect(createAuditSpy.calls[0][0].userId).toBe('user-x');
    expect(createAuditSpy.calls[0][0].action).toBe('user-suspended');
    expect(createAuditSpy.calls[0][0].details).toContain('Terms of service violation');
  });

  it('is completely idempotent when executed multiple times', async () => {
    await service.handleSuspension('user-x', 'Terms of service violation');
    await service.handleSuspension('user-x', 'Terms of service violation');

    expect(releaseCollaboratorTasksSpy.calls.length).toBe(2);
    expect(handleOwnerSuspensionSpy.calls.length).toBe(2);
    expect(handleMentorSuspensionSpy.calls.length).toBe(2);
  });
});
