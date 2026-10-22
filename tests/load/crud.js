// CRUD p95 per route class against packages/server/perf-budgets.json (P13-03, R-05).
// Each virtual user is one account, reading and writing its own rows, under the default rate class
// (300 requests a minute per user). Generation routes are left out: they count against the `ai`
// class (20 a minute) and have their own script.
import { check, sleep } from 'k6';
import { API, budgets, headers, http, tokenFor } from './lib.js';

const VUS = Number(__ENV.VUS || 20);

export const options = {
  scenarios: {
    crud: { executor: 'constant-vus', vus: VUS, duration: __ENV.DURATION || '2m' },
  },
  thresholds: {
    'http_req_duration{class:crud_read}': [`p(95)<${budgets.crud_read}`],
    'http_req_duration{class:crud_write}': [`p(95)<${budgets.crud_write}`],
    'http_req_duration{class:job_search_cached}': [`p(95)<${budgets.job_search_cached}`],
    http_req_failed: ['rate<0.01'],
  },
};

const read = (url, h, name) => http.get(url, { headers: h, tags: { class: 'crud_read', name } });

export default function () {
  const h = headers(tokenFor(__VU));
  const r = [
    read(`${API}/me`, h, 'GET /me'),
    read(`${API}/me/settings`, h, 'GET /me/settings'),
    read(`${API}/profile`, h, 'GET /profile'),
    read(`${API}/me/dashboard`, h, 'GET /me/dashboard'),
    read(`${API}/resumes`, h, 'GET /resumes'),
  ];
  check(r, { 'reads 200': (all) => all.every((x) => x.status === 200) });

  const settings = r[1];
  const etag = settings.headers.Etag || settings.headers.ETag;
  const w = http.patch(`${API}/me/settings`, JSON.stringify({ appSettings: { theme: __ITER % 2 ? 'dark' : 'light' } }), {
    headers: { ...h, ...(etag ? { 'if-match': etag } : {}) },
    tags: { class: 'crud_write', name: 'PATCH /me/settings' },
  });
  check(w, { 'write 200': (x) => x.status === 200 });

  const jobs = http.get(`${API}/jobs/search?q=engineer`, { headers: h, tags: { class: 'job_search_cached', name: 'GET /jobs/search' } });
  check(jobs, { 'jobs 200': (x) => x.status === 200 });
  sleep(2); // 7 requests an iteration: about 200 a minute per user, under the default class's 300
}
