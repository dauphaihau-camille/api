import { NotFoundException } from '@nestjs/common';
import {
  assertOAuthProviderEnabled,
  buildOAuthProviderConfig,
  buildOAuthProviderConfigs,
} from './oauth-provider-config';

type MockConfigService = {
  get: (key: string) => string | undefined;
};

function createConfigService(values: Record<string, string | undefined>): MockConfigService {
  return {
    get: (key: string) => values[key],
  };
}

describe('oauth-provider-config', () => {
  it('keeps google oauth disabled when credentials are missing', () => {
    expect(
      buildOAuthProviderConfig(
        createConfigService({
          GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
        }),
        'google',
      ),
    ).toEqual({
      enabled: false,
      provider: 'google',
      displayName: 'Google',
    });
  });

  it('builds github oauth config when credentials are present', () => {
    expect(
      buildOAuthProviderConfig(
        createConfigService({
          API_BASE_URL: 'https://api.example.com/',
          GITHUB_OAUTH_CLIENT_ID: 'github-client-id',
          GITHUB_OAUTH_CLIENT_SECRET: 'github-client-secret',
        }),
        'github',
      ),
    ).toEqual({
      enabled: true,
      provider: 'github',
      displayName: 'GitHub',
      clientId: 'github-client-id',
      clientSecret: 'github-client-secret',
      callbackUrl: 'https://api.example.com/v1/auth/oauth/github/callback',
    });
  });

  it('throws a not found error when github oauth is disabled', () => {
    expect(() =>
      assertOAuthProviderEnabled(
        buildOAuthProviderConfigs(createConfigService({})),
        'github',
      )).toThrow(new NotFoundException('GitHub OAuth is not enabled.'));
  });
});
