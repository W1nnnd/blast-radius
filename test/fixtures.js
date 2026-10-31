/** Shared normalized context builders for engine regression tests. */
import { scoreRisk } from '../src/engine/risk.js';
import { SOURCES } from '../src/engine/coverage.js';
export const now = '2026-12-10T09:00:00Z';
export const ada = {
  accountId: 'a',
  name: 'Ada'
};
export const ben = {
  accountId: 'b',
  name: 'Ben'
};
/** Create a complete, empty evidence context. */
export const base = () => {
  return {
    subject: {
      type: 'issue',
      key: 'PAY-142'
    },
    issues: [],
    pullRequests: [],
    builds: [],
    deployments: [],
    pages: [],
    incidents: [],
    people: [ada, ben],
    teams: [{
      id: 't',
      name: 'Core',
      members: ['a']
    }],
    coverage: Object.fromEntries(SOURCES.map(source => [source, {
      available: true
    }]))
  };
};
/** Create an approved pull request with optional overrides. */
export const pr = (extra = {}) => {
  return {
    id: 'pr1',
    displayId: '42',
    title: 'Refunds',
    status: 'OPEN',
    repository: 'api',
    author: ada,
    reviewers: [{
      person: ben,
      approvalStatus: 'APPROVED'
    }],
    issueKeys: ['PAY-142'],
    updatedAt: now,
    url: 'https://example.test/pr/1',
    ...extra
  };
};
/** Create a resolved issue with optional overrides. */
export const issue = (extra = {}) => {
  return {
    key: 'PAY-142',
    summary: 'Refund',
    statusCategory: 'done',
    assignee: ada,
    priority: 'Medium',
    url: 'https://example.test/PAY-142',
    ...extra
  };
};
/** Evaluate fixture evidence at the deterministic analysis time. */
export const run = context => scoreRisk({
  ...base(),
  ...context
}, {
  now
});
/** Find a signal by its rule identifier. */
export const has = (risk, id) => risk.signals.find(source => source.id.startsWith(id + ':'));
