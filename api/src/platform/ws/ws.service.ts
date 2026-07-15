import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../domains/auth/app/auth.types';
import type { Server, Socket } from 'socket.io';
import type { WsConnectionSnapshot } from './app/ws.types';

type SocketConnection = {
  socketId: string;
  user: AuthenticatedUser;
};

@Injectable()
export class WsService {
  private server?: Server;
  private readonly socketConnections = new Map<string, SocketConnection>();
  private readonly userSocketIds = new Map<string, Set<string>>();

  attachServer(server: Server): void {
    this.server = server;
  }

  registerConnection(socket: Socket, user: AuthenticatedUser): void {
    this.socketConnections.set(socket.id, {
      socketId: socket.id,
      user,
    });

    const socketIds = this.userSocketIds.get(user.userId) ?? new Set<string>();
    socketIds.add(socket.id);
    this.userSocketIds.set(user.userId, socketIds);

    void socket.join(this.userRoom(user.userId));
    void socket.join(this.sessionRoom(user.sessionId));
  }

  unregisterConnection(socketId: string): void {
    const connection = this.socketConnections.get(socketId);

    if (!connection) {
      return;
    }

    this.socketConnections.delete(socketId);

    const socketIds = this.userSocketIds.get(connection.user.userId);

    if (!socketIds) {
      return;
    }

    socketIds.delete(socketId);

    if (socketIds.size === 0) {
      this.userSocketIds.delete(connection.user.userId);
    }
  }

  emitToUser<TPayload>(userId: string, event: string, payload: TPayload): void {
    this.server?.to(this.userRoom(userId)).emit(event, payload);
  }

  emitToSession<TPayload>(
    sessionId: string,
    event: string,
    payload: TPayload,
  ): void {
    this.server?.to(this.sessionRoom(sessionId)).emit(event, payload);
  }

  emitToRoom<TPayload>(room: string, event: string, payload: TPayload): void {
    this.server?.to(room).emit(event, payload);
  }

  broadcast<TPayload>(event: string, payload: TPayload): void {
    this.server?.emit(event, payload);
  }

  async joinRoom(socket: Socket, room: string): Promise<void> {
    await socket.join(room);
  }

  async leaveRoom(socket: Socket, room: string): Promise<void> {
    await socket.leave(room);
  }

  countConnections(userId?: string): number {
    if (userId) {
      return this.userSocketIds.get(userId)?.size ?? 0;
    }

    return this.socketConnections.size;
  }

  listConnections(userId?: string): WsConnectionSnapshot[] {
    if (!userId) {
      return Array.from(this.socketConnections.values());
    }

    const socketIds = this.userSocketIds.get(userId);

    if (!socketIds) {
      return [];
    }

    return Array.from(socketIds)
      .map((socketId) => this.socketConnections.get(socketId))
      .filter((connection): connection is SocketConnection => Boolean(connection));
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private sessionRoom(sessionId: string): string {
    return `session:${sessionId}`;
  }
}
