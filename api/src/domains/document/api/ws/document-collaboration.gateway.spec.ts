import { Scope } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedUser } from '../../../auth/app/auth.types';
import { WsAuthService } from '../../../../platform/ws/ws-auth.service';
import { DocumentCollaborationProjector } from '../../app/ports/document-collaboration-projector';
import { DocumentCollaborationRepository } from '../../app/ports/document-collaboration.repository';
import { DocumentCollaborationTransactionRunner } from '../../app/ports/document-collaboration-transaction-runner';
import { DocumentAccessResolver } from '../../app/policies/document-access.resolver';
import { DocumentCommandRepository } from '../../app/ports/document-command.repository';
import { DocumentCollaborationReferenceSyncService } from '../../app/services/document-collaboration-reference-sync.service';
import { DocumentCollaborationService } from '../../app/services/document-collaboration.service';
import { DocumentSubdocContentService } from '../../app/services/document-subdoc-content.service';
import { DocumentSubdocReferenceSyncService } from '../../app/services/document-subdoc-reference-sync.service';
import { SyncDocumentSubdocReferencesUseCase } from '../../app/use-cases/sync-document-subdoc-references.use-case';
import { DocumentCollaborationGateway } from './document-collaboration.gateway';

describe('DocumentCollaborationGateway', () => {
  const user: AuthenticatedUser = {
    userId: 'user-1',
    email: 'editor@example.com',
    status: 'active' as never,
    sessionId: 'session-1',
    roles: [],
    permissions: [],
  };

  it('persists an update before broadcasting it to the document room', async () => {
    const emit = jest.fn();
    const applyUpdate = jest.fn().mockResolvedValue({
      propagatedUpdates: [],
      sequence: 4,
    });
    const gateway = new DocumentCollaborationGateway(
      {} as WsAuthService,
      { applyUpdate } as unknown as DocumentCollaborationService,
    );
    const socket = {
      data: {
        collaborationDocumentIds: new Set(['document-1']),
        user,
      },
      to: jest.fn().mockReturnValue({ emit }),
    };

    const result = await gateway.update(socket as never, {
      documentId: 'document-1',
      update: new Uint8Array([1, 2, 3]),
    });

    expect(result).toEqual({ ok: true, data: { sequence: 4 } });
    expect(applyUpdate).toHaveBeenCalledWith(
      'document-1',
      user,
      new Uint8Array([1, 2, 3]),
    );
    expect(emit).toHaveBeenCalledWith('collab:update', {
      documentId: 'document-1',
      update: Buffer.from([1, 2, 3]),
    });
    expect(applyUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      emit.mock.invocationCallOrder[0],
    );
  });

  it('waits for connection authentication before joining a document', async () => {
    let resolveAuthentication!: (authenticatedUser: AuthenticatedUser) => void;
    const authentication = new Promise<AuthenticatedUser>((resolve) => {
      resolveAuthentication = resolve;
    });
    const synchronize = jest.fn().mockResolvedValue({
      canEdit: true,
      serverStateVector: new Uint8Array([0]),
      update: new Uint8Array([0]),
    });
    const authService = {
      authenticate: jest.fn().mockReturnValue(authentication),
    };
    const gateway = new DocumentCollaborationGateway(
      authService as unknown as WsAuthService,
      { synchronize } as unknown as DocumentCollaborationService,
    );
    const socket = {
      data: {},
      disconnect: jest.fn(),
      emit: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
    };

    const connecting = gateway.handleConnection(socket as never);
    const joining = gateway.join(socket as never, {
      documentId: 'document-1',
      stateVector: new Uint8Array([0]),
    });

    await Promise.resolve();
    expect(synchronize).not.toHaveBeenCalled();

    resolveAuthentication(user);

    await expect(joining).resolves.toEqual({
      ok: true,
      data: {
        canEdit: true,
        serverStateVector: Buffer.from([0]),
        update: Buffer.from([0]),
      },
    });
    await connecting;
    expect(authService.authenticate).toHaveBeenCalledTimes(1);
    expect(synchronize).toHaveBeenCalledWith(
      'document-1',
      user,
      new Uint8Array([0]),
    );
  });

  it('joins a workspace member read-only when synchronization grants view access', async () => {
    const synchronize = jest.fn().mockResolvedValue({
      canEdit: false,
      serverStateVector: new Uint8Array([0]),
      update: new Uint8Array([0]),
    });
    const gateway = new DocumentCollaborationGateway(
      {} as WsAuthService,
      { synchronize } as unknown as DocumentCollaborationService,
    );
    const socket = {
      data: {
        collaborationDocumentIds: new Set<string>(),
        user,
      },
      join: jest.fn().mockResolvedValue(undefined),
    };

    await expect(gateway.join(socket as never, {
      documentId: 'document-1',
      stateVector: new Uint8Array([0]),
    })).resolves.toEqual({
      ok: true,
      data: {
        canEdit: false,
        serverStateVector: Buffer.from([0]),
        update: Buffer.from([0]),
      },
    });

    expect(socket.join).toHaveBeenCalledWith('document:document-1');
    expect(socket.data.collaborationDocumentIds).toContain('document-1');
  });

  it('rejects document updates until the socket has joined that document room', async () => {
    const applyUpdate = jest.fn();
    const gateway = new DocumentCollaborationGateway(
      {} as WsAuthService,
      { applyUpdate } as unknown as DocumentCollaborationService,
    );
    const socket = {
      data: {
        collaborationDocumentIds: new Set<string>(),
        user,
      },
      to: jest.fn(),
    };

    await expect(gateway.update(socket as never, {
      documentId: 'document-1',
      update: new Uint8Array([1]),
    })).resolves.toEqual({
      ok: false,
      error: {
        code: 'DOCUMENT_COLLABORATION_PERMISSION_DENIED',
        message: 'You do not have permission to edit this document',
      },
    });

    expect(applyUpdate).not.toHaveBeenCalled();
    expect(socket.to).not.toHaveBeenCalled();
  });

  it('relays awareness for any socket that has joined the document room', () => {
    const emit = jest.fn();
    const gateway = new DocumentCollaborationGateway(
      {} as WsAuthService,
      {} as DocumentCollaborationService,
    );
    const socket = {
      data: {
        collaborationDocumentIds: new Set(['document-1']),
        user,
      },
      to: jest.fn().mockReturnValue({ emit }),
    };

    expect(gateway.awareness(socket as never, {
      documentId: 'document-1',
      update: new Uint8Array([1]),
    })).toEqual({ ok: true, data: {} });

    expect(emit).toHaveBeenCalledWith('collab:awareness', {
      documentId: 'document-1',
      update: Buffer.from([1]),
    });
  });

  it('stays singleton when document command providers are request scoped', async () => {
    const module = await Test.createTestingModule({
      providers: [
        DocumentCollaborationGateway,
        DocumentAccessResolver,
        DocumentCollaborationReferenceSyncService,
        DocumentCollaborationService,
        DocumentSubdocReferenceSyncService,
        {
          provide: WsAuthService,
          useValue: {},
        },
        {
          provide: DocumentCollaborationRepository,
          useValue: {
            getAccess: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: DocumentCollaborationProjector,
          useValue: {},
        },
        {
          provide: DocumentCollaborationTransactionRunner,
          useValue: {},
        },
        {
          provide: DocumentSubdocContentService,
          useValue: {},
        },
        {
          provide: DocumentCommandRepository,
          scope: Scope.REQUEST,
          useFactory: () => ({}),
        },
        {
          provide: SyncDocumentSubdocReferencesUseCase,
          scope: Scope.REQUEST,
          useFactory: () => ({}),
        },
      ],
    }).compile();
    const gateway = module.get(DocumentCollaborationGateway);
    const socket = {
      data: { user },
      join: jest.fn(),
    };

    await expect(gateway.join(socket as never, {
      documentId: 'missing-document',
      stateVector: new Uint8Array([0]),
    })).resolves.toEqual({
      ok: false,
      error: {
        code: 'DOCUMENT_COLLABORATION_NOT_FOUND',
        message: 'Document missing-document was not found',
      },
    });

    expect(socket.join).not.toHaveBeenCalled();
    await module.close();
  });
});
