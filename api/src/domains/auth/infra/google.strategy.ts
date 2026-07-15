import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import type { OAuthIdentity } from '../app/auth.types';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_OAUTH_CLIENT_ID', ''),
      clientSecret: configService.get<string>('GOOGLE_OAUTH_CLIENT_SECRET', ''),
      callbackURL: buildOAuthCallbackUrl(configService, 'google'),
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.find((candidate) => candidate.verified !== false);

    if (!email?.value) {
      done(new UnauthorizedException('Google account did not provide an email'), false);
      return;
    }

    const identity: OAuthIdentity = {
      provider: 'google',
      providerUserId: profile.id,
      email: email.value,
      emailVerified: email.verified !== false,
      displayName: profile.displayName || undefined,
      avatar: profile.photos?.[0]?.value,
    };

    done(null, identity);
  }
}

function buildOAuthCallbackUrl(
  configService: Pick<ConfigService, 'get'>,
  provider: 'google' | 'github',
): string {
  const apiBaseUrl = configService
    .get<string>('API_BASE_URL', DEFAULT_API_BASE_URL)
    .replace(/\/+$/, '');

  return `${apiBaseUrl}/v1/auth/oauth/${provider}/callback`;
}
