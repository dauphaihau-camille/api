import type { NotificationService } from '~/modules/shared/notification/notification.service';
import type { EmailLoginChallengeRepository } from '../ports/email-login-challenge.repository';
import type { TokenHasher } from '../ports/token-hasher';
import { StartEmailAuthUseCase } from './start-email-auth.use-case';

describe('StartEmailAuthUseCase', () => {
  it('creates a challenge, invalidates older challenges, and sends a code email', async () => {
    const emailLoginChallengeRepository: jest.Mocked<EmailLoginChallengeRepository> = {
      create: jest.fn().mockResolvedValue({
        id: 'challenge-1',
        email: 'member@example.com',
        codeHash: 'hashed-code',
        expiresAt: new Date(Date.now() + 600_000),
      }),
      findById: jest.fn(),
      save: jest.fn(),
      invalidateActiveChallengesForEmail: jest.fn().mockResolvedValue(undefined),
    };
    const tokenHasher: jest.Mocked<TokenHasher> = {
      hash: jest.fn().mockReturnValue('hashed-code'),
    };
    const notificationService: Pick<
      jest.Mocked<NotificationService>,
      'send'
    > = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new StartEmailAuthUseCase(
      emailLoginChallengeRepository,
      tokenHasher,
      notificationService as unknown as NotificationService,
    );

    const result = await useCase.execute({
      email: 'member@example.com',
    });

    expect(result).toEqual({
      challengeId: 'challenge-1',
      expiresInSeconds: 600,
    });
    expect(
      emailLoginChallengeRepository.invalidateActiveChallengesForEmail,
    ).toHaveBeenCalledWith('member@example.com');
    expect(emailLoginChallengeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'member@example.com',
        codeHash: 'hashed-code',
        expiresAt: expect.any(Date),
      }),
    );
    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'email',
        to: {
          email: 'member@example.com',
        },
        subject: 'Your Camille sign-in code',
        tags: ['auth-login-code'],
      }),
    );
    expect(tokenHasher.hash).toHaveBeenCalledWith(expect.stringMatching(/^\d{6}$/));
  });

  it('uses sign-up copy when the auth intent is signup', async () => {
    const emailLoginChallengeRepository: jest.Mocked<EmailLoginChallengeRepository> = {
      create: jest.fn().mockResolvedValue({
        id: 'challenge-1',
        email: 'member@example.com',
        codeHash: 'hashed-code',
        expiresAt: new Date(Date.now() + 600_000),
      }),
      findById: jest.fn(),
      save: jest.fn(),
      invalidateActiveChallengesForEmail: jest.fn().mockResolvedValue(undefined),
    };
    const tokenHasher: jest.Mocked<TokenHasher> = {
      hash: jest.fn().mockReturnValue('hashed-code'),
    };
    const notificationService: Pick<
      jest.Mocked<NotificationService>,
      'send'
    > = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new StartEmailAuthUseCase(
      emailLoginChallengeRepository,
      tokenHasher,
      notificationService as unknown as NotificationService,
    );

    await useCase.execute({
      email: 'member@example.com',
      intent: 'signup',
    });

    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Your Camille sign-up code',
      }),
    );
  });
});
