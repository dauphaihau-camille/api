import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';
import { NotificationService } from '~/integrations/notification/notification.service';
import { Email } from '../../domain/value-objects/email';
import { AuthUserRepository } from '../ports/auth-user.repository';
import { PasswordResetTokenRepository } from '../ports/password-reset-token.repository';
import { TokenHasher } from '../ports/token-hasher';

const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_TOKEN_TTL_MS = ms('1h');

@Injectable()
export class RequestPasswordResetUseCase {
  private readonly logger = new Logger(RequestPasswordResetUseCase.name);

  constructor(
    private readonly authUserRepository: AuthUserRepository,
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    private readonly tokenHasher: TokenHasher,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  async execute(emailRaw: string): Promise<void> {
    const email = Email.create(emailRaw);
    const user = await this.authUserRepository.findByEmail(email);

    if (!user) {
      this.logger.log(
        `Password reset requested for unknown email ${email.toString()}`,
      );
      return;
    }

    const rawToken = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

    await this.passwordResetTokenRepository.invalidateActiveTokensForUser(
      user.id,
    );
    await this.passwordResetTokenRepository.create({
      userId: user.id,
      tokenHash: this.tokenHasher.hash(rawToken),
      expiresAt,
    });

    const resetUrl = this.buildResetUrl(rawToken);

    await this.notificationService.send({
      channel: 'email',
      delivery: 'async',
      to: {
        email: user.email.toString(),
        name: user.displayName,
      },
      subject: 'Reset your password',
      text:
        `Hello ${user.displayName ?? user.email.toString()}, ` +
        `reset your password using this link: ${resetUrl}`,
      html:
        `<p>Hello ${user.displayName ?? user.email.toString()},</p>` +
        `<p><a href="${resetUrl}">Reset your password</a></p>`,
      tags: ['password-reset'],
    });

    this.logger.log(
      `Queued password reset email for user ${user.id} (${user.email.toString()})`,
    );
  }

  private buildResetUrl(token: string): string {
    const appBaseUrl = this.configService.get<string>('APP_BASE_URL')?.trim();
    const baseUrl = appBaseUrl?.replace(/\/$/, '');

    if (!baseUrl) {
      throw new Error('APP_BASE_URL must be configured for password reset');
    }

    return `${baseUrl}/reset?t=${encodeURIComponent(token)}`;
  }
}
