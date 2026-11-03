import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {remoteLinkEvidence, REMOTE_LINK_LABEL} from '../src/jira/remoteLinkEvidence.js';
import {createTwgAdapter} from '../src/graph/twgAdapter.js';
import {createJiraRest} from '../src/jira/jiraRest.js';
import {createService} from '../src/service.js';
import {createHandlers} from '../src/handlers.js';
import {emptyContext} from '../src/domain/model.js';

const link = (url, summary, resolved = false, title = 'Payments evidence', relationship = '') =>
  ({id: url, relationship, object: {url, title, summary, status: {resolved}}});
const links = [
  link('https://github.com/northwind-pay/payments-core/pull/401', 'Open without approval'),
  link('https://github.com/northwind-pay/payments-core/actions/runs/8123', 'FAILED retry regression'),
  link('https://deploy.northwind-pay.example/staging/240', 'Successful staging only; production held', true),
  link('https://site.atlassian.net/wiki/spaces/PAYDOCS/pages/123', 'Recovery', false, 'Payments runbook')
];

test('remote links classify provider URLs, statuses, environments and provenance', () => {
  const result = remoteLinkEvidence([...links, links[3]], 'PAY-4');
  assert.equal(result.pullRequests[0].status, 'OPEN');
  assert.deepEqual(result.pullRequests[0].reviewers, []);
  assert.equal(result.builds[0].state, 'FAILED');
  assert.equal(result.deployments[0].environmentType, 'STAGING');
  assert.equal(result.deployments[0].state, 'SUCCESSFUL');
  assert.equal(result.pages.length, 1);
  assert.equal(result.pages[0].kind, 'runbook');
  for (const rows of Object.values(result)) for (const item of rows) {
    assert.equal(item.source, 'jira-remote-link');
    assert.equal(item.evidenceLabel, REMOTE_LINK_LABEL);
  }
  for (const url of ['https://bitbucket.org/nw/pay/pull-requests/4', 'https://gitlab.com/nw/pay/-/merge_requests/4']) {
    assert.equal(remoteLinkEvidence([link(url, '', true)], 'PAY-1').pullRequests[0].status, 'MERGED');
  }
  assert.equal(remoteLinkEvidence([link('https://ci.example/builds/8', 'passed', true)], 'PAY-1').builds[0].state, 'SUCCESSFUL');
  assert.equal(remoteLinkEvidence([link('https://deploy.example/8', 'production', true)], 'PAY-1').deployments[0].environmentType, 'PRODUCTION');
});

test('release with every TWG request failing uses JQL keys and remote evidence for HOLD', async () => {
  let remoteReads = 0;
  const jira = {
    resolveVersion: async () => ({ari: 'version', issueKeys: ['PAY-4']}),
    resolveIssue: async key => ({key, ari: 'issue', summary: 'Retry migration', status: {name: 'In Progress'},
      assignee: {accountId: 'admin', name: 'Admin'}, blockers: [{key: 'PAY-8', status: {name: 'To Do'}}],
      incidents: [{key: 'PAY-11', summary: '[INCIDENT] retry duplication', status: {name: 'To Do'}}]}),
    getRemoteLinks: async () => {remoteReads++; return links;}
  };
  const adapter = createTwgAdapter({jira, request: async () => {throw new Error('offline');}});
  const result = await createService(adapter).analyzeRelease('PAY', '2.4.0');
  assert.equal(remoteReads, 1);
  assert.equal(result.verdict, 'HOLD');
  assert.equal(result.counts.pages, 1);
  assert.equal(result.counts.deployments, 1);
  assert.equal(result.experts[0].person.accountId, 'admin');
  for (const id of ['failed-build:', 'no-reviewers:', 'blocked-', 'open-incident:']) {
    assert.ok(result.risk.signals.some(signal => signal.id.startsWith(id)), id);
  }
  assert.ok(result.checklist.length);
  assert.ok(result.evidence.every(item => item.evidenceLabel === REMOTE_LINK_LABEL));
  assert.equal(result.coverage.builds.via, 'jira-remote-link');
  assert.equal(result.coverage.releaseIssues.available, false);
});

test('TWG evidence wins; remote link failure remains a safe coverage note', async () => {
  const adapter = createTwgAdapter({jira: {getRemoteLinks: async () => links}, request: async query => {
    if (query.includes('jiraWorkItemLinkedExternalPullRequests')) return {data: {
      jiraWorkItemLinkedExternalPullRequests: {edges: [{node: {id: 'graph-pr', status: 'MERGED'}}]}}};
    return {data: {}};
  }});
  const result = await adapter.getIssueContext({key: 'PAY-4', ari: 'issue'});
  assert.equal(result.pullRequests.length, 1);
  assert.equal(result.pullRequests[0].id, 'graph-pr');
  assert.equal(result.coverage.pullRequests.via, undefined);
  const unavailable = createTwgAdapter({jira: {getRemoteLinks: async () => {throw new Error('private');}}, request: async () => ({data: {}})});
  const context = await unavailable.getIssueContext({key: 'PAY-4', ari: 'issue'});
  assert.equal(context.coverage.remoteLinks.available, false);
  assert.doesNotMatch(JSON.stringify(context), /private/);
});

test('Jira getRemoteLinks uses the injected asUser transport path', async () => {
  let seen;
  const jira = createJiraRest({route: (s, key) => s[0] + key + s[1], request: async path => {seen = path; return links;}});
  assert.deepEqual(await jira.getRemoteLinks('PAY-4'), links);
  assert.equal(seen, '/rest/api/3/issue/PAY-4/remotelink');
});

test('release concurrency is bounded at five and reuses resolved ARIs', async () => {
  let active = 0, peak = 0, resolved = 0, contexts = 0;
  const adapter = {mode: 'twg', resolveVersion: async () => ({ari: 'version'}),
    getReleaseIssues: async () => Array.from({length: 30}, (_, index) => ({key: `PAY-${index + 1}`, ari: `issue/${index}`})),
    resolveIssue: async () => {resolved++; throw new Error('must reuse ref');},
    getIssueContext: async ref => {
      active++; peak = Math.max(peak, active); contexts++;
      await new Promise(resolve => setTimeout(resolve, 2));
      active--;
      const context = emptyContext({type: 'issue', key: ref.key});
      context.issues = [{key: ref.key, statusCategory: 'done'}];
      return context;
    }};
  const result = await createService(adapter).analyzeRelease('PAY', '2.4.0');
  assert.equal(peak, 5);
  assert.equal(contexts, 25);
  assert.equal(resolved, 0);
  assert.equal(result.counts.issues, 25);
});

test('panel release payload and Rovo action reach the same release service', async () => {
  const source = await readFile(new URL('../src/frontend/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /load\('getReleaseData',\s*\{\s*projectKey: version.projectKey, versionName: version.name/);
  const calls = [];
  const handlers = createHandlers({service: {analyzeRelease: async (...args) => {calls.push(args); return {verdict: 'HOLD'};}}});
  const payload = {projectKey: 'PAY', versionName: '2.4.0'};
  assert.equal((await handlers.getReleaseData(payload)).verdict, 'HOLD');
  assert.equal((await handlers.scoreReleaseRisk(payload)).verdict, 'HOLD');
  assert.deepEqual(calls, [['PAY', '2.4.0'], ['PAY', '2.4.0']]);
});

test('live v2 exact payloads expose failed CI, unapproved PR and staging-only deployment', () => {
  // Keep these payloads identical to the live seed contract.
  const result = remoteLinkEvidence([
    {relationship: 'pull request', object: {title: 'PR #401 "Refund idempotency keys"',
      url: 'https://github.com/northwind-pay/payments-core/pull/401',
      summary: 'open, 0 approvals, changes requested', status: {resolved: false}}},
    {relationship: 'build', object: {title: 'payments-core CI #8100 failed (integration tests)',
      url: 'https://github.com/northwind-pay/payments-core/actions/runs/8100', status: {resolved: false}}},
    {relationship: 'deployment', object: {title: 'payments-core 2.4.0-rc1 → staging',
      url: 'https://deploy.northwind-pay.example/payments-core/2.4.0-rc1/staging',
      summary: 'deployed to staging; production not deployed', status: {resolved: true}}}
  ], 'PAY-1');
  assert.equal(result.builds[0].state, 'FAILED');
  assert.equal(result.pullRequests[0].status, 'OPEN');
  assert.deepEqual(result.pullRequests[0].reviewers, [{person: null, approvalStatus: 'NEEDSWORK'}]);
  assert.equal(result.deployments[0].environmentType, 'STAGING');
});

test('native and seed Confluence global IDs deduplicate despite different URLs', () => {
  const pages = remoteLinkEvidence([
    {globalId: 'appId=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee&pageId=123',
      application: {name: 'Confluence'}, object: {title: 'Runbook', url: 'https://site/wiki/pages/viewpage.action?pageId=123'}},
    {globalId: 'northwind-pay:blast-radius-v2:page:123:PAY-1',
      object: {title: 'Runbook', url: 'https://site/wiki/spaces/PAY/pages/123/Runbook'}}
  ], 'PAY-1').pages;
  assert.equal(pages.length, 1);
});

test('TWG pages merge remote pages by numeric ID, ARI suffix and URL fallback', async () => {
  const {custom} = await import('./graphFixtures.js');
  const adapter = createTwgAdapter({queryKeys: {pages: 'pages'},
    jira: {getRemoteLinks: async () => [
      {globalId: 'appId=uuid&pageId=123', application: {name: 'Confluence'},
        object: {title: 'Native', url: 'https://site/wiki/pages/viewpage.action?pageId=123'}},
      {globalId: 'northwind-pay:blast-radius-v2:page:123:PAY-1',
        object: {title: 'Seed', url: 'https://site/wiki/spaces/PAY/pages/123/Runbook'}},
      {object: {title: 'Another', url: 'https://site/wiki/pages/456/Another'}}
    ]},
    request: async (_query, variables) => variables.queryKey
      ? custom('pages', [
        {id: 'ari:cloud:confluence:tenant:page/123', data: {title: 'Graph', webUrl: 'https://site/wiki/x/short'}},
        {id: '456', data: {title: 'Another', webUrl: 'https://site/wiki/pages/456/Another'}}
      ]) : {data: {}}
  });
  const context = await adapter.getIssueContext({key: 'PAY-1', ari: 'issue'});
  assert.equal(context.pages.length, 2);
  assert.equal(context.pages[0].title, 'Graph');
});

test('page identity handles URL-only references and falls back to exact URL', async () => {
  const {dedupePages} = await import('../src/graph/pageIdentity.js');
  assert.equal(dedupePages([
    {id: 'a', url: 'https://site/wiki/pages/viewpage.action?pageId=789'},
    {id: 'b', url: 'https://site/wiki/spaces/PAY/pages/789/Title'},
    {id: 'c', url: 'https://site/wiki/x/short'},
    {id: 'd', url: 'https://site/wiki/x/short'},
    {id: 'e', url: 'https://site/wiki/x/other'}
  ]).length, 3);
});

test('remote PR identities, legacy merged status and anonymous review evidence', async () => {
  const {evidence} = await import('../src/domain/model.js');
  const {MATCHERS} = await import('../src/engine/ruleMatches.js');
  const {rankExperts} = await import('../src/engine/experts.js');
  for (const [path, repo] of [
    ['northwind-pay/payments-api/pull/48', 'northwind-pay/payments-api'],
    ['nw/pay/pull-requests/48', 'nw/pay'],
    ['nw/pay/-/merge_requests/48', 'nw/pay']
  ]) {
    const [pr] = remoteLinkEvidence([{globalId: 'blast-radius:pr8', object: {
      url: 'https://github.com/' + path, title: 'GitHub PR #48: Retry fix',
      summary: '2 approvals', status: {resolved: true}
    }}], 'PAY-1').pullRequests;
    assert.equal(pr.displayId, '48');
    assert.equal(pr.repository, repo);
    assert.equal(evidence('pullRequest', pr).label, '#48 Retry fix');
    assert.equal(pr.status, 'MERGED');
    assert.equal(pr.reviewers.length, 2);
    assert.ok(pr.reviewers.every(reviewer => reviewer.approvalStatus === 'APPROVED' && !reviewer.person?.accountId));
    const context = {...emptyContext(), pullRequests: [{...pr, author: {accountId: 'author', name: 'Author'}}]};
    for (const rule of ['no-reviewers', 'unapproved', 'bus-factor']) assert.deepEqual(MATCHERS[rule](context), []);
    assert.equal(rankExperts(context).length, 1);
  }
  for (const summary of ['merged', 'approved']) {
    const [pr] = remoteLinkEvidence([link('https://github.com/nw/pay/pull/9', summary, false, 'PR #9 Fix')], 'PAY-1').pullRequests;
    assert.equal(pr.title, 'Fix');
    assert.equal(summary === 'merged' ? pr.status : pr.reviewers[0].approvalStatus,
      summary === 'merged' ? 'MERGED' : 'APPROVED');
  }
});

test('successful empty remote-link reads cover every fallback source across issues', async () => {
  const {mergeContexts} = await import('../src/domain/context.js');
  const adapter = createTwgAdapter({jira: {getRemoteLinks: async () => []},
    request: async () => {throw new Error('offline');}});
  const contexts = await Promise.all(['PAY-1', 'PAY-2'].map(key => adapter.getIssueContext({key, ari: key})));
  const merged = mergeContexts(contexts, {key: 'release'});
  for (const context of [...contexts, merged]) for (const source of ['pullRequests', 'builds', 'deployments', 'pages']) {
    assert.deepEqual(context.coverage[source], {available: true, via: 'jira-remote-link',
      reason: 'Teamwork Graph had no dev-tool data; Jira remote links checked'});
  }
});
