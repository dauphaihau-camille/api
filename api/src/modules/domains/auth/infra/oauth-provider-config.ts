import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { OAuthProvider } from '../app/auth.types';

const oauthProviderConfigKeys = {
  google: {
    clientId: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecret: 'GOOGLE_OAUTH_CLIENT_SECRET',
    displayName: 'Google',
  },
  github: {
    clientId: 'GITHUB_OAUTH_CLIENT_ID',
    clientSecret: 'GITHUB_OAUTH_CLIENT_SECRET',
    displayName: 'GitHub',
  },
} as const satisfies Record<
  OAuthProvider,
  {
    clientId: string;
    clientSecret: string;
    displayName: string;
  }
>;

export function isOAuthProviderEnabled(
  configService: Pick<ConfigService, 'get'>,
  provider: OAuthProvider,
): boolean {
  const configKeys = oauthProviderConfigKeys[provider];

  return Boolean(
    configService.get<string>(configKeys.clientId)
    && configService.get<string>(configKeys.clientSecret),
  );
}

export function assertOAuthProviderEnabled(
  configService: Pick<ConfigService, 'get'>,
  provider: OAuthProvider,
): void {
  if (!isOAuthProviderEnabled(configService, provider)) {
    throw new NotFoundException(
      `${oauthProviderConfigKeys[provider].displayName} OAuth is not enabled.`,
    );
  }
}
