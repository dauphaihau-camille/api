import { Inject, Injectable } from '@nestjs/common';
import { AUTH_CONFIG } from '../../../platform/config/auth.config';
import type { AuthConfig } from '../../../platform/config/auth.config';
import { PasswordResetLinkBuilder } from '../app/ports/password-reset-link-builder';

@Injectable()
export class AuthPasswordResetLinkBuilder implements PasswordResetLinkBuilder {
  constructor(
    @Inject(AUTH_CONFIG) private readonly authConfig: AuthConfig,
  ) {}

  build(token: string): string {
    return `${this.authConfig.appBaseUrl}/reset?t=${encodeURIComponent(token)}`;
  }
}
