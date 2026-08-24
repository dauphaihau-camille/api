import {
  Controller,
  Get,
  Header,
  HttpCode,
  Body,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '~/domains/auth/api/guard/jwt-auth.guard';
import { PermissionsGuard } from '~/domains/auth/api/guard/permissions.guard';
import type { AuthenticatedUser } from '~/domains/auth/app/auth.types';
import { CurrentUser } from '~/platform/decorators/current-user.decorator';
import { CancelSubscriptionUseCase } from '../../app/use-cases/cancel-subscription.use-case';
import { CreateCheckoutSessionUseCase } from '../../app/use-cases/create-checkout-session.use-case';
import { GetSubscriptionSummaryUseCase } from '../../app/use-cases/get-subscription-summary.use-case';
import { HandleBillingWebhookUseCase } from '../../app/use-cases/handle-billing-webhook.use-case';
import { BillingWebhookResponseDto } from './dto/billing-webhook-response.dto';
import { CheckoutSessionResponseDto } from './dto/checkout-session-response.dto';
import { CreateCheckoutSessionRequestDto } from './dto/create-checkout-session-request.dto';
import { SubscriptionSummaryResponseDto } from './dto/subscription-summary-response.dto';
import { rethrowSubscriptionAppError } from './subscription-http-error-mapper';

@Controller('workspaces/:workspaceId/subscription')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiCookieAuth('access_token')
@ApiTags('Subscription')
export class SubscriptionController {
  constructor(
    private readonly getSubscriptionSummaryUseCase: GetSubscriptionSummaryUseCase,
    private readonly createCheckoutSessionUseCase: CreateCheckoutSessionUseCase,
    private readonly cancelSubscriptionUseCase: CancelSubscriptionUseCase,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get workspace subscription summary' })
  @ApiOkResponse({ type: SubscriptionSummaryResponseDto })
  getSummary(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<SubscriptionSummaryResponseDto> {
    return this.getSubscriptionSummaryUseCase
      .execute(workspaceId, currentUser)
      .then(SubscriptionSummaryResponseDto.fromSummary)
      .catch(rethrowSubscriptionAppError);
  }

  @Post('checkout')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Create Plus checkout session' })
  @ApiCreatedResponse({ type: CheckoutSessionResponseDto })
  createCheckout(
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateCheckoutSessionRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CheckoutSessionResponseDto> {
    return this.createCheckoutSessionUseCase
      .execute(workspaceId, currentUser, {
        returnUrl: body.return_url,
      })
      .then(CheckoutSessionResponseDto.fromSummary)
      .catch(rethrowSubscriptionAppError);
  }

  @Post('cancel')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Cancel Plus at period end' })
  @ApiOkResponse({ type: SubscriptionSummaryResponseDto })
  cancel(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<SubscriptionSummaryResponseDto> {
    return this.cancelSubscriptionUseCase
      .execute(workspaceId, currentUser)
      .then(SubscriptionSummaryResponseDto.fromSummary)
      .catch(rethrowSubscriptionAppError);
  }
}

@Controller('billing/webhooks')
@ApiTags('Subscription')
export class BillingWebhookController {
  constructor(
    private readonly handleBillingWebhookUseCase: HandleBillingWebhookUseCase,
  ) {}

  @Post('stripe')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle Stripe billing webhook' })
  @ApiOkResponse({ type: BillingWebhookResponseDto })
  handleStripeWebhook(
    @Req() request: Request & { rawBody?: Buffer },
  ): Promise<BillingWebhookResponseDto> {
    return this.handleBillingWebhookUseCase
      .execute({
        signature: request.header('stripe-signature'),
        rawBody: request.rawBody ?? JSON.stringify(request.body ?? {}),
      })
      .then(BillingWebhookResponseDto.fromResult)
      .catch(rethrowSubscriptionAppError);
  }
}
