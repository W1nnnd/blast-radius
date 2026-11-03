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

for (const [name, request] of [
  ['throws', async () => { throw new Error('private transport detail'); }],
  ['GraphQL errors', async () => ({errors: [{extensions: {code: 'INTERNAL_SERVER_ERROR'}}]})]
]) {
  test(`panel returns REST verdict and unavailable coverage when all TWG ${name}`, async () => {
    const {createService} = await import('../src/service.js');
    const {createHandlers} = await import('../src/handlers.js');
    const {QUERY_KEYS} = await import('../src/graph/queryKeys.js');
    let reads = 0;
    const jira = createJiraRest({cloudId: 'cloud-1', route, request: async () => {
      reads++;
      return {id: '1', key: 'PAY-142', fields: {
        summary: 'REST subject', status: {name: 'In Progress'}, labels: ['release'],
        project: {key: 'PAY'}, fixVersions: [{name: '1.0'}],
        assignee: {accountId: 'person', displayName: 'Person'},
        issuelinks: [{type: {name: 'Blocks'}, inwardIssue: {
          key: 'PAY-150', fields: {status: {name: 'Open'}}
        }}]
      }};
    }});
    const adapter = createTwgAdapter({jira, request, queryKeys: QUERY_KEYS});
    const handlers = createHandlers({jira, service: createService(adapter)});
    const result = await handlers.getPanelData({}, {extension: {issue: {key: 'PAY-142'}}});
    assert.equal(result.error, undefined);
    assert.equal(result.verdict, 'INSUFFICIENT_EVIDENCE');
    assert.ok(result.risk.signals.some(signal => signal.id === 'blocked-PAY-142:PAY-150'));
    assert.deepEqual(result.releaseOptions, [{projectKey: 'PAY', name: '1.0'}]);
    assert.equal(reads, 2); // Subject plus one remote-link fallback read.
    for (const source of ['pullRequests', 'deployments', 'builds', 'pages', 'commits', 'blockers', 'incidents', 'people']) {
      assert.equal(result.coverage[source].available, false, source);
      assert.ok(result.coverage[source].reason);
    }
    const releaseIssues = await adapter.getReleaseIssues('version', {issueKeys: ['PAY-142']});
    assert.equal(releaseIssues[0].key, 'PAY-142');
    assert.equal(releaseIssues.coverage.available, false);
    assert.doesNotMatch(JSON.stringify(result), /private transport/);
  });
}
