import type {
  CheckoutSession,
  StartCheckoutInput,
  VerifiedPaymentWebhook,
} from '../payment.types';

export abstract class PaymentProvider {
  abstract startCheckout(input: StartCheckoutInput): Promise<CheckoutSession>;
  abstract verifyWebhook(input: {
    signature?: string;
    rawBody: Buffer | string;
  }): Promise<VerifiedPaymentWebhook>;
}
