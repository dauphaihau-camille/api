export interface PaymentLineItem {
  sku: string;
  name: string;
  quantity: number;
  unitAmount: number;
  currency: string;
}

export interface StartCheckoutInput {
  orderId: string;
  customerId: string;
  customerEmail: string;
  lineItems: PaymentLineItem[];
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSession {
  sessionId: string;
  checkoutUrl: string;
  expiresAt?: Date;
}

export interface VerifiedPaymentWebhook {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}
