import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { UserStatus } from '~/domains/auth/domain/enums/user-status.enum';
import type { AuditService } from '~/integrations/audit/audit.service';
import type { WorkspaceRepository } from '../../../workspace/app/ports/workspace.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import type { DocumentCommandRepository } from '../ports/document-command.repository';
import type { DocumentNavigationQueryRepository } from '../ports/document-navigation-query.repository';
import type { DocumentAccessCapabilityService } from '../services/document-access-capability.service';
import type { DocumentTreeService } from '../services/document-tree.service';
import { MoveDocumentUseCase } from './move-document.use-case';

describe('MoveDocumentUseCase', () => {
  const currentUser: AuthenticatedUser = {
    userId: 'user-1',
    email: 'user@example.com',
    status: UserStatus.ACTIVE,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  function createDocument(id: string) {
    return {
      id,
      publicId: `${id}-public`,
      version: 1,
      workspace: { id: 'workspace-1' },
      ownerUser: {
        id: 'user-1',
        email: 'user@example.com',
      },
      teamspace: undefined,
      parentDocument: undefined,
      title: id,
      contentFormat: 'blocknote_v1',
      contentJson: [],
      sortKey: 1,
      archivedAt: undefined,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedBy: {
        email: 'user@example.com',
      },
    };
  }

  it('applies the destination teamspace to the moved document subtree', async () => {
    const document = createDocument('document-1');
    const descendant = createDocument('document-2');
    const workspaceRepository = {
      findAllForUser: jest.fn().mockResolvedValue([{
        id: 'workspace-1',
        currentUserRole: WorkspaceRole.MEMBER,
      }]),
    } as unknown as jest.Mocked<WorkspaceRepository>;
    const accessCapabilityService = {
      assertCanEdit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DocumentAccessCapabilityService>;
    const commandRepository = {
      findDocument: jest.fn().mockResolvedValue(document),
      lockDocumentVersion: jest.fn(),
      findTeamspaceByIdInWorkspace: jest.fn().mockResolvedValue({
        id: 'teamspace-1',
        name: 'Engineering',
      }),
      assignUpdatedByUser: jest.fn(),
      saveDocuments: jest.fn(),
    } as unknown as jest.Mocked<DocumentCommandRepository>;
    const navigationQueryRepository = {
      findDocument: jest.fn(),
    } as unknown as jest.Mocked<DocumentNavigationQueryRepository>;
    const treeService = {
      isDescendantOf: jest.fn(),
      resolveSortKeyForMove: jest.fn().mockResolvedValue(10),
      findDescendants: jest.fn().mockResolvedValue([descendant]),
    } as unknown as jest.Mocked<DocumentTreeService>;
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    const useCase = new MoveDocumentUseCase(
      auditService,
      workspaceRepository,
      accessCapabilityService,
      commandRepository,
      navigationQueryRepository,
      treeService,
    );

    await expect(useCase.execute('document-1', currentUser, {
      version: 1,
      teamspaceId: 'teamspace-1',
    })).resolves.toMatchObject({
      id: 'document-1',
      teamspaceId: 'teamspace-1',
    });

    expect(document.teamspace).toEqual({ id: 'teamspace-1' });
    expect(descendant.teamspace).toEqual({ id: 'teamspace-1' });
    expect(commandRepository.saveDocuments).toHaveBeenCalledWith([
      document,
      descendant,
    ]);
  });
});
