import type { ConfigService } from '@nestjs/config';

export interface PaymentConfig {
  driver: 'noop' | 'stripe';
  publicBaseUrl?: string;
  webhookSecret?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripePlusPriceId?: string;
  successPath: string;
  cancelPath: string;
}

export const PAYMENT_CONFIG = Symbol('PAYMENT_CONFIG');

export function buildPaymentConfig(
  configService: Pick<ConfigService, 'get'>,
): PaymentConfig {
  return {
    driver:
      configService.get<'noop' | 'stripe'>('PAYMENT_DRIVER', 'noop') ??
      'noop',
    publicBaseUrl: configService.get<string>('PAYMENT_PUBLIC_BASE_URL'),
    webhookSecret: configService.get<string>('PAYMENT_WEBHOOK_SECRET'),
    stripeSecretKey: configService.get<string>('STRIPE_SECRET_KEY'),
    stripeWebhookSecret:
      configService.get<string>('STRIPE_WEBHOOK_SECRET') ??
      configService.get<string>('PAYMENT_WEBHOOK_SECRET'),
    stripePlusPriceId: configService.get<string>('STRIPE_PLUS_PRICE_ID'),
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
