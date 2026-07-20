import type { AuthenticatedUser } from '../../domains/auth/app/auth.types';
import type { AuthTokenService } from '../../domains/auth/app/ports/auth-token.service';
import type { LoadAuthenticatedUserUseCase } from '../../domains/auth/app/use-cases/load-authenticated-user.use-case';
import type { AuthConfig } from '../config/auth.config';
import { WsAuthService } from './ws-auth.service';

describe('WsAuthService', () => {
  it('authenticates browser sockets with the HTTP-only access cookie', async () => {
    const authenticatedUser = {
      userId: 'user-1',
      sessionId: 'session-1',
    } as AuthenticatedUser;
    const verifyAccessToken = jest.fn().mockResolvedValue({
      sub: 'user-1',
      sessionId: 'session-1',
    });
    const execute = jest.fn().mockResolvedValue({
      isOk: true,
      value: authenticatedUser,
    });
    const service = new WsAuthService(
      { verifyAccessToken } as unknown as AuthTokenService,
      { execute } as unknown as LoadAuthenticatedUserUseCase,
      {
        accessCookieName: 'accessToken',
      } as AuthConfig,
    );

    const result = await service.authenticate({
      handshake: {
        auth: {},
        headers: {
          cookie: 'theme=dark; accessToken=signed-token; locale=en',
        },
      },
    } as never);

    expect(verifyAccessToken).toHaveBeenCalledWith('signed-token');
    expect(execute).toHaveBeenCalledWith('user-1', 'session-1');
    expect(result).toBe(authenticatedUser);
  });
});
