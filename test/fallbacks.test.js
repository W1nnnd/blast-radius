/** Jira REST fallbacks for NEEDS-LIVE graph queries. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiraRest } from '../src/jira/jiraRest.js';
import { createTwgAdapter } from '../src/graph/twgAdapter.js';

const route = (strings, ...values) =>
  strings.reduce((path, part, index) => path + part + (values[index] ?? ''), '');

test('resolveIssue maps inward "Blocks" links to REST blockers', async () => {
  const jira = createJiraRest({
    cloudId: 'cloud-1',
    route,
    request: async () => ({
      id: '10142',
      key: 'PAY-142',
      fields: {
        summary: 'Refund idempotency',
        issuelinks: [
          { type: { name: 'Blocks' }, inwardIssue: { key: 'PAY-150', fields: { status: { name: 'Open' } } } },
          { type: { name: 'Relates' }, inwardIssue: { key: 'PAY-151' } },
          { type: { name: 'Blocks' }, outwardIssue: { key: 'PAY-152' } }
        ]
      }
    })
  });
  const issue = await jira.resolveIssue('PAY-142');
  assert.equal(issue.ari, 'ari:cloud:jira:cloud-1:issue/10142');
  assert.deepEqual(issue.blockers.map(blocker => blocker.key), ['PAY-150']);
});

test('twg adapter falls back to REST blockers when the graph query is not registered', async () => {
  const adapter = createTwgAdapter({
    queryKeys: {},
    jira: {},
    request: async () => ({ data: {} })
  });
  const context = await adapter.getIssueContext({
    key: 'PAY-142',
    ari: 'ari:cloud:jira:cloud-1:issue/10142',
    blockers: [{ key: 'PAY-150', status: { name: 'Open', statusCategory: { key: 'new' } } }]
  });
  assert.deepEqual(context.issues[0].blockers.map(blocker => blocker.key), ['PAY-150']);
  assert.equal(context.coverage.blockers.available, false);
});
