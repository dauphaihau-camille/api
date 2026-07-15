import http from 'k6/http';
import { check, sleep } from 'k6';
import { forwardedIp } from './helpers.js';

const BASE_URL = __ENV.BASE_URL ?? 'http://127.0.0.1:3000/v1';
const LOGIN_EMAIL = __ENV.LOGIN_EMAIL ?? 'member@example.com';
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD ?? 'Password123!';
const scenarioFile = __ENV.SCENARIO ?? 'normal-traffic.json';
const scenario = JSON.parse(open(`../scenarios/${scenarioFile}`));

export const options = {
  vus: Number(__ENV.K6_VUS ?? scenario.vus ?? 5),
  duration: __ENV.K6_DURATION ?? scenario.duration ?? '30s',
  thresholds: scenario.thresholds ?? {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<750'],
    checks: ['rate>0.99'],
  },
};

export default function authLogin() {
  const response = http.post(
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

  check(response, {
    'login status is 200': (res) => res.status === 200,
    'login returns no-store cache control': (res) =>
      res.headers['Cache-Control'] === 'no-store',
    'login returns user payload': (res) => Boolean(res.json('user.id')),
  });

  sleep(Number(scenario.sleepSeconds ?? 1));
}
