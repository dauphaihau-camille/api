import type { ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { assertOAuthProviderEnabled } from '../../infra/oauth-provider-config';

@Injectable()
export class GithubOAuthGuard extends AuthGuard('github') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    assertOAuthProviderEnabled(this.configService, 'github');

    return super.canActivate(context);
  }

  override getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const redirectTo = request.query.redirectTo;

    return {
      scope: ['user:email'],
      session: false,
      state: typeof redirectTo === 'string' ? redirectTo : undefined,
    };
  }
}
