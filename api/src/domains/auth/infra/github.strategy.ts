import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { fetchWithTimeout } from '~/platform/http/fetch-with-timeout';
import { Strategy, type Profile } from 'passport-github2';
import type { OAuthIdentity } from '../app/auth.types';
import type { EnabledOAuthProviderConfig } from './oauth-provider-config';

const GITHUB_EMAIL_REQUEST_TIMEOUT_MS = 5_000;

interface GithubEmailRecord {
  email: string;
  primary: boolean;
  verified: boolean;
}

type OAuthVerifyCallback = (error: Error | null, user?: OAuthIdentity | false) => void;

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(oauthProviderConfig: EnabledOAuthProviderConfig) {
    super({
      clientID: oauthProviderConfig.clientId,
      clientSecret: oauthProviderConfig.clientSecret,
      callbackURL: oauthProviderConfig.callbackUrl,
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: OAuthVerifyCallback,
  ): Promise<void> {
    try {
      const email = await loadVerifiedGithubEmail(accessToken);

      if (!email) {
        done(new UnauthorizedException('GitHub account did not provide a verified email'), false);
        return;
      }

      const identity: OAuthIdentity = {
        provider: 'github',
        providerUserId: profile.id,
        email,
        emailVerified: true,
        displayName: profile.displayName || profile.username || undefined,
        avatar: profile.photos?.[0]?.value,
      };

      done(null, identity);
    }
    catch (error) {
      done(
        error instanceof Error
          ? error
          : new UnauthorizedException('Failed to load GitHub account email'),
        false,
      );
    }
  }
}

async function loadVerifiedGithubEmail(accessToken: string): Promise<string | null> {
  const response = await fetchWithTimeout('https://api.github.com/user/emails', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'camille-auth',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    timeoutMs: GITHUB_EMAIL_REQUEST_TIMEOUT_MS,
  });

  if (!response.ok) {
    throw new UnauthorizedException('Failed to load GitHub account email');
  }

  const emails = await response.json() as GithubEmailRecord[];
  const verifiedEmail = emails.find((email) => email.primary && email.verified) ??
    emails.find((email) => email.verified);

  return verifiedEmail?.email ?? null;
}
