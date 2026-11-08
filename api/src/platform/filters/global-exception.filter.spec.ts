import { ForbiddenException } from '@nestjs/common';
import {
  buildErrorResponse,
  resolveStatusCode,
} from './global-exception.filter';

describe('buildErrorResponse', () => {
  it('emits exactly the public envelope and moves payload extras into details', () => {
    const response = buildErrorResponse(
      new ForbiddenException({
        message: 'Workspace block limit reached.',
        code: 'WORKSPACE_BLOCK_LIMIT_REACHED',
        plan: 'free',
        block_count: 1000,
        block_limit: 1000,
        upgrade_available: true,
      }),
      403,
      '3f6c1b1e-2b0f-4d5a-9d0e-7a1f2c3b4d5e',
    );

    expect(response).toEqual({
      status_code: 403,
      code: 'WORKSPACE_BLOCK_LIMIT_REACHED',
      message: 'Workspace block limit reached.',
      request_id: '3f6c1b1e-2b0f-4d5a-9d0e-7a1f2c3b4d5e',
      details: {
        plan: 'free',
        block_count: 1000,
        block_limit: 1000,
        upgrade_available: true,
      },
    });
  });

  it('keeps explicit payload details and never promotes reserved keys', () => {
    const response = buildErrorResponse(
      new ForbiddenException({
        message: 'Validation failed',
        code: 'VALIDATION_FAILED',
        status_code: 200,
        request_id: 'attacker-controlled',
        details: { fields: [{ field: 'email', messages: ['email must be an email'] }] },
      }),
      400,
      'request-1',
    );

    expect(response).toEqual({
      status_code: 400,
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      request_id: 'request-1',
      details: {
        fields: [{ field: 'email', messages: ['email must be an email'] }],
      },
    });
  });

  it('omits request_id and details when they are not available', () => {
    const response = buildErrorResponse(
      new ForbiddenException('Forbidden'),
      403,
    );

    expect(response).toEqual({
      status_code: 403,
      code: 'FORBIDDEN',
      message: 'Forbidden',
    });
  });

  it('normalizes a legacy message array to a single string', () => {
    const response = buildErrorResponse(
      new ForbiddenException({ message: ['one', 'two'] }),
      400,
    );

    expect(response.message).toBe('one; two');
  });

  it('uses parser error status codes', () => {
    expect(resolveStatusCode({
      name: 'PayloadTooLargeError',
      message: 'request entity too large',
      statusCode: 413,
    })).toBe(413);
  });
});
