import { HttpException, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AuthenticatedUser } from '../../../auth/app/auth.types';
import { WsAuthService } from '../../../../platform/ws/ws-auth.service';
import {
  DocumentCollaborationNotFoundError,
  DocumentCollaborationPermissionDeniedError,
  InvalidDocumentCollaborationUpdateError,
} from '../../app/errors/document-collaboration.error';
import { DocumentCollaborationService } from '../../app/services/document-collaboration.service';

const MAX_UPDATE_BYTES = 1_000_000;
const MAX_AWARENESS_BYTES = 16_384;

type CollaborationSocketData = {
  authentication?: Promise<AuthenticatedUser>;
  collaborationDocumentIds?: Set<string>;
  user?: AuthenticatedUser;
};

type CollaborationResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

type ServerToClientEvents = {
  'collab:awareness': (payload: { documentId: string; update: Buffer }) => void;
  'collab:error': (payload: CollaborationResponse<never>) => void;
  'collab:update': (payload: { documentId: string; update: Buffer }) => void;
};

type CollaborationSocket = Socket<
  Record<string, (...args: unknown[]) => void>,
  ServerToClientEvents,
  Record<string, (...args: unknown[]) => void>,
  CollaborationSocketData
>;

@WebSocketGateway({
  namespace: '/collaboration',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class DocumentCollaborationGateway
implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger: Logger;

  constructor(
    private readonly authService: WsAuthService,
    private readonly collaborationService: DocumentCollaborationService,
  ) {
    this.logger = new Logger(DocumentCollaborationGateway.name);
    this.join = this.join.bind(this);
    this.update = this.update.bind(this);
    this.awareness = this.awareness.bind(this);
  }

  async handleConnection(socket: CollaborationSocket): Promise<void> {
    socket.data.collaborationDocumentIds = new Set<string>();
  }

  async handleDisconnect(socket: CollaborationSocket): Promise<void> {
    socket.data.collaborationDocumentIds?.clear();
  }

  @SubscribeMessage('collab:join')
  async join(
    @ConnectedSocket() socket: CollaborationSocket,
    @MessageBody() body: unknown,
  ): Promise<CollaborationResponse<{
    canEdit: boolean;
    serverStateVector: Buffer;
    update: Buffer;
  }>> {
    try {
      const documentId = this.parseDocumentId(body);
      const stateVector = this.parseBinaryField(body, 'stateVector', MAX_UPDATE_BYTES);

      const synchronized = await this.collaborationService.synchronize(
        documentId,
        await this.authenticate(socket),
        stateVector,
      );

      await socket.join(this.room(documentId));
      socket.data.collaborationDocumentIds?.add(documentId);

      return {
        ok: true,
        data: {
          canEdit: synchronized.canEdit,
          serverStateVector: Buffer.from(synchronized.serverStateVector),
          update: Buffer.from(synchronized.update),
        },
      };
    }
    catch (error) {
      return this.toErrorResponse(error);
    }
  }

  @SubscribeMessage('collab:update')
  async update(
    @ConnectedSocket() socket: CollaborationSocket,
    @MessageBody() body: unknown,
  ): Promise<CollaborationResponse<{ sequence: number }>> {
    try {
      const documentId = this.parseDocumentId(body);

      this.requireJoinedDocument(socket, documentId);

      const update = this.parseBinaryField(body, 'update', MAX_UPDATE_BYTES);

      const result = await this.collaborationService.applyUpdate(
        documentId,
        await this.authenticate(socket),
        update,
      );

      socket.to(this.room(documentId)).emit('collab:update', {
        documentId,
        update: Buffer.from(update),
      });

      for (const propagatedUpdate of result.propagatedUpdates) {
        this.server.to(this.room(propagatedUpdate.documentId)).emit('collab:update', {
          documentId: propagatedUpdate.documentId,
          update: Buffer.from(propagatedUpdate.update),
        });
      }

      return {
        ok: true,
        data: {
          sequence: result.sequence,
        },
      };
    }
    catch (error) {
      return this.toErrorResponse(error);
    }
  }

  @SubscribeMessage('collab:awareness')
  awareness(
    @ConnectedSocket() socket: CollaborationSocket,
    @MessageBody() body: unknown,
  ): CollaborationResponse<Record<string, never>> {
    try {
      const documentId = this.parseDocumentId(body);
      this.requireJoinedDocument(socket, documentId);
      const update = this.parseBinaryField(body, 'update', MAX_AWARENESS_BYTES);

      socket.to(this.room(documentId)).emit('collab:awareness', {
        documentId,
        update: Buffer.from(update),
      });

      return { ok: true, data: {} };
    }
    catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async authenticate(
    socket: CollaborationSocket,
  ): Promise<AuthenticatedUser> {
    if (socket.data.user) {
      return socket.data.user;
    }

    if (!socket.data.authentication) {
      socket.data.authentication = this.authService.authenticate(socket)
        .then((user) => {
          socket.data.user = user;
          return user;
        });
    }

    return socket.data.authentication;
  }

  private requireJoinedDocument(
    socket: CollaborationSocket,
    documentId: string,
  ): void {
    if (!socket.data.collaborationDocumentIds?.has(documentId)) {
      throw new DocumentCollaborationPermissionDeniedError();
    }
  }

  private parseDocumentId(body: unknown): string {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new InvalidDocumentCollaborationUpdateError();
    }

    const documentId = (body as Record<string, unknown>).documentId;

    if (typeof documentId !== 'string' || documentId.length === 0 || documentId.length > 100) {
      throw new InvalidDocumentCollaborationUpdateError();
    }

    return documentId;
  }

  private parseBinaryField(
    body: unknown,
    field: string,
    maxBytes: number,
  ): Uint8Array {
    const value = (body as Record<string, unknown>)[field];
    let bytes: Uint8Array;

    if (value instanceof Uint8Array) {
      bytes = value;
    }
    else if (Array.isArray(value) && value.every((item) => Number.isInteger(item))) {
      bytes = Uint8Array.from(value as number[]);
    }
    else if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && Array.isArray((value as { data?: unknown }).data)
    ) {
      bytes = Uint8Array.from((value as { data: number[] }).data);
    }
    else {
      throw new InvalidDocumentCollaborationUpdateError();
    }

    if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) {
      throw new InvalidDocumentCollaborationUpdateError();
    }

    return bytes;
  }

  private room(documentId: string): string {
    return `document:${documentId}`;
  }

  private toErrorResponse(error: unknown): CollaborationResponse<never> {
    if (
      error instanceof DocumentCollaborationNotFoundError
      || error instanceof DocumentCollaborationPermissionDeniedError
      || error instanceof InvalidDocumentCollaborationUpdateError
    ) {
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      };
    }

    if (error instanceof HttpException) {
      const response = error.getResponse();
      const responseMessage =
        typeof response === 'string'
          ? response
          : typeof response === 'object'
            && response
            && 'message' in response
            && typeof (response as { message?: unknown }).message === 'string'
            ? (response as { message: string }).message
            : error.message;

      return {
        ok: false,
        error: {
          code: error.name.toUpperCase().replace(/EXCEPTION$/, ''),
          message: responseMessage,
        },
      };
    }

    this.logger?.error?.(error, 'Document collaboration operation failed');

    const fallbackMessage = error instanceof Error
      ? error.message
      : 'Document collaboration operation failed';

    const fallbackCode =
      error instanceof Error && error.name
        ? error.name.toUpperCase().replace(/EXCEPTION$/, '')
        : 'DOCUMENT_COLLABORATION_FAILED';

    return {
      ok: false,
      error: {
        code: fallbackCode || 'DOCUMENT_COLLABORATION_FAILED',
        message: fallbackMessage,
      },
    };
  }
}
