import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreRisk } from '../src/risk.js';
import { parseColumns } from '../src/parse.js';

test('empty context has low zero risk', () => {
  assert.deepEqual(scoreRisk({}), { score: 0, level: 'low', reasons: [], checklist: [] });
});
test('failing build and unreviewed PR increase risk deterministically', () => {
  const context = { builds: [{ state: 'FAILED' }], pullRequests: [{ state: 'OPEN', reviewers: 0 }], owners: [{ id: 'owner' }] };
  assert.equal(scoreRisk(context).score, 35);
  assert.equal(scoreRisk(context).level, 'medium');
  assert.deepEqual(scoreRisk(context), scoreRisk(context));
});
test('risk clamps at 100', () => {
  const risk = scoreRisk({ builds: Array.from({ length: 20 }, () => ({ state: 'failed' })) });
  assert.equal(risk.score, 100);
  assert.equal(risk.level, 'high');
});
test('each weighted signal generates an actionable checklist', () => {
  const risk = scoreRisk({ issues: [{ key: 'APP-1', priority: 'High', status: 'Open' }],
    pullRequests: [{ state: 'OPEN', reviewers: 0, linesChanged: 501 }], builds: [{ state: 'failed' }],
    deployments: [{ state: 'failed' }], pages: [{ title: 'Decision', lastUpdatedDaysAgo: 91 }], owners: [] });
  assert.equal(risk.reasons.length, 7);
  assert.equal(risk.checklist.length, 7);
});
test('closed issues, reviewed PRs and fresh docs do not add risk', () => {
  assert.equal(scoreRisk({ issues: [{ priority: 'High', status: 'Done' }],
    pullRequests: [{ state: 'OPEN', reviewers: 1, linesChanged: 500 }],
    pages: [{ lastUpdatedDaysAgo: 90 }], owners: [{ id: 'a' }] }).score, 0);
});
test('parseColumns safely handles malformed inputs and graph errors', () => {
  for (const value of [null, undefined, {}, [], { data: { cypherQuery: { edges: [null, { node: { columns: [null, { key: 'x', value: {} }] } }] } } }, { errors: [{ message: 'denied' }] }])
    assert.deepEqual(parseColumns(value), {});
});
test('parseColumns collects nodes and ignores invalid members', () => {
  const node = { id: '1', data: { __typename: 'Issue' } };
  assert.deepEqual(parseColumns({ data: { cypherQuery: { edges: [{ node: { columns: [
    { key: 'issues', value: { nodes: [node, null] } },
  ] } }] } } }), { issues: [node] });
});
