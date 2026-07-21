import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { DocumentAccessResolver } from './document-access.resolver';

describe('DocumentAccessResolver', () => {
  const resolver = new DocumentAccessResolver();

  it('grants document view and edit capabilities to a workspace owner', () => {
    expect(resolver.resolve(WorkspaceRole.OWNER)).toEqual({
      canEdit: true,
      canView: true,
    });
  });

  it('grants document view and edit capabilities to a workspace admin', () => {
    expect(resolver.resolve(WorkspaceRole.ADMIN)).toEqual({
      canEdit: true,
      canView: true,
    });
  });

  it('grants view-only document capabilities to a workspace member', () => {
    expect(resolver.resolve(WorkspaceRole.MEMBER)).toEqual({
      canEdit: false,
      canView: true,
    });
  });

  it('grants edit capabilities to the owner of a private document', () => {
    expect(resolver.resolve({
      actorUserId: 'user-1',
      documentOwnerUserId: 'user-1',
      workspaceRole: WorkspaceRole.MEMBER,
    })).toEqual({
      canEdit: true,
      canView: true,
    });
  });

  it('does not grant owner edit capabilities for a teamspace document yet', () => {
    expect(resolver.resolve({
      actorUserId: 'user-1',
      documentOwnerUserId: 'user-1',
      documentTeamspaceId: 'teamspace-1',
      workspaceRole: WorkspaceRole.MEMBER,
    })).toEqual({
      canEdit: false,
      canView: true,
    });
  });
});
