import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { err, Result } from '../../../../../common/application/result';
import { UserCreatedEvent } from '../../../../../common/events/user-created.event';
import { AuthResponse } from '../auth.types';
import {
  EmailLoginCodeExpiredError,
  InactiveUserError,
  InvalidEmailLoginCodeError,
  UserNotFoundError,
} from '../errors/auth-app.error';
import { EmailLoginChallengeRepository } from '../ports/email-login-challenge.repository';
import { TokenHasher } from '../ports/token-hasher';
import { AuthUserRepository } from '../ports/auth-user.repository';
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
export class VerifyEmailAuthUseCase {
  constructor(
    private readonly emailLoginChallengeRepository: EmailLoginChallengeRepository,
    private readonly authUserRepository: AuthUserRepository,
    private readonly tokenHasher: TokenHasher,
    private readonly issueSessionUseCase: IssueSessionUseCase,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: {
    challengeId: string;
    code: string;
  }): Promise<
    Result<
      AuthResponse,
      | EmailLoginCodeExpiredError
      | InactiveUserError
      | InvalidEmailLoginCodeError
      | UserNotFoundError
    >
  > {
    const challenge = await this.emailLoginChallengeRepository.findById(
      input.challengeId,
    );

    if (!challenge || challenge.consumedAt) {
      return err(new InvalidEmailLoginCodeError());
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      return err(new EmailLoginCodeExpiredError());
    }

    if (this.tokenHasher.hash(input.code) !== challenge.codeHash) {
      return err(new InvalidEmailLoginCodeError());
    }

    challenge.consumedAt = new Date();
    await this.emailLoginChallengeRepository.save(challenge);

    const email = Email.create(challenge.email);
    let user = await this.authUserRepository.findByEmail(email);

    if (!user) {
      await this.authUserRepository.ensureRole(defaultRole);
      user = await this.authUserRepository.create({
        email,
        displayName: undefined,
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

    return this.issueSessionUseCase.execute(user.id);
  }
}
