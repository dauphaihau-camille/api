import type { ExecutionContext } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import {
  assertOAuthProviderEnabled,
  OAUTH_PROVIDER_CONFIGS,
  type OAuthProviderConfigs,
} from '../../infra/oauth-provider-config';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(
    @Inject(OAUTH_PROVIDER_CONFIGS)
    private readonly oauthProviderConfigs: OAuthProviderConfigs,
  ) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    assertOAuthProviderEnabled(this.oauthProviderConfigs, 'google');

    return super.canActivate(context);
  }

  override getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const redirectTo = request.query.redirectTo;

    return {
      scope: ['email', 'profile'],
      session: false,
      state: typeof redirectTo === 'string' ? redirectTo : undefined,
    };
  }
}
