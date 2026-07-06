import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { err, Result } from '../../../../../common/application/result';
import { UserCreatedEvent } from '../../../../../common/events/user-created.event';
import type { AuthResponse, OAuthIdentity } from '../auth.types';
import {
  InactiveUserError,
  OAuthEmailNotVerifiedError,
  UserNotFoundError,
} from '../errors/auth-app.error';
import { AuthUserRepository } from '../ports/auth-user.repository';
import { OAuthAccountRepository } from '../ports/oauth-account.repository';
import { UserStatus } from '../../domain/enums/user-status.enum';
import { Email } from '../../domain/value-objects/email';
import { RoleKey } from '../../domain/value-objects/role-key';
import { IssueSessionUseCase } from './shared/issue-session.use-case';

const defaultRole = {
  key: RoleKey.create('member'),
  name: 'Member',
  description: 'Default application member role',
} as const;

@Injectable()
export class AuthenticateOAuthUseCase {
  constructor(
    private readonly authUserRepository: AuthUserRepository,
    private readonly oauthAccountRepository: OAuthAccountRepository,
    private readonly issueSessionUseCase: IssueSessionUseCase,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(identity: OAuthIdentity): Promise<
    Result<AuthResponse, InactiveUserError | OAuthEmailNotVerifiedError | UserNotFoundError>
  > {
    if (!identity.emailVerified) {
      return err(new OAuthEmailNotVerifiedError());
    }

    const existingOAuthAccount =
      await this.oauthAccountRepository.findByProviderAccount(
        identity.provider,
        identity.providerUserId,
      );

    if (existingOAuthAccount) {
      return this.issueSessionUseCase.execute(existingOAuthAccount.userId);
    }

    const email = Email.create(identity.email);
    let user = await this.authUserRepository.findByEmail(email);

    if (!user) {
      await this.authUserRepository.ensureRole(defaultRole);
      user = await this.authUserRepository.create({
        email,
        displayName: identity.displayName?.trim() || undefined,
        avatar: identity.avatar,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      });
      await this.authUserRepository.assignRole(user.id, defaultRole.key);
      this.eventEmitter.emit(
        'user.created',
        new UserCreatedEvent(user.id, user.email.toString(), user.displayName),
      );
    }
    else if (!user.emailVerifiedAt) {
      await this.authUserRepository.setEmailVerifiedAt(user.id, new Date());
    }

    await this.oauthAccountRepository.create({
      userId: user.id,
      provider: identity.provider,
      providerUserId: identity.providerUserId,
      email: email.toString(),
    });

    return this.issueSessionUseCase.execute(user.id);
  }
}
