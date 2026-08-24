import { ForbiddenException } from '@nestjs/common';
import {
  buildErrorResponse,
  resolveStatusCode,
} from './global-exception.filter';

describe('buildErrorResponse', () => {
  it('preserves custom HTTP exception response fields', () => {
    const response = buildErrorResponse(
      new ForbiddenException({
        message: 'Workspace block limit reached.',
        code: 'workspace_block_limit_reached',
        plan: 'free',
        block_count: 1000,
        block_limit: 1000,
        upgrade_available: true,
      }),
      403,
      '/v1/documents/document-1/commands/create-subdoc',
    );

    expect(response).toEqual({
      statusCode: 403,
      timestamp: expect.any(String),
      path: '/v1/documents/document-1/commands/create-subdoc',
      error: 'ForbiddenException',
      message: 'Workspace block limit reached.',
      code: 'workspace_block_limit_reached',
      plan: 'free',
      block_count: 1000,
      block_limit: 1000,
      upgrade_available: true,
    });
  });

  it('uses parser error status codes', () => {
    expect(resolveStatusCode({
      name: 'PayloadTooLargeError',
      message: 'request entity too large',
      statusCode: 413,
    })).toBe(413);
  });
});
