import type { HttpException } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { toHttpErrorPayload } from '~/platform/http/api-error-code';
import {
  AiAssistanceAppError,
  AiContextSizeLimitExceededError,
  AiConversationSessionNotFoundError,
  AiDocumentAttachmentNotFoundError,
  AiDocumentAttachmentWorkspaceMismatchError,
  AiEmptyDocumentContentError,
  AiGenerationFailedError,
  AiResponseEntitlementDeniedError,
  AiWorkspaceNotFoundError,
} from '../../app/errors/ai-assistance-app.error';

export function mapAiAssistanceAppErrorToHttpException(
  error: AiAssistanceAppError,
): HttpException {
  if (
    error instanceof AiWorkspaceNotFoundError
    || error instanceof AiConversationSessionNotFoundError
    || error instanceof AiDocumentAttachmentNotFoundError
  ) {
    return new NotFoundException(toHttpErrorPayload(error));
  }

  if (error instanceof AiResponseEntitlementDeniedError) {
    return new ForbiddenException(
      toHttpErrorPayload(error, {
        remaining_responses: error.remainingResponses,
        upgrade_available: error.upgradeAvailable,
      }),
    );
  }

  if (
    error instanceof AiDocumentAttachmentWorkspaceMismatchError
    || error instanceof AiEmptyDocumentContentError
    || error instanceof AiContextSizeLimitExceededError
    || error instanceof AiGenerationFailedError
  ) {
    return new BadRequestException(toHttpErrorPayload(error));
  }

  return new BadRequestException(toHttpErrorPayload(error));
}

export function rethrowAiAssistanceAppError(error: unknown): never {
  if (error instanceof AiAssistanceAppError) {
    throw mapAiAssistanceAppErrorToHttpException(error);
  }

  throw error;
}
