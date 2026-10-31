/** Human-facing rule descriptions and concrete remediation actions. */
const prName = object => `PR #${object.displayId ?? object.id} in ${object.repository || 'repository'}`;
const ageDays = (date, context) => Math.floor((new Date(context.now) - new Date(date)) / 86400000);

/** Describe one matched object with its human identifier. */
export function describeSignal(ruleId, object, context) {
  const titles = {
    "no-reviewers": () => `${prName(object)} has no reviewers`,
    "needs-work": () => `${prName(object)} has changes requested`,
    "unapproved": () => `${prName(object)} has no approving review`,
    "large-pr": () => `${prName(object)} changes ${object.linesChanged} lines`,
    "failed-build": () => `Build '${object.name ?? object.id}' failed for ${(object.issueKeys ?? []).join(', ')}`,
    "running-build": () => `Build '${object.name ?? object.id}' is still running`,
    "failed-preprod": () => `Pre-production deployment '${object.name ?? object.id}' ${object.state.toLowerCase()}`,
    "prod-rollback": () => {
      return `Production deployment '${object.name ?? object.id}' was rolled back ${ageDays(object.updatedAt, context)} days ago`;
    },
    "unfinished": () => `${object.key} (${object.priority}) is still ${object.status || 'unfinished'}`,
    "blocked": () => `${object.blockedIssueKey} is blocked by ${object.key} (open)`,
    "unassigned": () => `${object.key} has no assignee`,
    "no-preprod": () => `${object.key} has merged code without successful pre-production validation`,
    "repositories": () => `${object.key ?? context.subject?.key} spans at least three repositories`,
    "bus-factor": () => `${prName(object)} has no independent reviewer`,
    "no-team": () => `${object.key ?? context.subject?.key} has no observed owning team`,
    "stale-runbook": () => `Runbook '${object.title}' last updated ${ageDays(object.lastUpdatedAt, context)} days ago`,
    "changed-decision": () => `Decision '${object.title}' changed after linked code merged`,
    "no-runbook": () => `Production deployment '${object.name ?? object.id}' has no linked runbook`,
    "open-incident": () => `Open incident ${object.key} is linked to ${(object.linkedIssueKeys ?? []).join(', ')}`
  };
  return titles[ruleId]();
}

/** Turn a matched rule into an imperative, object-specific checklist action. */
export function actionForSignal(ruleId, object, context) {
  const actions = {
    "no-reviewers": `Get an approving review on PR #${object.displayId ?? object.id} (${object.repository})`,
    "needs-work": `Resolve requested changes on ${prName(object)}`,
    "unapproved": `Get an approving review on PR #${object.displayId ?? object.id} (${object.repository})`,
    "large-pr": `Check regression coverage for ${prName(object)}`,
    "failed-build": `Fix build '${object.name ?? object.id}'`,
    "running-build": `Wait for build '${object.name ?? object.id}' to complete`,
    "failed-preprod": `Investigate deployment '${object.name ?? object.id}'`,
    "prod-rollback": `Confirm recovery from production rollback '${object.name ?? object.id}'`,
    "unfinished": `Complete ${object.key} and verify acceptance criteria`,
    "blocked": `Resolve blocker ${object.key}`,
    "unassigned": `Assign an owner to ${object.key}`,
    "no-preprod": `Validate ${object.key} in pre-production`,
    "repositories": `Coordinate repository owners for ${object.key}`,
    "bus-factor": `Get an approving review on PR #${object.displayId ?? object.id} (${object.repository})`,
    "no-team": `Confirm the owning team for ${object.key}`,
    "stale-runbook": `Refresh runbook '${object.title}'`,
    "changed-decision": `Review decision '${object.title}' against merged code`,
    "no-runbook": `Link a runbook for '${object.name ?? object.id}'`,
    "open-incident": `Resolve incident ${object.key} before release`
  };
  return actions[ruleId];
}
