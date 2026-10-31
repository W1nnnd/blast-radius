/** Shared application service used by Forge actions, MCP and the issue panel. */
import {sortSignals, releaseSummary} from './engine/summary.js';
import {scoreRisk} from './engine/risk.js';
import {buildChecklist, toMarkdown} from './engine/checklist.js';
import {rankExperts} from './engine/experts.js';
import {computeCoverage} from './engine/coverage.js';
import {mergeContexts, COLLECTIONS} from './domain/context.js';
export {mergeContexts} from './domain/context.js';

/** Bound response depth, strings, lists and encoded size at the action boundary. */
export function bounded(value) {
  const clean = (entry, depth = 0) => {
    if (depth > 16) return null;
    if (typeof entry === 'string') return entry.slice(0, 2000);
    if (Array.isArray(entry)) return entry.slice(0, 25).map(item => clean(item, depth + 1));
    if (entry && typeof entry === 'object') {
      return Object.fromEntries(Object.entries(entry).slice(0, 100).map(([key, item]) =>
        [key.slice(0, 200), clean(item, depth + 1)]));
    }
    return entry;
  };
  const result = clean(value);
  if (Buffer.byteLength(JSON.stringify(result)) >= 100000) {
    throw Object.assign(new Error('Response exceeds size limit'), {code: 'RESPONSE_TOO_LARGE'});
  }
  return result;
}

function verdictFor(risk) {
  if (risk.blockers.length || ['critical', 'high'].includes(risk.level)) return 'HOLD';
  if (risk.confidence === 'low') return 'INSUFFICIENT_EVIDENCE';
  return risk.level === 'medium' ? 'GO_WITH_CAUTION' : 'GO';
}

/** Create analyses against an injected graph adapter and one consistent analysis clock. */
export function createService(adapter, {
  now = () => adapter.mode === 'fixture' ? adapter.now : new Date()
} = {}) {
  const report = context => {
    const generatedAt = new Date(now()).toISOString();
    const analysisContext = {...context, meta: {...context.meta, now: generatedAt}};
    const risk = scoreRisk(analysisContext, {now: generatedAt});
    const verdict = verdictFor(risk);
    risk.summary = releaseSummary(analysisContext, risk, verdict);
    return bounded({
      schemaVersion: 1,
      mode: adapter.mode,
      subject: context.subject,
      verdict,
      topRisks: sortSignals(risk.signals).slice(0, 3),
      risk,
      checklist: buildChecklist(analysisContext, risk),
      experts: rankExperts(analysisContext, {now: generatedAt}),
      coverage: {...computeCoverage(context), ...context.coverage},
      counts: Object.fromEntries(COLLECTIONS.filter(name => !['people', 'teams'].includes(name))
        .map(name => [name, (context[name] ?? []).length])),
      generatedAt,
      disclaimer: adapter.mode === 'fixture'
        ? 'Demo data — fictional Northwind Pay evidence.'
        : 'Graph visibility depends on user permissions and connected tools; ' +
          'a low score is not a safety guarantee.'
    });
  };
  const issueContext = async key => adapter.getIssueContext(await adapter.resolveIssue(key));
  const releaseContext = async (projectKey, name) => {
    const version = await adapter.resolveVersion(projectKey, name);
    const issues = await adapter.getReleaseIssues(version.ari, version);
    const contexts = [];
    for (const issue of issues.slice(0, 25)) contexts.push(await issueContext(issue.key));
    const context = mergeContexts(contexts, {
      type: 'release', key: `${projectKey}:${name}`, name: `${projectKey} ${name}`
    });
    if (!issues.length || issues.length > 25 || version.possiblyTruncated) {
      for (const source of ['pullRequests', 'builds', 'deployments', 'pages', 'people']) {
        context.coverage[source] = {available: false,
          reason: issues.length ? 'release issue limit reached' : 'no release issues observed'};
      }
    }
    context.coverage.releaseIssues = issues.coverage ?? {available: true};
    return context;
  };
  return {
    analyzeIssue: async key => report(await issueContext(key)),
    analyzeRelease: async (projectKey, version) => report(await releaseContext(projectKey, version)),
    findExperts: async key => report(await issueContext(key)),
    releaseChecklist: async (projectKey, version, format = 'markdown') => {
      const result = report(await releaseContext(projectKey, version));
      const prefix = adapter.mode === 'fixture'
        ? 'Demo data — fictional Northwind Pay evidence.\n\n' : '';
      const markdown = format === 'markdown'
        ? prefix + toMarkdown(result.checklist, result.risk, result.subject, {maxLength: 1900}) : '';
      return bounded({mode: adapter.mode, markdown, items: result.checklist,
        verdict: result.verdict, subject: result.subject, topRisks: result.topRisks,
        summary: result.risk.summary, generatedAt: result.generatedAt});
    }
  };
}
