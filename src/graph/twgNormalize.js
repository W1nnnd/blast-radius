/** Translate verified TWG field shapes into the engine’s provider-neutral model. */
import { enumValue, person, list, pageKind } from '../domain/model.js';
const raw = record => ({
  ...record,
  ...record?.data
});
/** Normalize Jira graph or REST work-item fields into the domain model. */
export function normalizeIssue(node) {
  const record = raw(node);
  return {
    key: record.key ?? '',
    summary: record.summary ?? '',
    status: typeof record.status === 'string' ? record.status : record.status?.name ?? '',
    statusCategory: ['new', 'indeterminate', 'done'].includes(record.status?.statusCategory?.key?.toLowerCase())
      ? record.status.statusCategory.key.toLowerCase()
      : /done|closed|resolved/i.test(typeof record.status === 'string' ? record.status : record.status?.name ?? '')
        ? 'done'
        : 'indeterminate',
    labels: list(record.labels),
    fixVersions: list(record.fixVersions),
    priority: record.priority?.name ?? record.priority ?? '',
    type: record.issueType?.name ?? record.type ?? '',
    assignee: person(record.assignee),
    url: record.webUrl ?? record.url ?? ''
  };
}
/** Normalize pull requests and reviewer approval states without guessing diff size. */
export function normalizePR(node, key) {
  const record = raw(node);
  return {
    id: String(record.id ?? ''),
    displayId: String(record.displayId ?? ''),
    title: record.title ?? record.displayName ?? '',
    status: enumValue(record.status, ['OPEN', 'DRAFT', 'MERGED', 'DECLINED', 'UNKNOWN']),
    url: record.url ?? '',
    author: person(record.author ?? record.createdBy),
    reviewers: list(record.reviewers).map(reviewer => {
      return {
        person: person(reviewer.user),
        approvalStatus: enumValue(
          reviewer.approvalStatus,
          ['APPROVED', 'NEEDSWORK', 'UNAPPROVED'],
          'UNAPPROVED'
        )
      };
    }),
    linesChanged: null,
    repository: record.repositoryId ?? '',
    issueKeys: [key],
    updatedAt: record.lastUpdatedAt ?? ''
  };
}
/** Normalize build state, display name and issue association. */
export function normalizeBuild(node, key) {
  const record = raw(node);
  return {
    id: String(record.id ?? ''),
    name: record.displayName ?? '',
    state: enumValue(record.state, ['SUCCESSFUL', 'FAILED', 'IN_PROGRESS', 'CANCELLED', 'UNKNOWN']),
    url: record.url ?? '',
    issueKeys: [key],
    updatedAt: record.lastUpdatedAt ?? ''
  };
}
/** Normalize deployment state and environment classification. */
export function normalizeDeployment(node, key) {
  const record = raw(node);
  return {
    ...normalizeBuild(record, key),
    state: enumValue(
      record.state,
      [
        'SUCCESSFUL',
        'FAILED',
        'IN_PROGRESS',
        'PENDING',
        'ROLLED_BACK',
        'CANCELLED',
        'UNKNOWN'
      ]
    ),
    environmentType: enumValue(
      record.environment?.type,
      ['PRODUCTION', 'STAGING', 'TESTING', 'DEVELOPMENT', 'UNMAPPED'],
      'UNMAPPED'
    ),
    environmentName: record.environment?.displayName ?? ''
  };
}
/** Normalize linked documentation and classify its architectural role. */
export function normalizePage(node, key) {
  const record = raw(node);
  return {
    id: String(record.id ?? ''),
    title: record.title ?? '',
    url: record.webUrl ?? '',
    lastUpdatedAt: record.lastUpdatedAt ?? '',
    owner: person(record.owner),
    kind: pageKind(record.title ?? '', record.labels),
    linkedIssueKeys: [key]
  };
}
