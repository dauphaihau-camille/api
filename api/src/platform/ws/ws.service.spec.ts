import type { AuthenticatedUser } from '../../domains/auth/app/auth.types';
import { WsService } from './ws.service';

describe('WsService', () => {
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

  function createSocket(
    id: string,
    user: AuthenticatedUser,
  ): {
    id: string;
    join: jest.Mock<Promise<void>, [string]>;
    leave: jest.Mock<Promise<void>, [string]>;
    data: { user?: AuthenticatedUser };
  } {
    return {
      id,
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      data: {
        user,
      },
    };
  }

  it('tracks connections per user and joins built-in rooms', () => {
    const service = new WsService();
    const socket = createSocket('socket-1', createUser());

    service.registerConnection(socket as never, socket.data.user as AuthenticatedUser);

    expect(service.countConnections()).toBe(1);
    expect(service.countConnections('user-1')).toBe(1);
    expect(service.listConnections('user-1')).toEqual([
      {
        socketId: 'socket-1',
        user: expect.objectContaining({
          userId: 'user-1',
          sessionId: 'session-1',
        }),
      },
    ]);
    expect(socket.join).toHaveBeenCalledWith('user:user-1');
    expect(socket.join).toHaveBeenCalledWith('session:session-1');

    service.unregisterConnection('socket-1');

    expect(service.countConnections()).toBe(0);
  });

  it('emits to user, session, room, and broadcast scopes', () => {
    const service = new WsService();
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({
      emit,
    });

    service.attachServer({
      emit,
      to,
    } as never);

    service.emitToUser('user-1', 'notification.created', { id: 'n-1' });
    service.emitToSession('session-1', 'session.refreshed', { ok: true });
    service.emitToRoom('room:ops', 'ops.updated', { count: 2 });
    service.broadcast('system.updated', { status: 'ok' });

    expect(to).toHaveBeenCalledWith('user:user-1');
    expect(to).toHaveBeenCalledWith('session:session-1');
    expect(to).toHaveBeenCalledWith('room:ops');
    expect(emit).toHaveBeenCalledWith('notification.created', { id: 'n-1' });
    expect(emit).toHaveBeenCalledWith('session.refreshed', { ok: true });
    expect(emit).toHaveBeenCalledWith('ops.updated', { count: 2 });
    expect(emit).toHaveBeenCalledWith('system.updated', { status: 'ok' });
  });
});
