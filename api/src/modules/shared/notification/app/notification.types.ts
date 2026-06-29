import type { MailAddress } from '../../mail/app/mail.types';

export type NotificationDeliveryMode = 'sync' | 'async';
export type NotificationChannelName = 'email';

export interface BaseNotificationInput {
  channel: NotificationChannelName;
  delivery?: NotificationDeliveryMode;
  deduplicationKey?: string;
}

export interface SendEmailNotificationInput extends BaseNotificationInput {
  channel: 'email';
  to: MailAddress | MailAddress[];
  subject: string;
  text?: string;
  html?: string;
  from?: MailAddress;
  replyTo?: MailAddress | MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  tags?: string[];
}

export type NotificationInput = SendEmailNotificationInput;
