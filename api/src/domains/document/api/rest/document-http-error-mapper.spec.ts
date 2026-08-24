import { ForbiddenException } from '@nestjs/common';
import {
  mapDocumentAppErrorToHttpException,
  rethrowDocumentAppError,
} from './document-http-error-mapper';

describe('document-http-error-mapper', () => {
  const blockLimitError = {
    code: 'workspace_block_limit_reached' as const,
    message: 'Workspace block limit reached.',
    metadata: {
      plan: 'free',
      blockCount: 1000,
      blockLimit: 1000,
      upgradeAvailable: true,
    },
  };

  it('maps structural workspace block limit errors to forbidden responses', () => {
    const exception = mapDocumentAppErrorToHttpException(blockLimitError);

    expect(exception).toBeInstanceOf(ForbiddenException);
    expect(exception.getResponse()).toEqual({
      message: 'Workspace block limit reached.',
      code: 'workspace_block_limit_reached',
      plan: 'free',
      block_count: 1000,
      block_limit: 1000,
      upgrade_available: true,
    });
  });

  it('rethrows structural workspace block limit errors as HTTP exceptions', () => {
    expect(() => rethrowDocumentAppError(blockLimitError)).toThrow(ForbiddenException);
  });
});
