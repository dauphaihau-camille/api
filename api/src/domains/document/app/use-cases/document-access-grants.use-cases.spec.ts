import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { DocumentAccessGrantPermission } from '../../domain/enums/document-access-grant-permission.enum';
import {
  DocumentAccessGrantUserNotFoundError,
  DocumentPermissionDeniedError,
} from '../errors/document-app.error';
import type { DocumentAccessGrantRepository } from '../ports/document-access-grant.repository';
import type { DocumentAccessSettingRepository } from '../ports/document-access-setting.repository';
import type { DocumentCommandRepository } from '../ports/document-command.repository';
import type { DocumentInvitationRepository } from '../ports/document-invitation.repository';
import type { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import { DocumentAccessResolver } from '../policies/document-access.resolver';
import { DocumentAccessCapabilityService } from '../services/document-access-capability.service';
import { DocumentAccessChangedEvent } from '../../events/document-access-changed.event';
import { ListDocumentCollaboratorsUseCase } from './list-document-collaborators.use-case';
import { RevokeDocumentAccessUseCase } from './revoke-document-access.use-case';
import { ShareDocumentUseCase } from './share-document.use-case';
import { GetDocumentAccessSettingsUseCase } from './get-document-access-settings.use-case';
import { UpdateDocumentAccessSettingsUseCase } from './update-document-access-settings.use-case';

describe('document access grant use cases', () => {
  const currentUser: AuthenticatedUser = {
    userId: 'owner-user',
    email: 'owner@example.com',
    status: UserStatus.ACTIVE,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };
  const document = {
    id: 'document-1',
    publicId: 'public-document-1',
    version: 1,
    workspace: { id: 'workspace-1' },
    ownerUser: { id: 'owner-user' },
    title: 'Shared plan',
    contentFormat: 'blocknote_v1',
    contentJson: [],
    sortKey: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedBy: {
      displayName: 'Owner',
      email: 'owner@example.com',
    },
  };

  function createWorkspaceRepository() {
    const workspace = {
      id: 'workspace-1',
      version: 1,
      name: 'Workspace',
      slug: 'workspace',
      currentUserRole: WorkspaceRole.MEMBER,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    return {
      findAllForUser: jest.fn().mockResolvedValue([workspace]),
      findById: jest.fn().mockResolvedValue(workspace),
      findWorkspaceAccess: jest.fn().mockResolvedValue({
        workspace,
        membership: {
          id: 'membership-1',
          version: 1,
          userId: 'owner-user',
          email: 'owner@example.com',
          role: WorkspaceRole.MEMBER,
          joinedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      }),
      findMembers: jest.fn().mockResolvedValue([]),
      addMember: jest.fn().mockResolvedValue({
        id: 'membership-2',
        version: 1,
        userId: 'recipient-user',
        email: 'recipient@example.com',
        displayName: undefined,
        avatar: undefined,
        role: WorkspaceRole.MEMBER,
        joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    } as unknown as jest.Mocked<WorkspaceRepository>;
  }

  function createCommandRepository() {
    return {
      assignUpdatedByUser: jest.fn(),
      findDocument: jest.fn().mockResolvedValue({ ...document }),
      saveDocument: jest.fn(),
    } as unknown as jest.Mocked<DocumentCommandRepository>;
  }

  function createNavigationQueryRepository() {
    return {
      findDocument: jest.fn().mockResolvedValue({ ...document }),
    } as unknown as jest.Mocked<DocumentNavigationQueryRepository>;
  }

  function createGrantRepository() {
    return {
      findActiveGrant: jest.fn().mockResolvedValue(null),
      findStrongestActiveGrantInAncestors: jest.fn().mockResolvedValue(null),
      findActiveGrantPermissionsByDocumentId: jest.fn().mockResolvedValue(new Map()),
      findStrongestActiveGrantPermissionsInAncestorsByDocumentId: jest.fn().mockResolvedValue(new Map()),
      hasActiveGrants: jest.fn().mockResolvedValue(false),
      hasActiveGrantsIncludingAncestors: jest.fn().mockResolvedValue(false),
      findDocumentIdsWithActiveGrantsIncludingAncestors: jest.fn().mockResolvedValue(new Set()),
      findWorkspaceUser: jest.fn().mockResolvedValue({
        id: 'recipient-user',
        email: 'recipient@example.com',
      }),
      findUserById: jest.fn().mockResolvedValue({
        id: 'recipient-user',
        email: 'recipient@example.com',
      }),
      findUserByEmail: jest.fn().mockResolvedValue({
        id: 'recipient-user',
        email: 'recipient@example.com',
      }),
      upsertGrant: jest.fn().mockResolvedValue({
        id: 'grant-1',
        documentId: 'document-1',
        user: {
          id: 'recipient-user',
          email: 'recipient@example.com',
        },
        permission: DocumentAccessGrantPermission.EDIT,
        grantedByUserId: 'owner-user',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      revokeGrant: jest.fn().mockResolvedValue(null),
      listActiveGrants: jest.fn().mockResolvedValue([]),
      listStrongestActiveGrantsInAncestors: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<DocumentAccessGrantRepository>;
  }

  function createInvitationRepository() {
    return {
      upsertInvitation: jest.fn().mockResolvedValue({
        id: 'invitation-1',
        documentId: 'document-1',
        workspaceId: 'workspace-1',
        email: 'pending@example.com',
        permission: DocumentAccessGrantPermission.COMMENT,
        invitedByUserId: 'owner-user',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      listActiveInvitations: jest.fn().mockResolvedValue([]),
      listActiveInvitationsForEmail: jest.fn().mockResolvedValue([]),
      markInvitationAccepted: jest.fn().mockResolvedValue(undefined),
      updateInvitationPermission: jest.fn().mockResolvedValue(null),
      revokeInvitation: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<DocumentInvitationRepository>;
  }

  function createAccessSettingRepository() {
    return {
      findByDocumentId: jest.fn().mockResolvedValue(null),
      upsertWorkspaceMemberPermission: jest.fn().mockResolvedValue({
        documentId: 'document-1',
        workspaceMemberPermission: DocumentAccessGrantPermission.VIEW,
        updatedByUserId: 'owner-user',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    } as unknown as jest.Mocked<DocumentAccessSettingRepository>;
  }

  function createEventEmitter() {
    return {
      emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;
  }

  function createDocumentAccessCapabilityService(
    workspaceRepository: WorkspaceRepository,
    grantRepository: DocumentAccessGrantRepository,
    accessSettingRepository: DocumentAccessSettingRepository,
  ) {
    return new DocumentAccessCapabilityService(
      workspaceRepository,
      grantRepository,
      accessSettingRepository,
      new DocumentAccessResolver(),
    );
  }

  it('shares a private document with an existing workspace user', async () => {
    const grantRepository = createGrantRepository();
    const workspaceRepository = createWorkspaceRepository();
    const accessSettingRepository = createAccessSettingRepository();
    const eventEmitter = createEventEmitter();
    const useCase = new ShareDocumentUseCase(
      createCommandRepository(),
      grantRepository,
      createInvitationRepository(),
      createDocumentAccessCapabilityService(workspaceRepository, grantRepository, accessSettingRepository),
      workspaceRepository,
      eventEmitter,
    );

    await expect(useCase.execute(document.id, currentUser, {
      userId: 'recipient-user',
      permission: DocumentAccessGrantPermission.EDIT,
    })).resolves.toMatchObject({
      id: 'grant-1',
      permission: DocumentAccessGrantPermission.EDIT,
    });

    expect(grantRepository.findUserById).toHaveBeenCalledWith('recipient-user');
    expect(grantRepository.upsertGrant).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      documentId: 'document-1',
      userId: 'recipient-user',
      permission: DocumentAccessGrantPermission.EDIT,
      grantedByUserId: 'owner-user',
    });
    expect(workspaceRepository.addMember).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      userId: 'recipient-user',
      role: WorkspaceRole.MEMBER,
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'document.access.changed',
      new DocumentAccessChangedEvent('document-1', 'workspace-1'),
    );
  });

  it('shares a private document with multiple workspace users and reports invalid recipients', async () => {
    const grantRepository = createGrantRepository();
    grantRepository.findUserById.mockImplementation(async (userId) => {
      if (userId === 'missing-user') {
        return null;
      }

      return {
        id: userId,
        email: `${userId}@example.com`,
      };
    });
    grantRepository.upsertGrant.mockImplementation(async ({
      documentId,
      userId,
      permission,
      grantedByUserId,
    }) => ({
      id: `grant-${userId}`,
      documentId,
      user: {
        id: userId,
        email: `${userId}@example.com`,
      },
      permission,
      grantedByUserId,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }));
    const workspaceRepository = createWorkspaceRepository();
    const accessSettingRepository = createAccessSettingRepository();
    const eventEmitter = createEventEmitter();
    const invitationRepository = createInvitationRepository();
    const useCase = new ShareDocumentUseCase(
      createCommandRepository(),
      grantRepository,
      invitationRepository,
      createDocumentAccessCapabilityService(workspaceRepository, grantRepository, accessSettingRepository),
      workspaceRepository,
      eventEmitter,
    );

    await expect(useCase.executeMany(document.id, currentUser, {
      grants: [
        {
          userId: 'recipient-user-1',
          permission: DocumentAccessGrantPermission.EDIT,
        },
        {
          userId: 'missing-user',
          permission: DocumentAccessGrantPermission.VIEW,
        },
      ],
    })).resolves.toMatchObject({
      collaborators: [
        {
          id: 'grant-recipient-user-1',
          permission: DocumentAccessGrantPermission.EDIT,
        },
      ],
      invitations: [],
      failed: [
        {
          userId: 'missing-user',
          reason: 'user_not_found',
        },
      ],
    });

    expect(grantRepository.upsertGrant).toHaveBeenCalledTimes(1);
    expect(grantRepository.upsertGrant).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      documentId: 'document-1',
      userId: 'recipient-user-1',
      permission: DocumentAccessGrantPermission.EDIT,
      grantedByUserId: 'owner-user',
    });
    expect(workspaceRepository.addMember).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      userId: 'recipient-user-1',
      role: WorkspaceRole.MEMBER,
    });
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'document.access.changed',
      new DocumentAccessChangedEvent('document-1', 'workspace-1'),
    );
  });

  it('creates a pending invitation when sharing with an unknown email', async () => {
    const grantRepository = createGrantRepository();
    grantRepository.findUserByEmail.mockResolvedValue(null);
    const invitationRepository = createInvitationRepository();
    const workspaceRepository = createWorkspaceRepository();
    const accessSettingRepository = createAccessSettingRepository();
    const eventEmitter = createEventEmitter();
    const useCase = new ShareDocumentUseCase(
      createCommandRepository(),
      grantRepository,
      invitationRepository,
      createDocumentAccessCapabilityService(workspaceRepository, grantRepository, accessSettingRepository),
      workspaceRepository,
      eventEmitter,
    );

    await expect(useCase.executeMany(document.id, currentUser, {
      grants: [
        {
          email: 'Pending@Example.com',
          permission: DocumentAccessGrantPermission.COMMENT,
        },
      ],
    })).resolves.toMatchObject({
      collaborators: [],
      invitations: [
        {
          id: 'invitation-1',
          email: 'pending@example.com',
          permission: DocumentAccessGrantPermission.COMMENT,
        },
      ],
      failed: [],
    });

    expect(invitationRepository.upsertInvitation).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      documentId: 'document-1',
      email: 'pending@example.com',
      permission: DocumentAccessGrantPermission.COMMENT,
      invitedByUserId: 'owner-user',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'document.access.changed',
      new DocumentAccessChangedEvent('document-1', 'workspace-1'),
    );
  });

  it('rejects sharing by user id when the user does not exist', async () => {
    const grantRepository = createGrantRepository();
    grantRepository.findUserById.mockResolvedValue(null);
    const workspaceRepository = createWorkspaceRepository();
    const accessSettingRepository = createAccessSettingRepository();
    const useCase = new ShareDocumentUseCase(
      createCommandRepository(),
      grantRepository,
      createInvitationRepository(),
      createDocumentAccessCapabilityService(workspaceRepository, grantRepository, accessSettingRepository),
      workspaceRepository,
      createEventEmitter(),
    );

    await expect(useCase.execute(document.id, currentUser, {
      userId: 'missing-user',
      permission: DocumentAccessGrantPermission.VIEW,
    })).rejects.toBeInstanceOf(DocumentAccessGrantUserNotFoundError);
  });

  it('allows a manage grant recipient to list and revoke collaborators', async () => {
    const grantRepository = createGrantRepository();
    grantRepository.findActiveGrant.mockResolvedValue({
      id: 'manager-grant',
      documentId: 'document-1',
      user: {
        id: 'owner-user',
        email: 'owner@example.com',
      },
      permission: DocumentAccessGrantPermission.MANAGE,
      grantedByUserId: 'owner-user',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const workspaceRepository = createWorkspaceRepository();
    const accessSettingRepository = createAccessSettingRepository();
    const listUseCase = new ListDocumentCollaboratorsUseCase(
      createCommandRepository(),
      grantRepository,
      createDocumentAccessCapabilityService(workspaceRepository, grantRepository, accessSettingRepository),
    );
    const revokeUseCase = new RevokeDocumentAccessUseCase(
      createCommandRepository(),
      grantRepository,
      createDocumentAccessCapabilityService(workspaceRepository, grantRepository, accessSettingRepository),
      createEventEmitter(),
    );

    await expect(listUseCase.execute(document.id, currentUser)).resolves.toEqual([]);
    await expect(revokeUseCase.execute(document.id, currentUser, 'recipient-user')).resolves.toBeUndefined();

    expect(grantRepository.listActiveGrants).toHaveBeenCalledWith('document-1');
    expect(grantRepository.revokeGrant).toHaveBeenCalledWith({
      documentId: 'document-1',
      userId: 'recipient-user',
    });
  });

  it('allows a view grant recipient to list collaborators', async () => {
    const commandRepository = createCommandRepository();
    commandRepository.findDocument.mockResolvedValue({
      ...document,
      ownerUser: { id: 'another-user' },
    } as never);
    const grantRepository = createGrantRepository();
    grantRepository.findActiveGrant.mockResolvedValue({
      id: 'viewer-grant',
      documentId: 'document-1',
      user: {
        id: 'owner-user',
        email: 'owner@example.com',
      },
      permission: DocumentAccessGrantPermission.VIEW,
      grantedByUserId: 'another-user',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    grantRepository.listActiveGrants.mockResolvedValue([{
      id: 'viewer-grant',
      documentId: 'document-1',
      user: {
        id: 'owner-user',
        email: 'owner@example.com',
      },
      permission: DocumentAccessGrantPermission.VIEW,
      grantedByUserId: 'another-user',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }]);
    const workspaceRepository = createWorkspaceRepository();
    const accessSettingRepository = createAccessSettingRepository();
    const useCase = new ListDocumentCollaboratorsUseCase(
      commandRepository,
      grantRepository,
      createDocumentAccessCapabilityService(workspaceRepository, grantRepository, accessSettingRepository),
    );

    await expect(useCase.execute(document.id, currentUser)).resolves.toMatchObject([
      {
        id: 'viewer-grant',
        permission: DocumentAccessGrantPermission.VIEW,
      },
    ]);

    expect(grantRepository.listActiveGrants).toHaveBeenCalledWith('document-1');
  });

  it('lists inherited collaborators from ancestor grants when child has no direct grant', async () => {
    const commandRepository = createCommandRepository();
    commandRepository.findDocument.mockResolvedValue({
      ...document,
      id: 'child-document',
      parentDocument: { id: 'parent-document' },
    } as never);
    const grantRepository = createGrantRepository();
    grantRepository.listStrongestActiveGrantsInAncestors.mockResolvedValue([{
      id: 'parent-grant',
      documentId: 'parent-document',
      user: {
        id: 'recipient-user',
        email: 'recipient@example.com',
      },
      permission: DocumentAccessGrantPermission.VIEW,
      grantedByUserId: 'owner-user',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      inheritedFromDocument: {
        id: 'parent-document',
        title: 'Parent',
      },
    }]);
    const workspaceRepository = createWorkspaceRepository();
    const accessSettingRepository = createAccessSettingRepository();
    const useCase = new ListDocumentCollaboratorsUseCase(
      commandRepository,
      grantRepository,
      createDocumentAccessCapabilityService(workspaceRepository, grantRepository, accessSettingRepository),
    );

    await expect(useCase.execute('child-document', currentUser)).resolves.toEqual([
      expect.objectContaining({
        accessSource: 'inherited',
        documentId: 'parent-document',
        inheritedFromDocument: {
          id: 'parent-document',
          title: 'Parent',
        },
        permission: DocumentAccessGrantPermission.VIEW,
        user: {
          id: 'recipient-user',
          email: 'recipient@example.com',
        },
      }),
    ]);
  });

  it('rejects collaborator management without manage capability', async () => {
    const commandRepository = createCommandRepository();
    commandRepository.findDocument.mockResolvedValue({
      ...document,
      ownerUser: { id: 'another-user' },
    } as never);
    const grantRepository = createGrantRepository();
    const accessSettingRepository = createAccessSettingRepository();
    const workspaceRepository = createWorkspaceRepository();
    const useCase = new ShareDocumentUseCase(
      commandRepository,
      grantRepository,
      createInvitationRepository(),
      createDocumentAccessCapabilityService(workspaceRepository, grantRepository, accessSettingRepository),
      workspaceRepository,
      createEventEmitter(),
    );

    await expect(useCase.execute(document.id, currentUser, {
      userId: 'recipient-user',
      permission: DocumentAccessGrantPermission.VIEW,
    })).rejects.toBeInstanceOf(DocumentPermissionDeniedError);
  });

  it('updates workspace member access for a managed document', async () => {
    const accessSettingRepository = createAccessSettingRepository();
    const workspaceRepository = createWorkspaceRepository();
    const grantRepository = createGrantRepository();
    const eventEmitter = createEventEmitter();
    const useCase = new UpdateDocumentAccessSettingsUseCase(
      createCommandRepository(),
      accessSettingRepository,
      createDocumentAccessCapabilityService(workspaceRepository, grantRepository, accessSettingRepository),
      eventEmitter,
    );

    await expect(useCase.execute(document.id, currentUser, {
      workspaceMemberPermission: DocumentAccessGrantPermission.VIEW,
    })).resolves.toMatchObject({
      documentId: 'document-1',
      workspaceMemberPermission: DocumentAccessGrantPermission.VIEW,
    });

    expect(accessSettingRepository.upsertWorkspaceMemberPermission).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      documentId: 'document-1',
      permission: DocumentAccessGrantPermission.VIEW,
      updatedByUserId: 'owner-user',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'document.access.changed',
      new DocumentAccessChangedEvent('document-1', 'workspace-1'),
    );
  });

  it('gets document access settings when the actor can manage access', async () => {
    const accessSettingRepository = createAccessSettingRepository();
    accessSettingRepository.findByDocumentId.mockResolvedValue({
      documentId: 'document-1',
      workspaceMemberPermission: DocumentAccessGrantPermission.EDIT,
      updatedByUserId: 'owner-user',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const workspaceRepository = createWorkspaceRepository();
    const grantRepository = createGrantRepository();
    const useCase = new GetDocumentAccessSettingsUseCase(
      createNavigationQueryRepository(),
      createDocumentAccessCapabilityService(workspaceRepository, grantRepository, accessSettingRepository),
    );

    await expect(useCase.execute(document.id, currentUser)).resolves.toMatchObject({
      documentId: 'document-1',
      workspaceMemberPermission: DocumentAccessGrantPermission.EDIT,
    });
  });
});
