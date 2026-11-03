import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {seedLiveV2} from '../scripts/seed-live-v2.mjs';

const env = {FORGE_EMAIL: 'fixture@example.test', FORGE_API_TOKEN: 'fixture-secret-token'};
function fakeSite({prioritySettable = true, pageCreateHasId = true} = {}) {
  const statuses = ['new', 'indeterminate', 'done'].map((key, index) => ({id: String(index), name: ['待办', '正在进行', '完成'][index], statusCategory: {key}}));
  const issues = Array.from({length: 10}, (_, i) => ({id: String(i + 1), key: `PAY-${i + 1}`, fields: {
    summary: `Payment ${i + 1}`, labels: ['blast-radius-demo'], status: statuses[0], assignee: null, fixVersions: [], issuelinks: []}, remoteLinks: []}));
  const pages = [], writes = [];
  const types = [{id: '10000', name: 'Blocks'}, {id: '2', name: 'Relates'}, {id: '3', name: 'Problem/Incident'}];
  issues[1].fields.issuelinks.push({type: types[0], outwardIssue: {key: 'PAY-1'}});
  const names = ['风风', 'Ryan Lee', 'Max Taylor', 'Kevin Campbell', 'Emma Paris', 'Cassi Owens', 'Ada Isadora', 'Jennifer Evans', 'Mitch Davis', 'Alana Grant'];
  const users = [...names.map(displayName => ({accountId: displayName, displayName, accountType: 'atlassian'})),
    ...['bot', 'agent', 'guardrail', 'blast radius', 'bitbucket', 'config', 'provision', 'field-demo', 'jsm', 'itsm'].map(displayName => ({accountId: displayName, displayName, accountType: 'atlassian'})),
    {accountId: 'app', displayName: 'App', accountType: 'app'}];
  const fetch = async (url, options) => {
    const {pathname: path} = new URL(url);
    const body = options.body ? JSON.parse(options.body) : undefined;
    const method = options.method;
    let data;
    if (method !== 'GET') {
      writes.push({path, method, body});
      if (path === '/rest/api/3/issue') {
        data = {id: '11', key: 'PAY-11'};
        issues.push({...data, fields: {...body.fields, status: statuses[0], issuelinks: []}, remoteLinks: []});
      } else if (path === '/rest/api/3/issueLink') {
        const a = issues.find(i => i.key === body.inwardIssue.key), b = issues.find(i => i.key === body.outwardIssue.key);
        const type = types.find(t => t.name === body.type.name);
        a.fields.issuelinks.push({type, outwardIssue: {key: b.key}});
        b.fields.issuelinks.push({type, inwardIssue: {key: a.key}});
      } else if (path === '/wiki/rest/api/content') {
        data = {...body, id: String(100 + pages.length), _links: {webui: `/wiki/pages/${100 + pages.length}`}};
        pages.push(data);
        if (!pageCreateHasId) data = {};
      } else if (path.startsWith('/rest/api/3/issue/')) {
        const issue = issues.find(i => i.key === path.split('/')[5]);
        if (path.endsWith('/transitions')) issue.fields.status = statuses.find(s => s.id === body.transition.id);
        else if (path.endsWith('/remotelink')) issue.remoteLinks.push(body);
        else Object.assign(issue.fields, body.fields);
      } else throw new Error(`Unexpected write ${path}`);
    } else if (path === '/rest/api/3/project/PAY') data = {id: '10234', key: 'PAY', issueTypes: [{id: '10005', name: '缺陷'}]};
    else if (path.endsWith('/statuses')) data = statuses;
    else if (path.endsWith('/issueLinkType')) data = {issueLinkTypes: types};
    else if (path.endsWith('/assignable/search')) data = users;
    else if (path.endsWith('/versions')) data = [{id: '10100', name: '2.4.0'}, {id: '10101', name: '2.3.1'}];
    else if (path.endsWith('/search/jql')) data = {issues: new URL(url).searchParams.get('jql').includes('Duplicate refund') ? issues.filter(i => i.fields.labels.includes('blast-radius-live-v2') && i.fields.summary.includes('Duplicate refund authorizations')) : issues};
    else if (path.includes('/createmeta/')) data = {fields: prioritySettable ? [{fieldId: 'priority', allowedValues: [{id: 'high', untranslatedName: 'High', name: '高'}]}] : []};
    else if (path === '/wiki/rest/api/content') data = {results: pages.filter(page => !new URL(url).searchParams.has('title') || page.title === new URL(url).searchParams.get('title'))};
    else if (path.startsWith('/wiki/rest/api/content/')) data = pages.find(page => page.id === path.split('/').at(-1));
    else if (path.endsWith('/transitions')) data = {transitions: statuses.map(s => ({id: s.id, to: s}))};
    else if (path.endsWith('/remotelink')) data = issues.find(i => i.key === path.split('/')[5]).remoteLinks;
    else throw new Error(`Unexpected GET ${path}`);
    return {ok: true, status: path === '/rest/api/3/issueLink' ? 201 : data ? 200 : 204,
      text: async () => data ? JSON.stringify(data) : ''};
  };
  return {fetch, writes, issues, pages, users};
}

test('seed defaults to dry-run with no network writes and a concrete plan', async () => {
  const site = fakeSite();
  const result = await seedLiveV2({env, fetch: site.fetch, log: () => {}});
  assert.equal(site.writes.length, 0);
  assert.ok(result.operations.some(op => op.body?.object?.title?.includes('failed (integration tests)')));
  assert.ok(result.operations.some(op => op.body?.body?.storage?.value.includes('ac:name="jira"')));
  assert.ok(result.operations.some(op => op.body?.globalId === 'northwind-pay:blast-radius-v2:page:<new page id>:PAY-1'));
  assert.ok(result.operations.every(op => !op.deferred));
});

test('seed apply is idempotent and state contains only keys and ids', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'seed-v2-'));
  try {
    const site = fakeSite();
    const statePath = join(folder, 'state.json');
    await seedLiveV2({env, fetch: site.fetch, mode: 'apply', log: () => {}, statePath});
    assert.ok(site.writes.length > 30);
    assert.equal(site.pages.length, 4);
    assert.equal(site.issues.filter(i => i.fields.fixVersions?.some(v => v.id === '10100')).length, 7);
    const expected = ['indeterminate', 'indeterminate', 'done', 'indeterminate', 'done', 'done', 'new', 'new', 'done', 'new'];
    for (const [index, issue] of site.issues.slice(0, 10).entries()) {
      assert.equal(issue.fields.status.statusCategory.key, expected[index]);
      assert.deepEqual(issue.fields.fixVersions, [{id: index < 7 ? '10100' : '10101'}]);
      assert.ok(issue.fields.labels.includes('blast-radius-demo'));
      assert.ok(issue.fields.labels.includes('blast-radius-live-v2'));
      assert.ok(site.users.slice(0, 10).some(user => user.accountId === issue.fields.assignee.accountId));
    }
    assert.equal(site.issues[0].fields.assignee.accountId, 'Emma Paris');
    assert.equal(site.issues[10].fields.status.statusCategory.key, 'indeterminate');
    assert.equal(site.issues[10].fields.issuetype.id, '10005');
    assert.equal(site.writes.filter(w => w.path === '/rest/api/3/issueLink').length, 5);
    assert.equal(site.writes.filter(w => w.body?.relationship === 'mentioned in').length, 8);
    const writes = site.writes.length;
    await seedLiveV2({env, fetch: site.fetch, mode: 'apply', log: () => {}, statePath});
    assert.equal(site.writes.length, writes);
    const state = await readFile(statePath, 'utf8');
    assert.doesNotMatch(state, /secret|fixture@example|authorization|summary/i);
  } finally {await rm(folder, {recursive: true, force: true});}
});

test('seed inspect is read-only and restricts user fields', async () => {
  const site = fakeSite();
  const result = await seedLiveV2({env, fetch: site.fetch, mode: 'inspect', log: () => {}});
  assert.ok(result.users.every(user => Object.keys(user).length === 2));
  assert.deepEqual(result.issues[0].labels, ['blast-radius-demo']);
  assert.deepEqual(result.issues[0].fixVersions, []);
  assert.ok('displayName' in result.issues[0].assignee);
  assert.equal(site.writes.length, 0);
});

test('seed redacts token, email and Basic encoding in HTTP and thrown errors', async () => {
  const encoded = Buffer.from(`${env.FORGE_EMAIL}:${env.FORGE_API_TOKEN}`).toString('base64');
  for (const throws of [true, false]) {
    const logs = [];
    await assert.rejects(seedLiveV2({env, log: value => logs.push(value), fetch: async () => {
      const message = `${env.FORGE_EMAIL} ${env.FORGE_API_TOKEN} Basic ${encoded}`;
      if (throws) throw new Error(message);
      return {ok: false, status: 401, text: async () => message};
    }}), error => {
      assert.match(error.message, /^GET \/rest\/api\/3\//);
      assert.ok(!error.message.includes(env.FORGE_API_TOKEN));
      assert.ok(!error.message.includes(encoded));
      assert.ok(!error.message.includes(env.FORGE_EMAIL));
      return true;
    });
    assert.ok(!logs.join('').includes(env.FORGE_API_TOKEN));
  }
});

 test('missing preferred human falls back to 风风 and replaces unrelated versions', async () => {
  const site = fakeSite();
  site.users.splice(site.users.findIndex(user => user.displayName === 'Emma Paris'), 1);
  site.issues[0].fields.fixVersions = [{id: 'old'}, {id: '10100'}];
  const result = await seedLiveV2({env, fetch: site.fetch, log: () => {}});
  const update = result.operations.find(op => op.path === '/rest/api/3/issue/PAY-1' && op.method === 'PUT');
  assert.deepEqual(update.body.fields.assignee, {accountId: '风风'});
  assert.deepEqual(update.body.fields.fixVersions, [{id: '10100'}]);
});

test('apply resolves missing page create ids and omits unavailable priority', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'seed-v2-'));
  try {
    const site = fakeSite({prioritySettable: false, pageCreateHasId: false});
    const result = await seedLiveV2({env, fetch: site.fetch, mode: 'apply', log: () => {}, statePath: join(folder, 'state.json')});
    assert.ok(!('priority' in site.issues[10].fields));
    assert.ok(result.operations.every(op => !op.deferred));
    const links = site.writes.filter(write => write.body?.relationship === 'mentioned in');
    assert.equal(links.length, 8);
    assert.ok(links.every(link => !link.body.globalId.includes('<') && link.body.object.url.includes('/wiki/pages/')));
    for (const page of site.pages) {
      assert.equal((page.body.storage.value.match(/ac:name="jira"/g) ?? []).length, 2);
      assert.equal((page.body.storage.value.match(/https:\/\/one-atlas-wdon.atlassian.net\/browse\/PAY-/g) ?? []).length, 2);
    }
  } finally {await rm(folder, {recursive: true, force: true});}
});

test('empty 201 writes persist progress before a later failure and resume without duplicate links', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'seed-v2-'));
  try {
    const site = fakeSite();
    const statePath = join(folder, 'nested', 'state.json');
    let emptyLinks = 0;
    const fetch = async (url, options) => {
      if (options.method === 'POST' && new URL(url).pathname === '/rest/api/3/issueLink') {
        if (emptyLinks === 1) {
          const state = JSON.parse(await readFile(statePath, 'utf8'));
          assert.equal(state.issues['PAY-10'], '10');
          throw new Error('interrupted');
        }
        const response = await site.fetch(url, options);
        assert.equal(response.status, 201);
        assert.equal(await response.text(), '');
        emptyLinks++;
        return response;
      }
      return site.fetch(url, options);
    };
    await assert.rejects(seedLiveV2({env, fetch, mode: 'apply', log: () => {}, statePath}),
      /POST \/rest\/api\/3\/issueLink: interrupted/);
    assert.equal(emptyLinks, 1);
    await seedLiveV2({env, fetch: site.fetch, mode: 'apply', log: () => {}, statePath});
    assert.equal(site.writes.filter(write => write.path === '/rest/api/3/issueLink').length, 5);
  } finally {await rm(folder, {recursive: true, force: true});}
});
