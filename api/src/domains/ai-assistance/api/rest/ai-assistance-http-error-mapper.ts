import type { HttpException } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
    return new NotFoundException(error.message);
  }

  if (error instanceof AiResponseEntitlementDeniedError) {
    return new ForbiddenException({
      code: error.code,
      message: error.message,
      remaining_responses: error.remainingResponses,
      upgrade_available: error.upgradeAvailable,
    });
  }

  if (
    error instanceof AiDocumentAttachmentWorkspaceMismatchError
    || error instanceof AiEmptyDocumentContentError
    || error instanceof AiContextSizeLimitExceededError
    || error instanceof AiGenerationFailedError
  ) {
    return new BadRequestException(error.message);
  }

  return new BadRequestException(error.message);
}

export function rethrowAiAssistanceAppError(error: unknown): never {
  if (error instanceof AiAssistanceAppError) {
    throw mapAiAssistanceAppErrorToHttpException(error);
  }

  throw error;
}
