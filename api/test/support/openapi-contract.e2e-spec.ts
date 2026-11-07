/**
 * Self-test for the OpenAPI contract helper. It needs no infrastructure but
 * lives under the e2e Jest project because `pnpm test` only collects `src`.
 */
import {
  ContractViolationError,
  assertMatchesContract,
  expectMatchesContract,
  loadOpenApiDocument,
  resolveOperationPath,
} from './openapi-contract';

const validLoginBody = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  user: {
    id: 'a1b2c3',
    email: 'member@example.com',
    display_name: 'Member User',
    status: 'active',
    session_id: 'session-1',
    roles: ['member'],
    permissions: [],
  },
};

const unauthorizedEnvelope = {
  statusCode: 401,
  code: 'UNAUTHORIZED',
  timestamp: '2026-01-01T00:00:00.000Z',
  path: '/v1/auth/login',
  error: 'Unauthorized',
  message: 'Invalid email or password.',
};

describe('openapi-contract', () => {
  it('loads the committed spec with its path templates', () => {
    const document = loadOpenApiDocument();

    expect(document.info.version).toEqual(expect.any(String));
    expect(document.paths['/v1/auth/login']).toBeDefined();
  });

  it('accepts a valid login response body', () => {
    expectMatchesContract({
      method: 'post',
      path: '/v1/auth/login',
      status: 200,
      body: validLoginBody,
    });
  });

  it('rejects a login body missing a required field', () => {
    const { refresh_token: _omitted, ...incompleteBody } = validLoginBody;

    expect(() =>
      assertMatchesContract({
        method: 'POST',
        path: '/v1/auth/login',
        status: 200,
        body: incompleteBody,
      }),
    ).toThrow(ContractViolationError);

    expect(() =>
      assertMatchesContract({
        method: 'POST',
        path: '/v1/auth/login',
        status: 200,
        body: incompleteBody,
      }),
    ).toThrow(/POST \/v1\/auth\/login \(status 200\).*refresh_token/u);
  });

  it('rejects a login body with a wrongly typed field', () => {
    expect(() =>
      assertMatchesContract({
        method: 'post',
        path: '/v1/auth/login?ignored=1',
        status: 200,
        body: { ...validLoginBody, user: { ...validLoginBody.user, roles: 'member' } },
      }),
    ).toThrow(/roles/u);
  });

  it('accepts the documented error envelope', () => {
    expectMatchesContract({
      method: 'post',
      path: '/v1/auth/login',
      status: 401,
      body: unauthorizedEnvelope,
    });
  });

  it('accepts an error envelope whose message is a list', () => {
    expectMatchesContract({
      method: 'post',
      path: '/v1/auth/login',
      status: 400,
      body: {
        ...unauthorizedEnvelope,
        statusCode: 400,
        error: 'Bad Request',
        message: ['email must be an email'],
      },
    });
  });

  it('rejects an error envelope missing the timestamp', () => {
    const { timestamp: _omitted, ...brokenEnvelope } = unauthorizedEnvelope;

    expect(() =>
      assertMatchesContract({
        method: 'post',
        path: '/v1/auth/login',
        status: 401,
        body: brokenEnvelope,
      }),
    ).toThrow(/timestamp/u);
  });

  it('resolves a concrete URL to its templated path', () => {
    expect(resolveOperationPath('/v1/documents/9f3c2a1b4d')).toBe(
      '/v1/documents/{documentId}',
    );
    expect(resolveOperationPath('/v1/documents/9f3c2a1b4d/favorite')).toBe(
      '/v1/documents/{documentId}/favorite',
    );
    expect(resolveOperationPath('/v1/documents?workspace_id=w1')).toBe('/v1/documents');
    expect(resolveOperationPath('/v1/workspaces/w1/search/documents')).toBe(
      '/v1/workspaces/{workspaceId}/search/documents',
    );
  });

  it('honours OpenAPI 3.0 nullable fields', () => {
    const path = '/v1/workspaces/w1/subscription';
    const body = {
      workspace_id: 'w1',
      plan: 'free',
      status: 'free',
      seat_count: 1,
      block_count: 0,
      block_limit: null,
      entitlements: { max_blocks: null },
      cancel_at_period_end: false,
    };

    expectMatchesContract({
      method: 'get',
      path,
      status: 200,
      body,
    });

    expect(() =>
      assertMatchesContract({
        method: 'get',
        path,
        status: 200,
        body: { ...body, block_limit: 'unlimited' },
      }),
    ).toThrow(/block_limit/u);
  });

  it('fails clearly when the status code is not documented', () => {
    expect(() =>
      assertMatchesContract({
        method: 'post',
        path: '/v1/auth/login',
        status: 418,
        body: {},
      }),
    ).toThrow(/status 418/u);
  });

  it('fails clearly when no path template matches', () => {
    expect(() =>
      assertMatchesContract({
        method: 'get',
        path: '/v1/does-not-exist/123',
        status: 200,
        body: {},
      }),
    ).toThrow(/No registered OpenAPI path matches/u);
  });
});
