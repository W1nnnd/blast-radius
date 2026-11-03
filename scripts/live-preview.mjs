/** Run the production analysis pipeline outside Forge; no TWG app token is available. */
import {pathToFileURL} from 'node:url';
import {createService} from '../src/service.js';
import {createTwgAdapter} from '../src/graph/twgAdapter.js';
import {createJiraRest} from '../src/jira/jiraRest.js';
import {QUERY_KEYS} from '../src/graph/queryKeys.js';
import {safeErrorMessage} from './safe-error.mjs';

export const route = (strings, ...values) => strings.reduce((path, part, index) =>
  path + part + (index < values.length ? encodeURIComponent(String(values[index])) : ''), '');

export async function preview(args, {env = process.env, fetcher = fetch} = {}) {
  if (!((args[0] === '--issue' && args.length === 2) ||
    (args[0] === '--release' && args.length === 3))) {
    throw new Error('Usage: node scripts/live-preview.mjs --issue PAY-1 | --release PAY 2.4.0');
  }
  if (!env.FORGE_EMAIL || !env.FORGE_API_TOKEN) {
    throw new Error('FORGE_EMAIL and FORGE_API_TOKEN are required');
  }
  const site = env.ATLASSIAN_SITE || 'one-atlas-wdon.atlassian.net';
  if (!/^[a-z0-9-]+\.atlassian\.net$/i.test(site)) throw new Error('Invalid ATLASSIAN_SITE hostname');
  const origin = `https://${site}`;
  const request = async (path, options = {}) => {
    if (!String(path).startsWith('/') || String(path).startsWith('//')) throw new Error('Invalid Jira path');
    const response = await fetcher(origin + path, {
      ...options,
      redirect: 'error',
      headers: {...options.headers, Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${env.FORGE_EMAIL}:${env.FORGE_API_TOKEN}`).toString('base64')}`}
    });
    // Never include response bodies, request headers or URLs in diagnostics.
    if (!response.ok) throw new Error(`Jira request failed (HTTP ${response.status})`);
    return response;
  };
  const {cloudId} = await (await request('/_edge/tenant_info')).json();
  if (!cloudId) throw new Error('Jira cloud context unavailable');
  const jira = createJiraRest({request, route, cloudId});
  const adapter = createTwgAdapter({jira, queryKeys: QUERY_KEYS, request: async () => {
    throw Object.assign(new Error('Preview requires a Forge app token for TWG'), {code: 'PREVIEW_NO_TWG'});
  }});
  const service = createService(adapter);
  const report = args[0] === '--issue'
    ? await service.analyzeIssue(args[1]) : await service.analyzeRelease(args[1], args[2]);
  return {
    verdict: report.verdict,
    score: report.risk.score,
    topRisks: report.topRisks.map(({title, severity}) => ({title, severity})),
    blockers: report.risk.signals.filter(signal => report.risk.blockers.includes(signal.id))
      .map(({title, severity}) => ({title, severity})),
    counts: report.counts,
    coverage: Object.fromEntries(Object.entries(report.coverage).map(([source, state]) =>
      [source, {available: state.available, via: state.via, reason: state.reason}])),
    experts: report.experts.map(expert => ({name: expert.person.name, reasons: expert.reasons.length})),
    checklist: report.checklist.map(item => item.text),
    evidence: report.evidence.map(item => item.label)
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Production services log source counts; keep stdout as one compact JSON value.
  console.log = console.info = console.warn = () => {};
  try {
    const result = await preview(process.argv.slice(2));
    process.stdout.write(safeErrorMessage(JSON.stringify(result), process.env) + '\n');
  } catch (error) {
    process.stderr.write(safeErrorMessage(error.message, process.env) + '\n');
    process.exitCode = 1;
  }
}
