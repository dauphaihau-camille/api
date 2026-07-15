import { NotFoundException } from '@nestjs/common';
import { assertOAuthProviderEnabled, isOAuthProviderEnabled } from './oauth-provider-config';

type MockConfigService = {
  get: (key: string) => string | undefined;
};

function createConfigService(values: Record<string, string | undefined>): MockConfigService {
  return {
    get: (key: string) => values[key],
  };
}

describe('oauth-provider-config', () => {
  it('enables google oauth only when both credentials are present', () => {
    expect(
      isOAuthProviderEnabled(
        createConfigService({
          GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
          GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
        }),
        'google',
      ),
    ).toBe(true);

    expect(
      isOAuthProviderEnabled(
        createConfigService({
          GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
        }),
        'google',
      ),
    ).toBe(false);
  });

  it('throws a not found error when github oauth is disabled', () => {
    expect(() =>
      assertOAuthProviderEnabled(
        createConfigService({}),
        'github',
      )).toThrow(new NotFoundException('GitHub OAuth is not enabled.'));
  });
});
