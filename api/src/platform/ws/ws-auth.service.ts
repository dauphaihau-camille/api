import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Socket } from 'socket.io';
import { AUTH_CONFIG, type AuthConfig } from '../config/auth.config';
import { resolveOrThrow } from '~/platform/application/result';
import { mapAuthAppErrorToHttpException } from '../../domains/auth/api/rest/auth-error-mapper';
import type { AuthenticatedUser } from '../../domains/auth/app/auth.types';
import { AuthTokenService } from '../../domains/auth/app/ports/auth-token.service';
import { LoadAuthenticatedUserUseCase } from '../../domains/auth/app/use-cases/load-authenticated-user.use-case';

@Injectable()
export class WsAuthService {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly loadAuthenticatedUserUseCase: LoadAuthenticatedUserUseCase,
    @Inject(AUTH_CONFIG) private readonly authConfig: AuthConfig,
  ) {}

  async authenticate(socket: Socket): Promise<AuthenticatedUser> {
    const token = this.extractAccessToken(socket);

    if (!token) {
      throw new UnauthorizedException('Missing websocket access token');
    }

    const payload = await this.authTokenService.verifyAccessToken(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid websocket access token');
    }

    return resolveOrThrow(
      await this.loadAuthenticatedUserUseCase.execute(
        payload.sub,
        payload.sessionId,
      ),
      mapAuthAppErrorToHttpException,
    );
  }

  private extractAccessToken(socket: Socket): string | undefined {
    const authToken = socket.handshake.auth.token;

    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.trim();
    }

    const authorizationHeader = socket.handshake.headers.authorization;

    if (typeof authorizationHeader !== 'string') {
      return this.extractCookieToken(socket.handshake.headers.cookie);
    }

    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) {
      return this.extractCookieToken(socket.handshake.headers.cookie);
    }

    return token.trim();
  }

  private extractCookieToken(cookieHeader?: string): string | undefined {
    if (!cookieHeader) {
      return undefined;
    }

    for (const segment of cookieHeader.split(';')) {
      const separatorIndex = segment.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const name = decodeURIComponent(segment.slice(0, separatorIndex).trim());

      if (name !== this.authConfig.accessCookieName) {
        continue;
      }

      const value = decodeURIComponent(segment.slice(separatorIndex + 1).trim());
      return value || undefined;
    }

    return undefined;
  }
}
