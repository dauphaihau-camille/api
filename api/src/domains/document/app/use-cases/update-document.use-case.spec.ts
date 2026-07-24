import type { AuditService } from '~/integrations/audit/audit.service';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import {
  DocumentContentManagedByCollaborationError,
  DocumentPermissionDeniedError,
} from '../errors/document-app.error';
import type { DocumentCollaborationRepository } from '../ports/document-collaboration.repository';
import type { DocumentCommandRepository } from '../ports/document-command.repository';
import type { DocumentAccessGrantRepository } from '../ports/document-access-grant.repository';
import type { DocumentAccessSettingRepository } from '../ports/document-access-setting.repository';
import { DocumentAccessResolver } from '../policies/document-access.resolver';
import { DocumentAccessCapabilityService } from '../services/document-access-capability.service';
import type { SyncDocumentSubdocReferencesUseCase } from './sync-document-subdoc-references.use-case';
import type { SyncReferencedSubdocTitlesUseCase } from './sync-referenced-subdoc-titles.use-case';
import { UpdateDocumentUseCase } from './update-document.use-case';

describe('UpdateDocumentUseCase collaboration boundary', () => {
  function createAccessGrantRepository() {
    return {
      findActiveGrant: jest.fn().mockResolvedValue(null),
      findStrongestActiveGrantInAncestors: jest.fn().mockResolvedValue(null),
      findActiveGrantPermissionsByDocumentId: jest.fn().mockResolvedValue(new Map()),
      findStrongestActiveGrantPermissionsInAncestorsByDocumentId: jest.fn().mockResolvedValue(new Map()),
      hasActiveGrants: jest.fn().mockResolvedValue(false),
      hasActiveGrantsIncludingAncestors: jest.fn().mockResolvedValue(false),
      findDocumentIdsWithActiveGrantsIncludingAncestors: jest.fn().mockResolvedValue(new Set()),
    } as unknown as jest.Mocked<DocumentAccessGrantRepository>;
  }

  function createAccessSettingRepository() {
    return {
      findByDocumentId: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<DocumentAccessSettingRepository>;
  }

  function createWorkspaceRepository(role: WorkspaceRole) {
    const workspace = {
      id: 'workspace-1',
      currentUserRole: role,
    };

    return {
      findAllForUser: jest.fn().mockResolvedValue([workspace]),
      findById: jest.fn().mockResolvedValue(workspace),
      findWorkspaceAccess: jest.fn().mockResolvedValue({
        workspace,
        membership: {
          id: 'membership-1',
          userId: 'user-1',
          email: 'user@example.com',
          role,
          joinedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      }),
    } as unknown as jest.Mocked<WorkspaceRepository>;
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

  it('rejects REST content replacement after collaboration state exists', async () => {
    const document = {
      id: 'document-1',
      ownerUser: { id: 'user-1' },
      workspace: { id: 'workspace-1' },
    };
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.OWNER);
    const commandRepository = {
      findDocument: jest.fn().mockResolvedValue(document),
      lockDocumentVersion: jest.fn(),
    } as unknown as jest.Mocked<DocumentCommandRepository>;
    const collaborationRepository = {
      loadState: jest.fn().mockResolvedValue({
        sequence: 1,
        snapshot: new Uint8Array([1]),
        updates: [],
      }),
    } as unknown as jest.Mocked<DocumentCollaborationRepository>;
    const accessGrantRepository = createAccessGrantRepository();
    const accessSettingRepository = createAccessSettingRepository();
    const useCase = new UpdateDocumentUseCase(
      {} as AuditService,
      commandRepository,
      collaborationRepository,
      createDocumentAccessCapabilityService(workspaceRepository, accessGrantRepository, accessSettingRepository),
      {} as SyncDocumentSubdocReferencesUseCase,
      {} as SyncReferencedSubdocTitlesUseCase,
    );

    await expect(useCase.execute('document-1', {
      userId: 'user-1',
    } as never, {
      version: 1,
      content: [],
    })).rejects.toBeInstanceOf(DocumentContentManagedByCollaborationError);

    expect(commandRepository.lockDocumentVersion).not.toHaveBeenCalled();
  });

  it('preserves the workspace member edit denial through document capabilities', async () => {
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.MEMBER);
    const commandRepository = {
      findDocument: jest.fn().mockResolvedValue({
        id: 'document-1',
        ownerUser: { id: 'another-user' },
        workspace: { id: 'workspace-1' },
      }),
      lockDocumentVersion: jest.fn(),
    } as unknown as jest.Mocked<DocumentCommandRepository>;
    const collaborationRepository = {
      loadState: jest.fn(),
    } as unknown as jest.Mocked<DocumentCollaborationRepository>;
    const accessGrantRepository = createAccessGrantRepository();
    const accessSettingRepository = createAccessSettingRepository();
    const useCase = new UpdateDocumentUseCase(
      {} as AuditService,
      commandRepository,
      collaborationRepository,
      createDocumentAccessCapabilityService(workspaceRepository, accessGrantRepository, accessSettingRepository),
      {} as SyncDocumentSubdocReferencesUseCase,
      {} as SyncReferencedSubdocTitlesUseCase,
    );

    await expect(useCase.execute('document-1', {
      userId: 'user-1',
    } as never, {
      version: 1,
      title: 'Denied update',
    })).rejects.toBeInstanceOf(DocumentPermissionDeniedError);

    expect(commandRepository.lockDocumentVersion).not.toHaveBeenCalled();
    expect(collaborationRepository.loadState).not.toHaveBeenCalled();
  });

  it('allows a workspace member to edit their own private document', async () => {
    const document = {
      id: 'document-1',
      ownerUser: { id: 'user-1' },
      title: 'Old title',
      version: 1,
      workspace: { id: 'workspace-1' },
      contentFormat: 'blocknote_v1',
      contentJson: [],
      sortKey: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedBy: {
        displayName: 'User One',
        email: 'user@example.com',
      },
    };
    const workspaceRepository = createWorkspaceRepository(WorkspaceRole.MEMBER);
    const commandRepository = {
      assignUpdatedByUser: jest.fn(),
      findDocument: jest.fn().mockResolvedValue(document),
      lockDocumentVersion: jest.fn(),
      saveDocument: jest.fn(),
    } as unknown as jest.Mocked<DocumentCommandRepository>;
    const collaborationRepository = {
      loadState: jest.fn(),
    } as unknown as jest.Mocked<DocumentCollaborationRepository>;
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const syncReferencedSubdocTitlesUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SyncReferencedSubdocTitlesUseCase>;
    const accessGrantRepository = createAccessGrantRepository();
    const accessSettingRepository = createAccessSettingRepository();
    const useCase = new UpdateDocumentUseCase(
      auditService,
      commandRepository,
      collaborationRepository,
      createDocumentAccessCapabilityService(workspaceRepository, accessGrantRepository, accessSettingRepository),
      {} as SyncDocumentSubdocReferencesUseCase,
      syncReferencedSubdocTitlesUseCase,
    );

    await expect(useCase.execute('document-1', {
      userId: 'user-1',
    } as never, {
      version: 1,
      title: 'New title',
    })).resolves.toMatchObject({
      id: 'document-1',
      ownerUserId: 'user-1',
      title: 'New title',
    });

    expect(commandRepository.saveDocument).toHaveBeenCalledWith(document);
  });
});
