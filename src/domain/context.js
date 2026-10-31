/** Merge issue neighborhoods into a release graph without duplicating shared evidence. */
import {emptyContext} from './model.js';
export const COLLECTIONS = [
  'issues', 'pullRequests', 'builds', 'deployments', 'pages', 'incidents', 'commits', 'people', 'teams'
];
const LINK_FIELDS = ['issueKeys', 'linkedIssueKeys', 'members'];

function mergeObject(previous, next) {
  if (!previous) return structuredClone(next);
  const merged = {...previous, ...next};
  for (const field of LINK_FIELDS) {
    if (previous[field] || next[field]) {
      merged[field] = [...new Set([...(previous[field] ?? []), ...(next[field] ?? [])])];
    }
  }
  return merged;
}

/** Deduplicate source objects, union links and preserve incomplete coverage reasons. */
export function mergeContexts(contexts, subject) {
  const merged = emptyContext(subject);
  for (const name of COLLECTIONS) {
    const rows = new Map();
    for (const context of contexts) {
      for (const object of context[name] ?? []) {
        const id = object.id ?? object.key ?? object.accountId;
        rows.set(id, mergeObject(rows.get(id), object));
      }
    }
    merged[name] = [...rows.values()];
  }
  const sources = new Set(contexts.flatMap(context => Object.keys(context.coverage ?? {})));
  for (const source of sources) {
    const states = contexts.map(context => context.coverage?.[source]);
    merged.coverage[source] = states.every(state => state?.available) ? {available: true} : {
      available: false,
      reason: states.find(state => !state?.available)?.reason ?? 'incomplete issue coverage'
    };
  }
  return merged;
}
