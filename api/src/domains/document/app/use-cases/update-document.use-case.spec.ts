import type { AuditService } from '~/integrations/audit/audit.service';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import {
  DocumentContentManagedByCollaborationError,
  DocumentPermissionDeniedError,
} from '../errors/document-app.error';
import type { DocumentCollaborationRepository } from '../ports/document-collaboration.repository';
import type { DocumentCommandRepository } from '../ports/document-command.repository';
import { DocumentAccessResolver } from '../policies/document-access.resolver';
import type { SyncDocumentSubdocReferencesUseCase } from './sync-document-subdoc-references.use-case';
import type { SyncReferencedSubdocTitlesUseCase } from './sync-referenced-subdoc-titles.use-case';
import { UpdateDocumentUseCase } from './update-document.use-case';

describe('UpdateDocumentUseCase collaboration boundary', () => {
  it('rejects REST content replacement after collaboration state exists', async () => {
    const document = {
      id: 'document-1',
      workspace: { id: 'workspace-1' },
    };
    const workspaceRepository = {
      findAllForUser: jest.fn().mockResolvedValue([{
        id: 'workspace-1',
        currentUserRole: WorkspaceRole.OWNER,
      }]),
    } as unknown as jest.Mocked<WorkspaceRepository>;
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
    const useCase = new UpdateDocumentUseCase(
      {} as AuditService,
      workspaceRepository,
      new DocumentAccessResolver(),
      commandRepository,
      collaborationRepository,
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
    const workspaceRepository = {
      findAllForUser: jest.fn().mockResolvedValue([{
        id: 'workspace-1',
        currentUserRole: WorkspaceRole.MEMBER,
      }]),
    } as unknown as jest.Mocked<WorkspaceRepository>;
    const commandRepository = {
      findDocument: jest.fn().mockResolvedValue({
        id: 'document-1',
        workspace: { id: 'workspace-1' },
      }),
      lockDocumentVersion: jest.fn(),
    } as unknown as jest.Mocked<DocumentCommandRepository>;
    const collaborationRepository = {
      loadState: jest.fn(),
    } as unknown as jest.Mocked<DocumentCollaborationRepository>;
    const useCase = new UpdateDocumentUseCase(
      {} as AuditService,
      workspaceRepository,
      new DocumentAccessResolver(),
      commandRepository,
      collaborationRepository,
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
});
