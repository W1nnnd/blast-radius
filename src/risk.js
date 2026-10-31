/** Pure additive model. Each occurrence: unreviewed active PR +15, failing build
 * +20, failed deployment +20, diff >500 lines +10, open high priority issue +10,
 * missing owner +10 (only when there is change evidence), docs >90 days +5.
 * Unknown fields add nothing. Thresholds: medium >=30, high >=60. Clamp at 100.
 */
export function scoreRisk(context = {}) {
  const list = key => Array.isArray(context?.[key]) ? context[key] : [];
  const reasons = [], checklist = new Set();
  let score = 0;
  const add = (weight, reason, task) => { score += weight; reasons.push(reason); checklist.add(task); };
  const lower = value => String(value ?? '').toLowerCase();
  for (const pr of list('pullRequests')) {
    if (['open', 'in progress'].includes(lower(pr.state)) && pr.reviewers === 0)
      add(15, 'An open pull request has no reviewers.', 'Assign a reviewer and complete code review.');
    if (pr.linesChanged > 500) add(10, 'A pull request changes more than 500 lines.', 'Review large diffs and confirm regression coverage.');
  }
  for (const build of list('builds')) if (['failed', 'failing', 'failure'].includes(lower(build.state)))
    add(20, 'A linked build is failing.', 'Resolve failing builds before releasing.');
  for (const deployment of list('deployments')) if (['failed', 'failure'].includes(lower(deployment.state)))
    add(20, 'A linked deployment failed.', 'Investigate failed deployments and confirm rollback readiness.');
  for (const issue of list('issues')) if (['highest', 'high', 'critical', 'blocker'].includes(lower(issue.priority)) && issue.status && !['done', 'closed', 'resolved'].includes(lower(issue.status)))
    add(10, `High-priority issue ${issue.key || '(unknown key)'} is still open.`, 'Resolve or explicitly accept open high-priority issues.');
  const hasEvidence = ['issues', 'pullRequests', 'deployments', 'builds', 'pages'].some(key => list(key).length);
  if (hasEvidence && !list('owners').some(owner => owner?.id))
    add(10, 'No release owner was found.', 'Confirm a release owner and escalation contact.');
  for (const page of list('pages')) if (page.lastUpdatedDaysAgo > 90)
    add(5, `Documentation is older than 90 days: ${page.title || '(untitled)'}.`, 'Refresh stale documentation and confirm recorded decisions.');
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, level: score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low', reasons, checklist: [...checklist] };
}
