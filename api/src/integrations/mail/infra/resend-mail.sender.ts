import { Inject, Injectable, Logger } from '@nestjs/common';
import { MAIL_CONFIG } from '~/platform/config/mail.config';
import type { MailConfig } from '~/platform/config/mail.config';
import { fetchWithTimeout } from '~/platform/http/fetch-with-timeout';
import { MailSender } from '../app/ports/mail-sender';
import { MailAddress, SendMailInput } from '../app/mail.types';

interface ResendSendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  reply_to?: string[];
  cc?: string[];
  bcc?: string[];
  tags?: Array<{ name: string; value: string }>;
}

const RESEND_REQUEST_TIMEOUT_MS = 5_000;
const RESERVED_TEST_DOMAINS = new Set(['example.com', 'example.org', 'example.net']);

@Injectable()
export class ResendMailSender implements MailSender {
  private readonly logger = new Logger(ResendMailSender.name);

  constructor(@Inject(MAIL_CONFIG) private readonly mailConfig: MailConfig) {}

  async send(input: SendMailInput): Promise<void> {
    const payload = this.buildPayload(input);

    if (this.shouldLogInsteadOfSending(input)) {
      this.logger.warn(
        `Skipping Resend delivery for reserved test recipient domain in non-production runtime: ${JSON.stringify(payload)}`,
      );
      return;
    }

    const response = await fetchWithTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.mailConfig.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      timeoutMs: RESEND_REQUEST_TIMEOUT_MS,
    });

    if (response.ok) {
      return;
    }

    const responseBody = await response.text();

    throw new Error(
      `Resend mail request failed for from=${payload.from} with status ${response.status}: ${responseBody}`,
    );
  }

  private buildPayload(input: SendMailInput): ResendSendEmailPayload {
    return {
      from: this.formatAddress(input.from ?? this.mailConfig.defaultFrom),
      to: this.formatRequiredAddresses(input.to),
      cc: this.formatAddresses(input.cc),
      bcc: this.formatAddresses(input.bcc),
      reply_to: this.formatAddresses(input.replyTo),
      subject: input.subject,
      text: input.text,
      html: input.html,
      tags: input.tags?.map((tag) => ({
        name: 'tag',
        value: tag,
      })),
    };
  }

  private formatAddresses(
    value?: MailAddress | MailAddress[],
  ): string[] | undefined {
    if (!value) {
      return undefined;
    }

    const addresses = Array.isArray(value) ? value : [value];
    return addresses.map((address) => this.formatAddress(address));
  }

  private formatRequiredAddresses(value: MailAddress | MailAddress[]): string[] {
    const formattedAddresses = this.formatAddresses(value);

    if (!formattedAddresses || formattedAddresses.length === 0) {
      throw new Error('At least one recipient is required to send mail.');
    }

    return formattedAddresses;
  }

  private formatAddress(address: MailAddress): string {
    return address.name ? `${address.name} <${address.email}>` : address.email;
  }

  private shouldLogInsteadOfSending(input: SendMailInput): boolean {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }

    const recipients = [
      ...this.toAddressArray(input.to),
      ...this.toAddressArray(input.cc),
      ...this.toAddressArray(input.bcc),
      ...this.toAddressArray(input.replyTo),
    ];

    return recipients.some((recipient) => this.isReservedTestDomain(recipient.email));
  }

  private toAddressArray(
    value?: MailAddress | MailAddress[],
  ): MailAddress[] {
    if (!value) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  }

  private isReservedTestDomain(email: string): boolean {
    const [, domain = ''] = email.toLowerCase().split('@');
    return RESERVED_TEST_DOMAINS.has(domain);
  }
}
