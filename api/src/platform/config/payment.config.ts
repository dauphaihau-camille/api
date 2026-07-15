import type { ConfigService } from '@nestjs/config';

export interface PaymentConfig {
  driver: 'noop';
  publicBaseUrl?: string;
  webhookSecret?: string;
  successPath: string;
  cancelPath: string;
}

export const PAYMENT_CONFIG = Symbol('PAYMENT_CONFIG');

export function buildPaymentConfig(
  configService: Pick<ConfigService, 'get'>,
): PaymentConfig {
  return {
    driver: 'noop',
    publicBaseUrl: configService.get<string>('PAYMENT_PUBLIC_BASE_URL'),
    webhookSecret: configService.get<string>('PAYMENT_WEBHOOK_SECRET'),
    successPath: configService.get<string>(
      'PAYMENT_SUCCESS_PATH',
      '/payments/success',
    ),
    cancelPath: configService.get<string>(
      'PAYMENT_CANCEL_PATH',
      '/payments/cancel',
    ),
  };
}
