export abstract class AiAssistanceAppError extends Error {
  protected constructor(message: string) {
    super(message);
  }
}

export class AiWorkspaceNotFoundError extends AiAssistanceAppError {
  constructor() {
    super('Workspace not found');
  }
}

export class AiConversationSessionNotFoundError extends AiAssistanceAppError {
  constructor() {
    super('AI conversation session not found');
  }
}

export class AiDocumentAttachmentNotFoundError extends AiAssistanceAppError {
  constructor() {
    super('AI document attachment not found or inaccessible');
  }
}

export class AiDocumentAttachmentWorkspaceMismatchError extends AiAssistanceAppError {
  constructor() {
    super('AI document attachment does not belong to this workspace');
  }
}

export class AiEmptyDocumentContentError extends AiAssistanceAppError {
  constructor() {
    super('Attached document has no meaningful content for AI');
  }
}

export class AiContextSizeLimitExceededError extends AiAssistanceAppError {
  constructor() {
    super('AI request exceeds the direct context size limit');
  }
}

export class AiResponseEntitlementDeniedError extends AiAssistanceAppError {
  readonly code = 'ai_response_limit_reached';

  constructor(
    public readonly remainingResponses: number,
    public readonly upgradeAvailable: boolean,
  ) {
    super('Workspace AI trial responses are exhausted');
  }
}

export class AiGenerationFailedError extends AiAssistanceAppError {
  constructor() {
    super('AI response could not be generated');
  }
}
