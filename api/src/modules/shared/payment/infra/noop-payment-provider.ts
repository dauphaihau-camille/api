import { Injectable } from '@nestjs/common';
import type { PaymentConfig } from '../../../../config/payment.config';
import { PaymentProvider } from '../app/ports/payment-provider';
import type {
  CheckoutSession,
  StartCheckoutInput,
  VerifiedPaymentWebhook,
} from '../app/payment.types';

@Injectable()
export class NoopPaymentProvider implements PaymentProvider {
  constructor(private readonly paymentConfig: PaymentConfig) {}

  async startCheckout(
    input: StartCheckoutInput,
  ): Promise<CheckoutSession> {
    const checkoutBaseUrl =
      this.paymentConfig.publicBaseUrl?.replace(/\/$/, '') ??
      'http://localhost:3000';

    return {
      sessionId: `noop_${input.orderId}`,
      checkoutUrl: `${checkoutBaseUrl}${input.successUrl}`,
    };
  }

  async verifyWebhook(input: {
    signature?: string;
    rawBody: Buffer | string;
  }): Promise<VerifiedPaymentWebhook> {
    void input;

    throw new Error(
      'No payment webhook verifier is configured. Replace NoopPaymentProvider with a real provider implementation.',
    );
  }
}
