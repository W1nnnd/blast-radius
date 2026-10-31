import Resolver from '@forge/resolver';
import { getGraphContext, CHANGE_CONTEXT_QUERY, RELEASE_RISK_QUERY, EXPERTS_QUERY } from './twg.js';
import { scoreRisk } from './risk.js';

function input(payload, key) {
  const value = payload?.[key];
  if (typeof value !== 'string' || !value.trim() || value.length > 255)
    throw new Error(`${key} must be a non-empty string of at most 255 characters.`);
  return value.trim();
}
// Bound every list and string as well as total output; never return a raw graph response.
function bounded(value) {
  const clean = item => {
    if (typeof item === 'string') return item.slice(0, 2000);
    if (Array.isArray(item)) return item.slice(0, 25).map(clean);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, clean(v)]));
    return item;
  };
  const result = clean(value);
  if (JSON.stringify(result).length > 500000) throw new Error('Graph result exceeded the response limit.');
  return result;
}
const report = graph => bounded({ ...graph, risk: scoreRisk(graph),
  experts: graph.owners || [], empty: !Object.values(graph).some(nodes => nodes.length),
  limitations: 'Skeleton queries return IDs and types only. Risk inputs require verified graph field mappings; a low score does not establish release safety.' });

export async function getChangeContext(payload, context) {
  return report(await getGraphContext(CHANGE_CONTEXT_QUERY, { issueKey: input(payload, 'issueKey') }));
}
export async function scoreReleaseRisk(payload, context) {
  return report(await getGraphContext(RELEASE_RISK_QUERY, {
    versionName: input(payload, 'versionName'), projectKey: input(payload, 'projectKey'),
  }));
}
export async function findExperts(payload, context) {
  const graph = await getGraphContext(EXPERTS_QUERY, { issueKey: input(payload, 'issueKey') });
  return bounded({ experts: graph.owners || [], teams: graph.teams || [],
    issues: graph.issues || [], pages: graph.pages || [], empty: !graph.owners?.length });
}
const resolver = new Resolver();
resolver.define('getPanelData', async ({ context }) => {
  const issueKey = context?.extension?.issue?.key;
  return getChangeContext({ issueKey }, context);
});
export const handler = resolver.getDefinitions();
