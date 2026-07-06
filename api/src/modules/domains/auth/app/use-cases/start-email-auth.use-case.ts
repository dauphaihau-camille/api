import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { parseDurationToMilliseconds } from '~/libs/duration';
import { NotificationService } from '~/modules/shared/notification/notification.service';
import type { EmailAuthIntent } from '../auth.types';
import { Email } from '../../domain/value-objects/email';
import { EmailLoginChallengeRepository } from '../ports/email-login-challenge.repository';
import { TokenHasher } from '../ports/token-hasher';

const EMAIL_LOGIN_CODE_TTL_MS = parseDurationToMilliseconds('10m', 600_000);
const EMAIL_LOGIN_CODE_LENGTH = 6;

export interface StartEmailAuthResult {
  challengeId: string;
  expiresInSeconds: number;
}

@Injectable()
export class StartEmailAuthUseCase {
  constructor(
    private readonly emailLoginChallengeRepository: EmailLoginChallengeRepository,
    private readonly tokenHasher: TokenHasher,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(input: {
    email: string;
    intent?: EmailAuthIntent;
  }): Promise<StartEmailAuthResult> {
    const intent = input.intent ?? 'login';
    const emailRaw = input.email;
    const email = Email.create(emailRaw);
    const code = generateEmailLoginCode();
    const expiresAt = new Date(Date.now() + EMAIL_LOGIN_CODE_TTL_MS);

    await this.emailLoginChallengeRepository.invalidateActiveChallengesForEmail(
      email.toString(),
    );

    const challenge = await this.emailLoginChallengeRepository.create({
      email: email.toString(),
      codeHash: this.tokenHasher.hash(code),
      expiresAt,
    });

    await this.notificationService.send({
      channel: 'email',
      delivery: 'async',
      to: {
        email: email.toString(),
      },
      subject: intent === 'signup' ? 'Your Camille sign-up code' : 'Your Camille sign-in code',
      text: `Use this code to ${intent === 'signup' ? 'create your Camille account' : 'sign in to Camille'}: ${code}`,
      html: `<p>Use this code to ${intent === 'signup' ? 'create your Camille account' : 'sign in to Camille'}:</p><p><strong>${code}</strong></p>`,
      tags: ['auth-login-code'],
    });

    return {
      challengeId: challenge.id,
      expiresInSeconds: Math.floor(EMAIL_LOGIN_CODE_TTL_MS / 1000),
    };
  }
}

function generateEmailLoginCode(): string {
  return randomInt(0, 10 ** EMAIL_LOGIN_CODE_LENGTH)
    .toString()
    .padStart(EMAIL_LOGIN_CODE_LENGTH, '0');
}
