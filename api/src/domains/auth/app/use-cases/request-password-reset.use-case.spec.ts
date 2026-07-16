import type { NotificationService } from '~/integrations/notification/notification.service';
import type { AuthUserRepository } from '../ports/auth-user.repository';
import type { PasswordResetLinkBuilder } from '../ports/password-reset-link-builder';
import type { PasswordResetTokenRepository } from '../ports/password-reset-token.repository';
import type { TokenHasher } from '../ports/token-hasher';
import { UserStatus } from '../../domain/enums/user-status.enum';
import { Email } from '../../domain/value-objects/email';
import { RoleKey } from '../../domain/value-objects/role-key';
import { RequestPasswordResetUseCase } from './request-password-reset.use-case';

describe('RequestPasswordResetUseCase', () => {
  it('creates a reset token and queues an email when the user exists', async () => {
    const authUserRepository: jest.Mocked<AuthUserRepository> = {
      findByEmail: jest.fn().mockResolvedValue({
        id: 'user-1',
        version: 1,
        email: Email.create('member@example.com'),
        displayName: 'Member User',
        status: UserStatus.ACTIVE,
        roles: [RoleKey.create('member')],
        permissions: [],
      }),
      findLoginByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updatePassword: jest.fn(),
      setEmailVerifiedAt: jest.fn(),
      assignRole: jest.fn(),
      ensureRole: jest.fn(),
    };
    const passwordResetTokenRepository: jest.Mocked<PasswordResetTokenRepository> = {
      create: jest.fn().mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date('2026-01-01T01:00:00.000Z'),
      }),
      findByTokenHash: jest.fn(),
      save: jest.fn(),
      invalidateActiveTokensForUser: jest.fn().mockResolvedValue(undefined),
    };
    const tokenHasher: jest.Mocked<TokenHasher> = {
      hash: jest.fn().mockReturnValue('hashed-token'),
    };
    const notificationService = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    const passwordResetLinkBuilder: jest.Mocked<PasswordResetLinkBuilder> = {
      build: jest.fn().mockReturnValue('http://localhost:4000/reset?t=raw-token'),
    };
    const useCase = new RequestPasswordResetUseCase(
      authUserRepository,
      passwordResetTokenRepository,
      tokenHasher,
      notificationService as unknown as NotificationService,
      passwordResetLinkBuilder,
    );

    await useCase.execute('member@example.com');

    expect(passwordResetTokenRepository.invalidateActiveTokensForUser).toHaveBeenCalledWith(
      'user-1',
    );
    expect(passwordResetTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: expect.any(Date),
      }),
    );
    expect(passwordResetLinkBuilder.build).toHaveBeenCalledWith(expect.any(String));
    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'email',
        delivery: 'async',
        subject: 'Reset your password',
        text: expect.stringContaining('http://localhost:4000/reset?t=raw-token'),
        html: expect.stringContaining('http://localhost:4000/reset?t=raw-token'),
      }),
    );
  });

  it('returns silently when the email is not registered', async () => {
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
    const passwordResetTokenRepository: jest.Mocked<PasswordResetTokenRepository> = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      save: jest.fn(),
      invalidateActiveTokensForUser: jest.fn(),
    };
    const tokenHasher: jest.Mocked<TokenHasher> = {
      hash: jest.fn(),
    };
    const notificationService = {
      send: jest.fn(),
    };
    const passwordResetLinkBuilder: jest.Mocked<PasswordResetLinkBuilder> = {
      build: jest.fn(),
    };
    const useCase = new RequestPasswordResetUseCase(
      authUserRepository,
      passwordResetTokenRepository,
      tokenHasher,
      notificationService as unknown as NotificationService,
      passwordResetLinkBuilder,
    );

    await useCase.execute('missing@example.com');

    expect(passwordResetTokenRepository.create).not.toHaveBeenCalled();
    expect(passwordResetLinkBuilder.build).not.toHaveBeenCalled();
    expect(notificationService.send).not.toHaveBeenCalled();
  });
});
