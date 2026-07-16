import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { OAuthProvider } from '../app/auth.types';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

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

export type DisabledOAuthProviderConfig = {
  enabled: false;
  provider: OAuthProvider;
  displayName: string;
};

export type EnabledOAuthProviderConfig = {
  enabled: true;
  provider: OAuthProvider;
  displayName: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
};

export type OAuthProviderConfig =
  | DisabledOAuthProviderConfig
  | EnabledOAuthProviderConfig;

export type OAuthProviderConfigs = Record<OAuthProvider, OAuthProviderConfig>;

export const OAUTH_PROVIDER_CONFIGS = Symbol('OAUTH_PROVIDER_CONFIGS');

function isOAuthProviderEnabled(
  configService: Pick<ConfigService, 'get'>,
  provider: OAuthProvider,
): boolean {
  const configKeys = oauthProviderConfigKeys[provider];

  return Boolean(
    configService.get<string>(configKeys.clientId)
    && configService.get<string>(configKeys.clientSecret),
  );
}

export function buildOAuthProviderConfig(
  configService: Pick<ConfigService, 'get'>,
  provider: OAuthProvider,
): OAuthProviderConfig {
  const configKeys = oauthProviderConfigKeys[provider];

  if (!isOAuthProviderEnabled(configService, provider)) {
    return {
      enabled: false,
      provider,
      displayName: configKeys.displayName,
    };
  }

  const apiBaseUrl = configService
    .get<string>('API_BASE_URL', DEFAULT_API_BASE_URL)
    .replace(/\/+$/, '');

  return {
    enabled: true,
    provider,
    displayName: configKeys.displayName,
    clientId: configService.get<string>(configKeys.clientId, ''),
    clientSecret: configService.get<string>(configKeys.clientSecret, ''),
    callbackUrl: `${apiBaseUrl}/v1/auth/oauth/${provider}/callback`,
  };
}

export function buildOAuthProviderConfigs(
  configService: Pick<ConfigService, 'get'>,
): OAuthProviderConfigs {
  return {
    google: buildOAuthProviderConfig(configService, 'google'),
    github: buildOAuthProviderConfig(configService, 'github'),
  };
}

export function assertOAuthProviderEnabled(
  oauthProviderConfigs: OAuthProviderConfigs,
  provider: OAuthProvider,
): EnabledOAuthProviderConfig {
  const providerConfig = oauthProviderConfigs[provider];

  if (!providerConfig.enabled) {
    throw new NotFoundException(`${providerConfig.displayName} OAuth is not enabled.`);
  }

  return providerConfig;
}
