import { Injectable } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import {
  Observable, Subject, interval, 
} from 'rxjs';
import type { AuthenticatedUser } from '../../domains/auth/app/auth.types';
import type { SseEvent } from './app/sse.types';

type ClientConnection = {
  userId: string;
  stream: Subject<MessageEvent>;
};

@Injectable()
export class SseService {
  private readonly heartbeatIntervalMs = 30_000;
  private readonly clients = new Map<string, Set<ClientConnection>>();

  createUserStream(user: AuthenticatedUser): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const stream = new Subject<MessageEvent>();
      const connection: ClientConnection = {
        userId: user.userId,
        stream,
      };
      const heartbeat = interval(this.heartbeatIntervalMs).subscribe(() => {
        stream.next({
          type: 'heartbeat',
          data: {
            timestamp: new Date().toISOString(),
          },
        });
      });
      const streamSubscription = stream.subscribe(subscriber);

      this.registerClient(connection);
      stream.next({
        type: 'connected',
        data: {
          userId: user.userId,
          sessionId: user.sessionId,
        },
      });

      return () => {
        heartbeat.unsubscribe();
        streamSubscription.unsubscribe();
        this.unregisterClient(connection);
        stream.complete();
      };
    });
  }

  publishToUser<TData extends string | object>(
    userId: string,
    event: SseEvent<TData>,
  ): void {
    const connections = this.clients.get(userId);

    if (!connections) {
      return;
    }

    for (const connection of connections) {
      connection.stream.next(this.toMessageEvent(event));
    }
  }

  publishToUsers<TData extends string | object>(
    userIds: string[],
    event: SseEvent<TData>,
  ): void {
    for (const userId of userIds) {
      this.publishToUser(userId, event);
    }
  }

  broadcast<TData extends string | object>(event: SseEvent<TData>): void {
    const messageEvent = this.toMessageEvent(event);

    for (const connections of this.clients.values()) {
      for (const connection of connections) {
        connection.stream.next(messageEvent);
      }
    }
  }

  countConnections(userId?: string): number {
    if (userId) {
      return this.clients.get(userId)?.size ?? 0;
    }

    let total = 0;

    for (const connections of this.clients.values()) {
      total += connections.size;
    }

    return total;
  }

  private registerClient(connection: ClientConnection): void {
    const currentConnections = this.clients.get(connection.userId) ?? new Set<ClientConnection>();

    currentConnections.add(connection);
    this.clients.set(connection.userId, currentConnections);
  }

  private unregisterClient(connection: ClientConnection): void {
    const currentConnections = this.clients.get(connection.userId);

    if (!currentConnections) {
      return;
    }

    currentConnections.delete(connection);

    if (currentConnections.size === 0) {
      this.clients.delete(connection.userId);
    }
  }

  private toMessageEvent<TData extends string | object>(
    event: SseEvent<TData>,
  ): MessageEvent {
    return {
      type: event.type,
      data: event.data,
      id: event.id,
    };
  }
}
