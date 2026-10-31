/** Declarative risk rules over normalized graph context; category caps bound the score. */
import { evidence } from '../domain/model.js';
import { computeCoverage } from './coverage.js';
import { MATCHERS } from './ruleMatches.js';
import { describeSignal, actionForSignal } from './signalText.js';
export const CATEGORIES = [
  ['code_review', 'Code review', 25],
  ['ci', 'Continuous integration', 20],
  ['deployment', 'Deployment', 20],
  ['scope', 'Scope', 15],
  ['ownership', 'Ownership', 10],
  ['knowledge', 'Knowledge', 10]
].map(([id, label, max]) => ({
  id,
  label,
  max
}));

// The factory supplies presentation functions; each table row declares its scoring contract.
function rule(id, category, severity, points, type) {
  return {
    id,
    category,
    severity,
    points,
    applies: context => MATCHERS[id](context).map(object => ({
      object,
      context
    })),
    title: match => describeSignal(id, match.object, match.context),
    detail: () => DETAILS[id],
    evidence: match => [evidence(type, match.object)],
    checklist: match => actionForSignal(id, match.object, match.context)
  };
}
const DETAILS = {
  "no-reviewers": 'Independent review is needed to catch defects before merge.',
  "needs-work": 'Requested changes remain unresolved and may indicate correctness problems.',
  "unapproved": 'An approving review is needed before this change is ready to ship.',
  "large-pr": 'A large diff increases review complexity and regression exposure.',
  "failed-build": 'Failing validation prevents confidence that the change works as intended.',
  "running-build": 'Validation has not finished, so its final result is still unknown.',
  "failed-preprod": 'The change has not demonstrated a successful deployment before production.',
  "prod-rollback": 'Recent recovery failure warrants checking the rollback cause before shipping again.',
  "unfinished": 'Incomplete scope may prevent the release from meeting acceptance criteria.',
  "blocked": 'An unresolved dependency can prevent the planned work from being completed.',
  "unassigned": 'Unowned work lacks a clear person responsible for completion.',
  "no-preprod": 'Merged code needs deployment validation before production exposure.',
  "repositories": 'Changes across repositories require coordinated sequencing and ownership.',
  "bus-factor": 'Concentrated authorship leaves no independent reviewer of the implementation.',
  "no-team": 'A release needs an accountable team for operational follow-through.',
  "stale-runbook": 'Outdated recovery instructions may delay incident response.',
  "changed-decision": 'Merged implementation may no longer reflect the current architectural decision.',
  "no-runbook": 'Production responders need documented recovery and operating procedures.',
  "open-incident": 'An active incident may worsen if related changes are released.'
};
/** Enumerated rules expose predicates, scoring, evidence and remediation to consumers. */
export const RULES = [
  rule('no-reviewers', 'code_review', 'warning', 12, 'pullRequest'),
  rule('needs-work', 'code_review', 'warning', 10, 'pullRequest'),
  rule('unapproved', 'code_review', 'warning', 6, 'pullRequest'),
  rule('large-pr', 'code_review', 'warning', 5, 'pullRequest'),
  rule('failed-build', 'ci', 'blocker', 15, 'build'),
  rule('running-build', 'ci', 'warning', 4, 'build'),
  rule('failed-preprod', 'deployment', 'warning', 12, 'deployment'),
  rule('prod-rollback', 'deployment', 'blocker', 15, 'deployment'),
  rule(
    'unfinished',
    'scope',
    'warning',
    match => /^(high|highest|critical|blocker)$/i.test(match.object.priority) ? 6 : 3,
    'issue'
  ),
  rule('blocked', 'scope', 'warning', 5, 'issue'),
  rule('unassigned', 'ownership', 'warning', 3, 'issue'),
  rule('no-preprod', 'deployment', 'warning', 6, 'issue'),
  rule('repositories', 'scope', 'warning', 5, 'issue'),
  rule('bus-factor', 'ownership', 'warning', 5, 'pullRequest'),
  rule('no-team', 'ownership', 'warning', 2, 'issue'),
  rule('stale-runbook', 'knowledge', 'warning', 5, 'page'),
  rule('changed-decision', 'knowledge', 'warning', 3, 'page'),
  rule('no-runbook', 'knowledge', 'warning', 4, 'deployment'),
  rule('open-incident', 'deployment', 'blocker', 10, 'incident')
];
/** Evaluate every rule and cap contributions within each risk category. */
export function scoreRisk(context = {}, {
  now = new Date()
} = {}) {
  const normalizedContext = {
    ...context,
    ...Object.fromEntries([
      'issues',
      'pullRequests',
      'builds',
      'deployments',
      'pages',
      'incidents',
      'teams'
    ].map(key => [key, context[key] ?? []])),
    now
  };
  const categories = CATEGORIES.map(category => ({
    ...category,
    points: 0,
    signals: []
  }));
  const signals = [];
  for (const rule of RULES) {
    for (const match of rule.applies(normalizedContext)) {
      match.context = normalizedContext;
      const object = match.object;
      const key = object.key ?? object.displayId ?? object.name ?? object.title ?? object.id ??
        'context';
      const signal = {
        id: `${rule.id === 'blocked' ? `blocked-${object.blockedIssueKey}` : rule.id}:${key}`,
        category: rule.category,
        severity: rule.severity,
        points: typeof rule.points === 'function' ? rule.points(match) : rule.points,
        title: rule.title(match),
        detail: rule.detail(match),
        evidence: rule.evidence(match),
        action: rule.checklist(match)
      };
      signals.push(signal);
      const category = categories.find(category => category.id === rule.category);
      category.points = Math.min(category.max, category.points + signal.points);
      category.signals.push(signal.id);
    }
  }
  const score = categories.reduce((total, category) => total + category.points, 0);
  const blockers = signals.filter(signal => signal.severity === 'blocker').map(signal => signal.id);
  const level = score >= 60 ? blockers.length ? 'critical' : 'high' : score >= 30 ? 'medium' : 'low';
  const {
    confidence
  } = computeCoverage(context);
  return {
    score,
    level,
    confidence,
    categories,
    signals,
    blockers,
    summary: confidence === 'low'
      ? 'Evidence is incomplete.'
      : `Observed release risk is ${level} (${score}/100).`
  };
}
