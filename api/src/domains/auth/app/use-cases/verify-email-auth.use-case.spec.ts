import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { UserCreatedEvent } from '~/domains/user/events/user-created.event';
import { UserStatus } from '../../domain/enums/user-status.enum';
import type { UserAccount } from '../../domain/models/user-account';
import { Email } from '../../domain/value-objects/email';
import { RoleKey } from '../../domain/value-objects/role-key';
import {
  EmailAuthAccountNotFoundError,
  EmailAlreadyRegisteredError,
  EmailLoginCodeExpiredError,
  InvalidEmailLoginCodeError,
} from '../errors/auth-app.error';
import type { AuthUserRepository } from '../ports/auth-user.repository';
import type { EmailLoginChallengeRepository } from '../ports/email-login-challenge.repository';
import type { TokenHasher } from '../ports/token-hasher';
import { VerifyEmailAuthUseCase } from './verify-email-auth.use-case';
import type { IssueSessionUseCase } from './shared/issue-session.use-case';

describe('VerifyEmailAuthUseCase', () => {
  const existingUser: UserAccount = {
    id: 'user-1',
    version: 1,
    email: Email.create('member@example.com'),
    displayName: 'Member User',
    status: UserStatus.ACTIVE,
    roles: [RoleKey.create('member')],
    permissions: [],
  };

  const authResponse = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: {
      id: 'user-1',
      email: 'member@example.com',
      displayName: 'Member User',
      status: UserStatus.ACTIVE,
      sessionId: 'session-1',
      roles: ['member'],
      permissions: [],
    },
  };

  function buildIssueSessionUseCase() {
    return {
      execute: jest.fn().mockResolvedValue({
        isOk: true,
        value: authResponse,
      }),
    } as unknown as jest.Mocked<IssueSessionUseCase>;
  }

  it('consumes a valid challenge and issues a session for an existing user', async () => {
    const emailLoginChallengeRepository: jest.Mocked<EmailLoginChallengeRepository> = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue({
        id: 'challenge-1',
        email: 'member@example.com',
        codeHash: 'hashed-code',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      save: jest.fn().mockResolvedValue(undefined),
      invalidateActiveChallengesForEmail: jest.fn(),
    };
    const authUserRepository: jest.Mocked<AuthUserRepository> = {
      findByEmail: jest.fn().mockResolvedValue(existingUser),
      findLoginByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updatePassword: jest.fn(),
      setEmailVerifiedAt: jest.fn().mockResolvedValue(undefined),
      assignRole: jest.fn(),
      ensureRole: jest.fn(),
    };
    const tokenHasher: jest.Mocked<TokenHasher> = {
      hash: jest.fn().mockReturnValue('hashed-code'),
    };
    const issueSessionUseCase = buildIssueSessionUseCase();
    const eventEmitter: Pick<jest.Mocked<EventEmitter2>, 'emit'> = {
      emit: jest.fn(),
    };
    const useCase = new VerifyEmailAuthUseCase(
      emailLoginChallengeRepository,
      authUserRepository,
      tokenHasher,
      issueSessionUseCase,
      eventEmitter as unknown as EventEmitter2,
    );

    const result = await useCase.execute({
      challengeId: 'challenge-1',
      code: '123456',
      intent: 'login',
    });

    expect(result.isOk).toBe(true);
    expect(emailLoginChallengeRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'challenge-1',
        consumedAt: expect.any(Date),
      }),
    );
    expect(authUserRepository.setEmailVerifiedAt).toHaveBeenCalledWith(
      'user-1',
      expect.any(Date),
    );
    expect(issueSessionUseCase.execute).toHaveBeenCalledWith('user-1');
  });

  it('creates a member user when the verified email is new', async () => {
    const emailLoginChallengeRepository: jest.Mocked<EmailLoginChallengeRepository> = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue({
        id: 'challenge-1',
        email: 'new@example.com',
        codeHash: 'hashed-code',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      save: jest.fn().mockResolvedValue(undefined),
      invalidateActiveChallengesForEmail: jest.fn(),
    };
    const createdUser: UserAccount = {
      ...existingUser,
      id: 'user-2',
      email: Email.create('new@example.com'),
      displayName: undefined,
      emailVerifiedAt: new Date(),
    };
    const authUserRepository: jest.Mocked<AuthUserRepository> = {
      findByEmail: jest.fn().mockResolvedValue(null),
      findLoginByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn().mockResolvedValue(createdUser),
      update: jest.fn(),
      updatePassword: jest.fn(),
      setEmailVerifiedAt: jest.fn(),
      assignRole: jest.fn().mockResolvedValue(undefined),
      ensureRole: jest.fn().mockResolvedValue(undefined),
    };
    const tokenHasher: jest.Mocked<TokenHasher> = {
      hash: jest.fn().mockReturnValue('hashed-code'),
    };
    const issueSessionUseCase = buildIssueSessionUseCase();
    const eventEmitter: Pick<jest.Mocked<EventEmitter2>, 'emit'> = {
      emit: jest.fn(),
    };
    const useCase = new VerifyEmailAuthUseCase(
      emailLoginChallengeRepository,
      authUserRepository,
      tokenHasher,
      issueSessionUseCase,
      eventEmitter as unknown as EventEmitter2,
    );

    const result = await useCase.execute({
      challengeId: 'challenge-1',
      code: '123456',
      intent: 'signup',
      displayName: 'New User',
    });

    expect(result.isOk).toBe(true);
    expect(authUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: expect.objectContaining({
          toString: expect.any(Function),
        }),
        displayName: 'New User',
        emailVerifiedAt: expect.any(Date),
      }),
    );
    expect(authUserRepository.assignRole).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({
        toString: expect.any(Function),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'user.created',
      expect.objectContaining<UserCreatedEvent>({
        userId: 'user-2',
        email: 'new@example.com',
      }),
    );
  });

  it('rejects an invalid login code', async () => {
    const emailLoginChallengeRepository: jest.Mocked<EmailLoginChallengeRepository> = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue({
        id: 'challenge-1',
        email: 'member@example.com',
        codeHash: 'hashed-code',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      save: jest.fn(),
      invalidateActiveChallengesForEmail: jest.fn(),
    };
    const authUserRepository = {} as jest.Mocked<AuthUserRepository>;
    const tokenHasher: jest.Mocked<TokenHasher> = {
      hash: jest.fn().mockReturnValue('different-hash'),
    };
    const issueSessionUseCase = {} as jest.Mocked<IssueSessionUseCase>;
    const eventEmitter = {} as EventEmitter2;
    const useCase = new VerifyEmailAuthUseCase(
      emailLoginChallengeRepository,
      authUserRepository,
      tokenHasher,
      issueSessionUseCase,
      eventEmitter,
    );

    const result = await useCase.execute({
      challengeId: 'challenge-1',
      code: '123456',
    });

    expect(result.isOk).toBe(false);
    if (result.isOk) {
      throw new Error('Expected verification to fail');
    }
    expect(result.error).toBeInstanceOf(InvalidEmailLoginCodeError);
  });

  it('rejects login intent when the verified email does not have an account yet', async () => {
    const emailLoginChallengeRepository: jest.Mocked<EmailLoginChallengeRepository> = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue({
        id: 'challenge-1',
        email: 'new@example.com',
        codeHash: 'hashed-code',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      save: jest.fn().mockResolvedValue(undefined),
      invalidateActiveChallengesForEmail: jest.fn(),
    };
    const authUserRepository: jest.Mocked<AuthUserRepository> = {
      findByEmail: jest.fn().mockResolvedValue(null),
      findLoginByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updatePassword: jest.fn(),
      setEmailVerifiedAt: jest.fn(),
      assignRole: jest.fn(),
      ensureRole: jest.fn(),
    };
    const tokenHasher: jest.Mocked<TokenHasher> = {
      hash: jest.fn().mockReturnValue('hashed-code'),
    };
    const issueSessionUseCase = buildIssueSessionUseCase();
    const eventEmitter = { emit: jest.fn() } as unknown as EventEmitter2;
    const useCase = new VerifyEmailAuthUseCase(
      emailLoginChallengeRepository,
      authUserRepository,
      tokenHasher,
      issueSessionUseCase,
      eventEmitter,
    );

    const result = await useCase.execute({
      challengeId: 'challenge-1',
      code: '123456',
      intent: 'login',
    });

    expect(result.isOk).toBe(false);
    if (result.isOk) {
      throw new Error('Expected verification to fail');
    }
    expect(result.error).toBeInstanceOf(EmailAuthAccountNotFoundError);
    expect(authUserRepository.create).not.toHaveBeenCalled();
  });

  it('rejects signup intent when the email already belongs to an account', async () => {
    const emailLoginChallengeRepository: jest.Mocked<EmailLoginChallengeRepository> = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue({
        id: 'challenge-1',
        email: 'member@example.com',
        codeHash: 'hashed-code',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      save: jest.fn().mockResolvedValue(undefined),
      invalidateActiveChallengesForEmail: jest.fn(),
    };
    const authUserRepository: jest.Mocked<AuthUserRepository> = {
      findByEmail: jest.fn().mockResolvedValue(existingUser),
      findLoginByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updatePassword: jest.fn(),
      setEmailVerifiedAt: jest.fn(),
      assignRole: jest.fn(),
      ensureRole: jest.fn(),
    };
    const tokenHasher: jest.Mocked<TokenHasher> = {
      hash: jest.fn().mockReturnValue('hashed-code'),
    };
    const issueSessionUseCase = buildIssueSessionUseCase();
    const eventEmitter = { emit: jest.fn() } as unknown as EventEmitter2;
    const useCase = new VerifyEmailAuthUseCase(
      emailLoginChallengeRepository,
      authUserRepository,
      tokenHasher,
      issueSessionUseCase,
      eventEmitter,
    );

    const result = await useCase.execute({
      challengeId: 'challenge-1',
      code: '123456',
      intent: 'signup',
      displayName: 'Existing Member',
    });

    expect(result.isOk).toBe(false);
    if (result.isOk) {
      throw new Error('Expected verification to fail');
    }
    expect(result.error).toBeInstanceOf(EmailAlreadyRegisteredError);
    expect(issueSessionUseCase.execute).not.toHaveBeenCalled();
  });

  it('rejects an expired login code', async () => {
    const emailLoginChallengeRepository: jest.Mocked<EmailLoginChallengeRepository> = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue({
        id: 'challenge-1',
        email: 'member@example.com',
        codeHash: 'hashed-code',
        expiresAt: new Date(Date.now() - 1_000),
      }),
      save: jest.fn(),
      invalidateActiveChallengesForEmail: jest.fn(),
    };
    const authUserRepository = {} as jest.Mocked<AuthUserRepository>;
    const tokenHasher: jest.Mocked<TokenHasher> = {
      hash: jest.fn().mockReturnValue('hashed-code'),
    };
    const issueSessionUseCase = {} as jest.Mocked<IssueSessionUseCase>;
    const eventEmitter = {} as EventEmitter2;
    const useCase = new VerifyEmailAuthUseCase(
      emailLoginChallengeRepository,
      authUserRepository,
      tokenHasher,
      issueSessionUseCase,
      eventEmitter,
    );

    const result = await useCase.execute({
      challengeId: 'challenge-1',
      code: '123456',
    });

    expect(result.isOk).toBe(false);
    if (result.isOk) {
      throw new Error('Expected verification to fail');
    }
    expect(result.error).toBeInstanceOf(EmailLoginCodeExpiredError);
  });
});
