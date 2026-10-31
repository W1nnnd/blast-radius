/** Normalized evidence and identity helpers shared by all graph adapters. */
/** Return an array or an empty list for an unknown collection. */
export const list = value => Array.isArray(value) ? value : [];
/** Normalize a user identity without inventing account identifiers. */
export const person = value => value
  ? {
    accountId: String(value.accountId ?? value.id ?? ''),
    name: String(value.name ?? 'Unknown')
  }
  : null;
/** Normalize a known state, preserving unknown values as the fallback. */
export const enumValue = (value, values, fallback = 'UNKNOWN') => values.includes(String(value).toUpperCase())
  ? String(value).toUpperCase()
  : fallback;
/** Classify linked documentation from its title and labels. */
export const pageKind = (title, labels = []) => {
  const text = [title, ...list(labels)].join(' ');
  return /runbook|playbook/i.test(text)
    ? 'runbook'
    : /\bADR\b|decision/i.test(text)
      ? 'decision'
      : /design|RFC/i.test(text) ? 'design' : 'other';
};
/** Build a human-readable link to the source object. */
export const evidence = (type, object) => {
  return {
    type,
    id: String(object.id ?? object.key ?? 'unknown'),
    label: type === 'pullRequest'
      ? `#${object.displayId ?? object.id} ${object.title ?? ''}`.trim()
      : String(object.name ?? object.title ?? object.key ?? object.summary ?? object.id ?? type),
    ...(object.url ? {
      url: object.url
    } : {})
  };
};
/** Create an empty normalized graph neighborhood for a subject. */
export function emptyContext(subject) {
  return {
    subject,
    issues: [],
    pullRequests: [],
    builds: [],
    deployments: [],
    pages: [],
    incidents: [],
    commits: [],
    teams: [],
    people: [],
    coverage: {}
  };
}
