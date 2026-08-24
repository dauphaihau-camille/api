import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  PAYMENT_CONFIG,
  buildPaymentConfig,
} from '~/platform/config/payment.config';
import { PaymentProvider } from './app/ports/payment-provider';
import { NoopPaymentProvider } from './infra/noop-payment-provider';
import { StripePaymentProvider } from './infra/stripe-payment-provider';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PAYMENT_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildPaymentConfig(configService),
    },
    {
      provide: PaymentProvider,
      inject: [PAYMENT_CONFIG],
      useFactory: (paymentConfig: ReturnType<typeof buildPaymentConfig>) =>
        paymentConfig.driver === 'stripe'
          ? new StripePaymentProvider(paymentConfig)
          : new NoopPaymentProvider(paymentConfig),
    },
  ],
  exports: [PAYMENT_CONFIG, PaymentProvider],
})
export class PaymentModule {}
