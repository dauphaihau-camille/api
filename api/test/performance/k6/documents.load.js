import http from 'k6/http';
import { check, sleep } from 'k6';
import { forwardedIp, jsonHeaders, parseJson } from './helpers.js';

const BASE_URL = __ENV.BASE_URL ?? 'http://127.0.0.1:5100/v1';
const LOGIN_EMAIL = __ENV.LOGIN_EMAIL ?? 'member@example.com';
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD ?? 'password123';
const WORKSPACE_ID = __ENV.WORKSPACE_ID;
const WORKSPACE_SLUG = __ENV.WORKSPACE_SLUG;
const scenarioFile = __ENV.SCENARIO ?? 'document-traffic.json';
const scenario = JSON.parse(open(`../scenarios/${scenarioFile}`));

if (scenario.description) {
  console.log(`Scenario: ${scenario.description}`);
}

if (scenario.requiresRateLimitLimit) {
  console.warn(
    `Scenario expects API RATE_LIMIT_LIMIT>=${scenario.requiresRateLimitLimit}; ` +
    'restart the API with a raised limit before using this as a load baseline.',
  );
}

export const options = {
  vus: Number(__ENV.K6_VUS ?? scenario.vus ?? 5),
  duration: __ENV.K6_DURATION ?? scenario.duration ?? '30s',
  thresholds: scenario.thresholds ?? {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    checks: ['rate>0.98'],
  },
};

export function setup() {
  const loginResponse = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': forwardedIp(),
      },
    },
  );

  check(loginResponse, {
    'setup login status is 200': (res) => res.status === 200,
    'setup login returns access token': (res) => Boolean(res.json('access_token') || res.json('accessToken')),
  });

  const loginBody = parseJson(loginResponse);
  const accessToken = loginBody.access_token || loginBody.accessToken;

  if (!accessToken) {
    throw new Error(
      `Login did not return an access token: status=${loginResponse.status} body=${loginResponse.body}`,
    );
  }

  if (WORKSPACE_ID) {
    return {
      accessToken,
      workspaceId: WORKSPACE_ID,
      workspaceSlug: WORKSPACE_SLUG || WORKSPACE_ID,
    };
  }

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const workspaceResponse = http.post(
    `${BASE_URL}/workspaces`,
    JSON.stringify({
      name: `K6 Documents ${suffix}`,
      slug: `k6-documents-${suffix}`.slice(0, 32),
    }),
    { headers: jsonHeaders(accessToken) },
  );

  check(workspaceResponse, {
    'setup workspace status is 201': (res) => res.status === 201,
    'setup workspace returns id': (res) => Boolean(res.json('id')),
  });

  const workspace = parseJson(workspaceResponse);

  return {
    accessToken,
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
  };
}

export default function documentsTraffic(data) {
  const headers = jsonHeaders(data.accessToken);
  const title = `K6 note ${__VU}-${__ITER}-${Date.now()}`;

  const createResponse = http.post(
    `${BASE_URL}/documents`,
    JSON.stringify({
      workspace_id: data.workspaceId,
      title,
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: `Created by k6 iteration ${__ITER}` }],
      }],
    }),
    { headers },
  );
  const createdDocument = parseJson(createResponse);

  check(createResponse, {
    'document create status is 201': (res) => res.status === 201,
    'document create returns id': () => Boolean(createdDocument.id),
  });

  if (createdDocument.id && createdDocument.version) {
    const updateResponse = http.patch(
      `${BASE_URL}/documents/${createdDocument.id}`,
      JSON.stringify({
        version: createdDocument.version,
        title: `${title} updated`,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: `Updated by k6 iteration ${__ITER}` }],
        }],
      }),
      { headers },
    );

    check(updateResponse, {
      'document update status is 200': (res) => res.status === 200,
      'document update returns newer version': (res) =>
        Number(res.json('version') ?? 0) > Number(createdDocument.version),
    });
  }

  const listResponse = http.get(
    `${BASE_URL}/workspaces/${data.workspaceId}/documents?limit=${scenario.listLimit ?? 20}`,
    { headers },
  );

  check(listResponse, {
    'document list status is 200': (res) => res.status === 200,
  });

  const searchResponse = http.get(
    `${BASE_URL}/workspaces/${data.workspaceId}/search/documents?q=${encodeURIComponent('K6')}`,
    { headers },
  );

  check(searchResponse, {
    'document search status is 200': (res) => res.status === 200,
  });

  sleep(Number(scenario.sleepSeconds ?? 1));
}
