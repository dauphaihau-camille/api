import { MikroOrmModule } from '@mikro-orm/nestjs';
import { forwardRef, Module } from '@nestjs/common';
import { PaymentModule } from '~/integrations/payment/payment.module';
import { StripeSubscriptionBillingProvider } from '~/integrations/payment/infra/stripe-subscription-billing-provider';
import {
  PAYMENT_CONFIG,
  type PaymentConfig,
} from '~/platform/config/payment.config';
import { DocumentEntity } from '../document/infra/persistence/entities/document.entity';
import { WorkspaceEntity } from '../workspace/infra/persistence/entities/workspace.entity';
import { WorkspaceMemberEntity } from '../workspace/infra/persistence/entities/workspace-member.entity';
import { WorkspaceModule } from '../workspace/workspace.module';
import {
  BillingWebhookController,
  SubscriptionController,
} from './api/rest/subscription.controller';
import { BillingProvider } from './app/ports/billing-provider';
import { SubscriptionRepository } from './app/ports/subscription.repository';
import { BlockCreationGateService } from './app/services/block-creation-gate.service';
import { NoopBillingProvider } from './app/services/noop-billing-provider';
import { SeatSyncService } from './app/services/seat-sync.service';
import { SubscriptionEntitlementService } from './app/services/subscription-entitlement.service';
import { SubscriptionSummaryService } from './app/services/subscription-summary.service';
import { CancelSubscriptionUseCase } from './app/use-cases/cancel-subscription.use-case';
import { CreateCheckoutSessionUseCase } from './app/use-cases/create-checkout-session.use-case';
import { GetSubscriptionSummaryUseCase } from './app/use-cases/get-subscription-summary.use-case';
import { HandleBillingWebhookUseCase } from './app/use-cases/handle-billing-webhook.use-case';
import { MikroOrmSubscriptionRepository } from './infra/mikro-orm-subscription.repository';
import { WorkspaceSubscriptionEntity } from './infra/persistence/entities/workspace-subscription.entity';

@Module({
  imports: [
    forwardRef(() => WorkspaceModule),
    PaymentModule,
    MikroOrmModule.forFeature([
      WorkspaceEntity,
      WorkspaceMemberEntity,
      DocumentEntity,
      WorkspaceSubscriptionEntity,
    ]),
  ],
  controllers: [SubscriptionController, BillingWebhookController],
  providers: [
    {
      provide: SubscriptionRepository,
      useClass: MikroOrmSubscriptionRepository,
    },
    {
      provide: BillingProvider,
      inject: [PAYMENT_CONFIG],
      useFactory: (paymentConfig: PaymentConfig) =>
        paymentConfig.driver === 'stripe'
          ? new StripeSubscriptionBillingProvider(paymentConfig)
          : new NoopBillingProvider(),
    },
    SubscriptionEntitlementService,
    SubscriptionSummaryService,
    BlockCreationGateService,
    SeatSyncService,
    GetSubscriptionSummaryUseCase,
    CreateCheckoutSessionUseCase,
    CancelSubscriptionUseCase,
    HandleBillingWebhookUseCase,
  ],
  exports: [
    BlockCreationGateService,
    SeatSyncService,
    SubscriptionSummaryService,
  ],
})
export class SubscriptionModule {}
