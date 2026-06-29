import type { AuthenticatedUser } from '../../domains/auth/app/auth.types';
import { SseService } from './sse.service';

describe('SseService', () => {
  function createUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
    return {
      userId: 'user-1',
      email: 'member@example.com',
      status: 'active' as never,
      sessionId: 'session-1',
      roles: [],
      permissions: [],
      ...overrides,
    };
  }

  it('tracks connections and publishes user-scoped events', () => {
    const service = new SseService();
    const receivedEvents: Array<{ type?: string; data?: unknown }> = [];

    const subscription = service
      .createUserStream(createUser())
      .subscribe((event) => receivedEvents.push(event));

    service.publishToUser('user-1', {
      type: 'notification',
      data: { message: 'hello' },
    });

    expect(service.countConnections()).toBe(1);
    expect(receivedEvents).toEqual([
      {
        type: 'connected',
        data: {
          userId: 'user-1',
          sessionId: 'session-1',
        },
      },
      {
        type: 'notification',
        data: { message: 'hello' },
      },
    ]);

    subscription.unsubscribe();

    expect(service.countConnections()).toBe(0);
  });

  it('broadcasts events to all active connections', () => {
    const service = new SseService();
    const firstEvents: Array<{ type?: string; data?: unknown }> = [];
    const secondEvents: Array<{ type?: string; data?: unknown }> = [];

    const firstSubscription = service
      .createUserStream(createUser({ userId: 'user-1', sessionId: 'session-1' }))
      .subscribe((event) => firstEvents.push(event));
    const secondSubscription = service
      .createUserStream(createUser({ userId: 'user-2', sessionId: 'session-2' }))
      .subscribe((event) => secondEvents.push(event));

    service.broadcast({
      type: 'system',
      data: { state: 'ok' },
    });

    expect(firstEvents.at(-1)).toEqual({
      type: 'system',
      data: { state: 'ok' },
      id: undefined,
    });
    expect(secondEvents.at(-1)).toEqual({
      type: 'system',
      data: { state: 'ok' },
      id: undefined,
    });

    firstSubscription.unsubscribe();
    secondSubscription.unsubscribe();
  });
});
