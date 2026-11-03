import {writeFile, mkdir} from 'node:fs/promises';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {safeErrorMessage} from './safe-error.mjs';

const STATE = new URL('../demo/seed/.seed-live-v2-state.json', import.meta.url);
const marker = 'blast-radius-live-v2';
const escapeXml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');

/** Inject fetch, logging and state persistence for offline verification. No credential is persisted. */
export async function seedLiveV2({env = process.env, fetch: transport = globalThis.fetch,
  mode = 'dry-run', log = console.log, statePath = STATE} = {}) {
  const email = env.FORGE_EMAIL || env.ATLASSIAN_EMAIL;
  const token = env.FORGE_API_TOKEN || env.ATLASSIAN_API_TOKEN;
  const redactEnv = {...env, ATLASSIAN_EMAIL: email, ATLASSIAN_API_TOKEN: token};
  const site = env.ATLASSIAN_SITE || 'one-atlas-wdon.atlassian.net';
  const base = `https://${site.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  const operations = [];
  const state = {issues: {}, pages: {}};
  if (!['inspect', 'dry-run', 'apply'].includes(mode)) throw new Error('Invalid seed mode');
  if (!email || !token) throw new Error('Set FORGE_EMAIL and FORGE_API_TOKEN (or ATLASSIAN equivalents)');
  async function api(path, method = 'GET', body) {
    try {
      const response = await transport(`${base}${path}`, {method, headers: {
        Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
        Accept: 'application/json', 'Content-Type': 'application/json'
      }, ...(body ? {body: JSON.stringify(body)} : {})});
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      const text = await response.text();
      return text.trim() ? JSON.parse(text) : null;
    } catch (error) {
      throw new Error(safeErrorMessage(`${method} ${path}: ${error.message}`, redactEnv));
    }
  }
  async function persistState() {
    await mkdir(dirname(statePath instanceof URL ? fileURLToPath(statePath) : statePath), {recursive: true});
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  }
  async function write(path, method, body) {
    operations.push({path, method, body});
    if (mode !== 'apply') return null;
    const result = await api(path, method, body);
    if (path === '/rest/api/3/issue' && result?.key && result?.id) state.issues[result.key] = result.id;
    if (path === '/wiki/rest/api/content' && result?.id) state.pages[result.id] = result.id;
    await persistState();
    return result;
  }
  try {
    // State is an audit output; live API state remains authoritative for retries and interrupted runs.
    const [project, statuses, linkTypes, users, versions, search, pageResult] = await Promise.all([
      api('/rest/api/3/project/PAY'), api('/rest/api/3/project/PAY/statuses'),
      api('/rest/api/3/issueLinkType'), api('/rest/api/3/user/assignable/search?project=PAY&accountType=atlassian&maxResults=1000'),
      api('/rest/api/3/project/PAY/versions'),
      api('/rest/api/3/search/jql?jql=project%20%3D%20PAY&maxResults=100&fields=summary,labels,status,assignee,fixVersions,issuelinks'),
      api('/wiki/rest/api/content?spaceKey=PAYDOCS&type=page&limit=100&expand=body.storage')
    ]);
    if (search.nextPageToken || search.isLast === false || pageResult._links?.next) {
      throw new Error('Seed inspection exceeds one page; refusing incomplete diff');
    }
    const issues = search.issues ?? [];
    const pages = pageResult.results ?? [];
    const details = await Promise.all(issues.map(async issue => ({...issue,
      transitions: (await api(`/rest/api/3/issue/${issue.key}/transitions`)).transitions ?? [],
      remoteLinks: await api(`/rest/api/3/issue/${issue.key}/remotelink`)
    })));
    if (mode === 'inspect') {
      const summary = {project: {id: project.id, key: project.key, issueTypes: project.issueTypes},
        statuses, linkTypes: linkTypes.issueLinkTypes, users: users.map(({accountId, displayName}) => ({accountId, displayName})),
        versions, issues: details.map(issue => ({key: issue.key, summary: issue.fields.summary,
          status: issue.fields.status, fixVersions: issue.fields.fixVersions, labels: issue.fields.labels,
          assignee: {displayName: issue.fields.assignee?.displayName}, transitions: issue.transitions, links: issue.fields.issuelinks,
          remoteLinks: issue.remoteLinks})), pages: pages.map(page => ({id: page.id, title: page.title,
          issueKeys: [...new Set((page.body?.storage?.value ?? '').match(/PAY-\d+/g) ?? [])]}))};
      log(safeErrorMessage(JSON.stringify(summary, null, 2), redactEnv));
      return summary;
    }
    const humans = users.filter(user => user.accountType === 'atlassian' &&
      !/bot|agent|guardrail|blast radius|bitbucket|config|provision|field-demo|jsm|itsm/i.test(user.displayName));
    const owner = name => {
      const user = humans.find(user => user.displayName === name) ?? humans.find(user => user.displayName === '风风');
      if (!user) throw new Error(`No human assignee for ${name} or fallback 风风`);
      return {accountId: user.accountId};
    };
    async function transitionTo(issue, category) {
      if (issue.fields.status?.statusCategory?.key === category) return;
      const transitions = issue.transitions ?? (await api(`/rest/api/3/issue/${issue.key}/transitions`)).transitions;
      const transition = transitions.find(value => value.to?.statusCategory?.key === category);
      if (!transition) throw new Error(`No available transition for ${issue.key} to ${category}`);
      await write(`/rest/api/3/issue/${issue.key}/transitions`, 'POST', {transition: {id: transition.id}});
    }
    const story = [
      ['indeterminate', '2.4.0', 'Emma Paris', 'payments,db-schema,migration'],
      ['indeterminate', '2.4.0', 'Ryan Lee', 'payments,db-schema'],
      ['done', '2.4.0', 'Max Taylor', 'payments,feature-flag'],
      ['indeterminate', '2.4.0', 'Kevin Campbell', 'payments,pci'],
      ['done', '2.4.0', 'Cassi Owens', 'payments,pci'],
      ['done', '2.4.0', 'Ada Isadora', 'payments'],
      ['new', '2.4.0', 'Jennifer Evans', 'payments'],
      ['new', '2.3.1', 'Mitch Davis', 'payments,hotfix'],
      ['done', '2.3.1', 'Alana Grant', 'payments,hotfix'],
      ['new', '2.3.1', '风风', 'hotfix']
    ];
    for (const [index, [category, versionName, name, tags]] of story.entries()) {
      const issue = details.find(issue => issue.key === `PAY-${index + 1}`);
      const version = versions.find(value => value.name === versionName);
      if (!issue || !version) throw new Error(`Missing PAY-${index + 1} or version ${versionName}`);
      state.issues[issue.key] = issue.id;
      const fields = {};
      const labels = [...new Set([...(issue.fields.labels ?? []), marker, ...tags.split(',')])];
      if (JSON.stringify(labels) !== JSON.stringify(issue.fields.labels)) fields.labels = labels;
      const assignee = owner(name);
      if (issue.fields.assignee?.accountId !== assignee.accountId) fields.assignee = assignee;
      if (issue.fields.fixVersions?.length !== 1 || issue.fields.fixVersions[0].id !== version.id) {
        fields.fixVersions = [{id: version.id}];
      }
      if (Object.keys(fields).length) await write(`/rest/api/3/issue/${issue.key}`, 'PUT', {fields});
      await transitionTo(issue, category);
      state.issues[issue.key] = issue.id;
    }
    const types = linkTypes.issueLinkTypes ?? [];
    async function link(type, blocker, blocked) {
      if (!type) return;
      const existing = details.find(issue => issue.key === blocker)?.fields.issuelinks ?? [];
      if (!existing.some(value => value.type?.id === type.id && value.outwardIssue?.key === blocked)) {
        await write('/rest/api/3/issueLink', 'POST', {type: {name: type.name}, inwardIssue: {key: blocker}, outwardIssue: {key: blocked}});
      }
    }
    const blocks = types.find(type => /^blocks$/i.test(type.name));
    if (!blocks) throw new Error('Blocks link type is required');
    for (const [a, b] of [['PAY-2', 'PAY-1'], ['PAY-8', 'PAY-4'], ['PAY-7', 'PAY-1'], ['PAY-9', 'PAY-5']]) await link(blocks, a, b);
    const summary = '[INCIDENT] Duplicate refund authorizations after retry storm';
    const incidentSearch = await api(`/rest/api/3/search/jql?jql=${encodeURIComponent('project = PAY AND labels = "blast-radius-live-v2" AND summary ~ "Duplicate refund authorizations"')}&fields=summary,labels,status,issuelinks`);
    if (incidentSearch.nextPageToken || incidentSearch.isLast === false) throw new Error('Incomplete incident search');
    let incident = incidentSearch.issues?.[0];
    if (!incident) {
      const type = project.issueTypes.find(type => type.id === '10005' || type.untranslatedName === 'Bug');
      if (!type) throw new Error('Bug issue type 10005 is required');
      const metadata = await api(`/rest/api/3/issue/createmeta/PAY/issuetypes/${type.id}`);
      const fields = Array.isArray(metadata.fields) ? metadata.fields : Object.values(metadata.fields ?? {});
      const priority = fields.find(field => field.fieldId === 'priority')?.allowedValues?.find(value => value.untranslatedName === 'High' || value.name === 'High');
      const created = await write('/rest/api/3/issue', 'POST', {fields: {project: {key: 'PAY'}, issuetype: {id: type.id},
        summary, labels: ['incident', 'payments', marker], assignee: owner('风风'),
        ...(priority ? {priority: {id: priority.id}} : {})}});
      incident = created ? {...created, fields: {issuelinks: []}} : {key: '<new incident key>', fields: {issuelinks: []},
        transitions: [{id: '<indeterminate transition id>', to: {statusCategory: {key: 'indeterminate'}}}]};
    }
    const known = details.find(issue => issue.key === incident.key);
    if (known) incident = known;
    else details.push(incident);
    await transitionTo(incident, 'indeterminate');
    if (incident.id) state.issues[incident.key] = incident.id;
    const incidentType = types.find(type => type.name === 'Problem/Incident') ?? types.find(type => type.name === 'Relates');
    if (!incidentType) throw new Error('Problem/Incident or Relates link type is required');
    for (const key of ['PAY-1', 'PAY-4']) await link(incidentType, incident.key, key);
    async function remote(key, suffix, relationship, object, application) {
      const globalId = `northwind-pay:blast-radius-v2:${suffix}`;
      const payload = {globalId, relationship, object,
        ...(application ? {application: {name: application, type: 'com.atlassian.confluence'}} : {})};
      const existing = details.find(issue => issue.key === key)?.remoteLinks?.find(link => link.globalId === globalId);
      // Jira upserts by globalId. Compare only supplied fields; response objects include server metadata.
      const matches = (actual, desired) => desired && typeof desired === 'object'
        ? Object.entries(desired).every(([field, value]) => matches(actual?.[field], value))
        : actual === desired;
      if (!existing || !matches(existing, payload)) {
        await write(`/rest/api/3/issue/${key}/remotelink`, 'POST', payload);
      }
    }
    const docs = [
      ['Northwind Pay 2.4.0 release runbook', ['PAY-1', 'PAY-4']],
      ['ADR-024 Idempotent refund authorization', ['PAY-1', 'PAY-2']],
      ['Northwind Pay 2.4.0 rollback plan', ['PAY-1', 'PAY-3']],
      ['Postmortem: duplicate refund authorizations', ['PAY-1', incident.key]]
    ];
    for (const [title, keys] of docs) {
      let page = pages.find(value => value.title === title);
      const body = keys.map(key => `<p><a href="${base}/browse/${escapeXml(key)}">${escapeXml(key)}</a></p><ac:structured-macro ac:name="jira"><ac:parameter ac:name="key">${escapeXml(key)}</ac:parameter></ac:structured-macro>`).join('');
      if (!page) {
        page = await write('/wiki/rest/api/content', 'POST', {type: 'page', title, space: {key: 'PAYDOCS'}, body: {storage: {value: body, representation: 'storage'}}});
        if (mode === 'apply' && !page?.id) {
          page = (await api(`/wiki/rest/api/content?spaceKey=PAYDOCS&type=page&title=${encodeURIComponent(title)}`)).results?.[0];
        }
        if (mode === 'apply' && !page?.id) throw new Error(`Could not resolve created page: ${title}`);
        page ??= {id: '<new page id>'};
      }
      let webui = page._links?.webui;
      if (mode === 'apply' && !webui) {
        const resolved = await api(`/wiki/rest/api/content/${page.id}`);
        webui = resolved._links?.webui;
      }
      const url = webui ? new URL(webui, page._links?.base ?? base).href : `${base}/wiki/spaces/PAYDOCS/pages/${page.id}`;
      if (mode === 'apply' && !webui) throw new Error(`Could not resolve page webui URL: ${title}`);
      state.pages[page.id] = page.id;
      if (mode === 'apply') await persistState();
      for (const key of keys) await remote(key, `page:${page.id}:${key}`, 'mentioned in', {title, url}, 'Confluence');
    }
    const evidence = [
      ['Refund idempotency keys', 'open, 0 approvals, changes requested', false, 'failed (integration tests)', false],
      ['Ledger reconciliation job', 'awaiting review', false, 'passed', true],
      ['Checkout retry flow', 'merged, 2 approvals', true, 'passed', true],
      ['Payment timeout handling', 'awaiting approval', false, 'failed (timeout regression)', false],
      ['Audit event delivery', 'merged, 2 approvals', true, 'passed', true],
      ['Settlement scheduling', 'merged', true, 'passed', true]
    ];
    for (const [index, [title, summary, merged, build, passed]] of evidence.entries()) {
      const key = `PAY-${index + 1}`;
      await remote(key, `pr:${401 + index}`, 'pull request', {title: `PR #${401 + index} "${title}"`,
        url: `https://github.com/northwind-pay/payments-core/pull/${401 + index}`, summary, status: {resolved: merged}});
      await remote(key, `build:${8100 + index}`, 'build', {title: `payments-core CI #${8100 + index} ${build}`,
        url: `https://github.com/northwind-pay/payments-core/actions/runs/${8100 + index}`, status: {resolved: passed}});
    }
    for (const [key, release, environment, summary] of [
      ['PAY-1', '2.4.0-rc1', 'staging', 'deployed to staging; production not deployed'],
      ['PAY-3', '2.4.0-rc1', 'staging', 'successful'],
      ['PAY-6', '2.3.1', 'production', 'successful']
    ]) await remote(key, `deployment:${release}:${environment}:${key}`, 'deployment', {
      title: `payments-core ${release} → ${environment}`, summary,
      url: `https://deploy.northwind-pay.example/payments-core/${release}/${environment}`, status: {resolved: true}});
    if (mode === 'apply') {
      await persistState();
    }
    log(safeErrorMessage(JSON.stringify({mode, operations}, null, 2), redactEnv));
    return {mode, operations, state};
  } catch (error) {
    throw new Error(safeErrorMessage(error.message, redactEnv));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flags = process.argv.slice(2);
  if (flags.length > 1 || flags.some(flag => !['--inspect', '--dry-run', '--apply'].includes(flag))) {
    console.error('Usage: node scripts/seed-live-v2.mjs [--inspect|--dry-run|--apply]');
    process.exitCode = 1;
  } else {
    seedLiveV2({mode: (flags[0] ?? '--dry-run').slice(2)}).catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
