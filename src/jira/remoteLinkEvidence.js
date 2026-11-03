import {dedupePages} from '../graph/pageIdentity.js';
import {normalizePR, normalizeBuild, normalizeDeployment, normalizePage} from '../graph/twgNormalize.js';

export const REMOTE_LINK_LABEL = 'Jira remote link (not Teamwork Graph)';
/** Remote links are explicit fallback evidence, never represented as graph connector data. */
export function remoteLinkEvidence(links = [], key) {
  const result = {pullRequests: [], builds: [], deployments: [], pages: []};
  for (const link of links) {
    const object = link.object ?? {};
    const url = object.url ?? '';
    const text = `${link.relationship ?? ''} ${object.title ?? ''} ${object.summary ?? ''}`;
    const id = String(link.globalId ?? link.id ?? url);
    const resolved = object.status?.resolved === true;
    const state = /fail(?:ed|ing|ure)/i.test(text) ? 'FAILED' : resolved ? 'SUCCESSFUL' : 'UNKNOWN';
    let source, item;
    if (/pull request/i.test(text) || /(?:github|bitbucket|gitlab).*\/(?:pull|pulls|pull-requests|merge_requests)\//i.test(url)) {
      source = 'pullRequests';
      const match = url.match(/^https?:\/\/[^/]+\/(.+?)(?:\/-)?\/(?:pull|pulls|pull-requests|merge_requests)\/(\d+)/i);
      const approvals = Number(text.match(/\b(\d+)\s+approvals?\b/i)?.[1] ?? 0);
      const reviewers = Array.from({length: approvals || (/\bapproved\b/i.test(text) ? 1 : 0)},
        () => ({approvalStatus: 'APPROVED'}));
      if (/changes requested/i.test(text)) reviewers.push({approvalStatus: 'NEEDSWORK'});
      item = normalizePR({id, displayId: match?.[2],
        title: (object.title ?? '').replace(/^(?:GitHub\s+)?PR\s*#\d+\s*:?\s*/i, ''),
        url, status: resolved || /\bmerged\b/i.test(text) ? 'MERGED' : 'OPEN',
        reviewers, repositoryId: match?.[1] ?? ''}, key);
    } else if (/deployment/i.test(text) || /deploy/i.test(url)) {
      source = 'deployments';
      const type = /staging/i.test(text) ? 'STAGING' : /production|\bprod\b/i.test(text) ? 'PRODUCTION' : 'UNMAPPED';
      item = normalizeDeployment({id, displayName: object.title, url, state,
        environment: {type, displayName: type.toLowerCase()}}, key);
    } else if (/\bbuild\b/i.test(text) || /actions\/runs|pipelines|builds/i.test(url)) {
      source = 'builds';
      item = normalizeBuild({id, displayName: object.title, url, state}, key);
    } else if (/confluence|\/wiki\//i.test(`${url} ${link.application?.name ?? ''}`)) {
      source = 'pages';
      item = normalizePage({id, title: object.title, webUrl: url}, key);
    }
    if (item && (source === 'pages' || !result[source].some(existing => existing.url === url))) {
      result[source].push({...item, source: 'jira-remote-link', evidenceLabel: REMOTE_LINK_LABEL});
    }
  }
  result.pages = dedupePages(result.pages);
  return result;
}
