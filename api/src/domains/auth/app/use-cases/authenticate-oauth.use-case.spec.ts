import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { UserCreatedEvent } from '~/domains/user/events/user-created.event';
import type { OAuthIdentity } from '../auth.types';
import { UserStatus } from '../../domain/enums/user-status.enum';
import type { UserAccount } from '../../domain/models/user-account';
import { UserAvatarSourceType } from '../../domain/models/user-avatar';
import { Email } from '../../domain/value-objects/email';
import { RoleKey } from '../../domain/value-objects/role-key';
import { OAuthEmailNotVerifiedError } from '../errors/auth-app.error';
import type { AuthUserRepository } from '../ports/auth-user.repository';
import type { OAuthAccountRepository } from '../ports/oauth-account.repository';
import type { IssueSessionUseCase } from './shared/issue-session.use-case';
import { AuthenticateOAuthUseCase } from './authenticate-oauth.use-case';

describe('AuthenticateOAuthUseCase', () => {
  const oauthIdentity: OAuthIdentity = {
    provider: 'google',
    providerUserId: 'google-user-1',
    email: 'member@example.com',
    emailVerified: true,
    displayName: 'Member User',
    avatar: 'https://example.com/avatar.png',
  };

  const existingUser: UserAccount = {
    id: 'user-1',
    version: 1,
    email: Email.create('member@example.com'),
    displayName: 'Member User',
    status: UserStatus.ACTIVE,
    roles: [RoleKey.create('member')],
    permissions: [],
  };

  function buildIssueSessionUseCase() {
    return {
      execute: jest.fn().mockResolvedValue({
        isOk: true,
        value: {
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
        },
      }),
    } as unknown as jest.Mocked<IssueSessionUseCase>;
  }

  it('issues a session for an existing linked oauth account', async () => {
    const authUserRepository = {} as jest.Mocked<AuthUserRepository>;
    const oauthAccountRepository: jest.Mocked<OAuthAccountRepository> = {
      findByProviderAccount: jest.fn().mockResolvedValue({
        id: 'oauth-1',
        userId: 'user-1',
        provider: 'google',
        providerUserId: 'google-user-1',
        email: 'member@example.com',
      }),
      create: jest.fn(),
    };
    const issueSessionUseCase = buildIssueSessionUseCase();
    const eventEmitter = {} as EventEmitter2;
    const useCase = new AuthenticateOAuthUseCase(
      authUserRepository,
      oauthAccountRepository,
      issueSessionUseCase,
      eventEmitter,
    );

    const result = await useCase.execute(oauthIdentity);

    expect(result.isOk).toBe(true);
    expect(issueSessionUseCase.execute).toHaveBeenCalledWith('user-1');
  });

  it('auto-links a verified email to an existing user', async () => {
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
    const oauthAccountRepository: jest.Mocked<OAuthAccountRepository> = {
      findByProviderAccount: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'oauth-1',
        userId: 'user-1',
        provider: 'google',
        providerUserId: 'google-user-1',
        email: 'member@example.com',
      }),
    };
    const issueSessionUseCase = buildIssueSessionUseCase();
    const eventEmitter = {} as EventEmitter2;
    const useCase = new AuthenticateOAuthUseCase(
      authUserRepository,
      oauthAccountRepository,
      issueSessionUseCase,
      eventEmitter,
    );

    const result = await useCase.execute(oauthIdentity);

    expect(result.isOk).toBe(true);
    expect(oauthAccountRepository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      provider: 'google',
      providerUserId: 'google-user-1',
      email: 'member@example.com',
    });
  });

  it('creates a member user for a new verified oauth identity', async () => {
    const createdUser: UserAccount = {
      ...existingUser,
      id: 'user-2',
      email: Email.create('new@example.com'),
      avatarSourceType: UserAvatarSourceType.EXTERNAL,
      avatarSourceUrl: 'https://example.com/avatar.png',
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
    const oauthAccountRepository: jest.Mocked<OAuthAccountRepository> = {
      findByProviderAccount: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'oauth-1',
        userId: 'user-2',
        provider: 'google',
        providerUserId: 'google-user-1',
        email: 'new@example.com',
      }),
    };
    const issueSessionUseCase = buildIssueSessionUseCase();
    const eventEmitter: Pick<jest.Mocked<EventEmitter2>, 'emit'> = {
      emit: jest.fn(),
    };
    const useCase = new AuthenticateOAuthUseCase(
      authUserRepository,
      oauthAccountRepository,
      issueSessionUseCase,
      eventEmitter as unknown as EventEmitter2,
    );

    const result = await useCase.execute({
      ...oauthIdentity,
      email: 'new@example.com',
    });

    expect(result.isOk).toBe(true);
    expect(authUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarSourceType: UserAvatarSourceType.EXTERNAL,
        avatarSourceUrl: 'https://example.com/avatar.png',
        displayName: 'Member User',
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

  it('rejects an unverified oauth email', async () => {
    const authUserRepository = {} as jest.Mocked<AuthUserRepository>;
    const oauthAccountRepository = {} as jest.Mocked<OAuthAccountRepository>;
    const issueSessionUseCase = {} as jest.Mocked<IssueSessionUseCase>;
    const eventEmitter = {} as EventEmitter2;
    const useCase = new AuthenticateOAuthUseCase(
      authUserRepository,
      oauthAccountRepository,
      issueSessionUseCase,
      eventEmitter,
    );

    const result = await useCase.execute({
      ...oauthIdentity,
      emailVerified: false,
    });

    expect(result.isOk).toBe(false);
    if (result.isOk) {
      throw new Error('Expected oauth authentication to fail');
    }
    expect(result.error).toBeInstanceOf(OAuthEmailNotVerifiedError);
  });
});
