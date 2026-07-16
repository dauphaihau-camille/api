import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import type { OAuthIdentity } from '../app/auth.types';
import type { EnabledOAuthProviderConfig } from './oauth-provider-config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(oauthProviderConfig: EnabledOAuthProviderConfig) {
    super({
      clientID: oauthProviderConfig.clientId,
      clientSecret: oauthProviderConfig.clientSecret,
      callbackURL: oauthProviderConfig.callbackUrl,
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
