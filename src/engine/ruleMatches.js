/** Pure predicates selecting the objects to which each release-risk rule applies. */
const active = request => ['OPEN', 'DRAFT'].includes(request.status);
const preproduction = deployment => ['STAGING', 'TESTING'].includes(deployment.environmentType);
const age = (date, now) => (new Date(now) - new Date(date)) / 86400000;
const anchor = context => context.issues[0] ?? context.pullRequests[0] ??
  {
    key: context.subject?.key ?? 'context'
  };
const mergedFor = (context, key) => {
  return context.pullRequests.filter(request => request.status === 'MERGED' && request.issueKeys?.includes(key));
};

/** Select matching source objects in stable source order. */
export const MATCHERS = {
  "no-reviewers": context => context.pullRequests.filter(request => active(request) && !request.reviewers?.length),
  "needs-work": context => {
    return context.pullRequests.filter(request => request.reviewers?.some(reviewer => reviewer.approvalStatus === 'NEEDSWORK'));
  },
  "unapproved": context => {
    return context.pullRequests.filter(request => {
      return active(request) && request.reviewers?.length &&
        !request.reviewers.some(reviewer => reviewer.approvalStatus === 'APPROVED');
    });
  },
  "large-pr": context => context.pullRequests.filter(request => request.linesChanged > 500),
  "failed-build": context => context.builds.filter(build => build.state === 'FAILED'),
  "running-build": context => context.builds.filter(build => build.state === 'IN_PROGRESS'),
  "failed-preprod": context => {
    return context.deployments.filter(deployment => preproduction(deployment) &&
      ['FAILED', 'ROLLED_BACK'].includes(deployment.state));
  },
  "prod-rollback": context => {
    return context.deployments.filter(deployment => {
      return deployment.environmentType === 'PRODUCTION' &&
        deployment.state === 'ROLLED_BACK' &&
        age(deployment.updatedAt, context.now) >= 0 &&
        age(deployment.updatedAt, context.now) <= 30;
    });
  },
  "unfinished": context => context.issues.filter(issue => issue.statusCategory !== 'done'),
  "blocked": context => {
    return context.issues.flatMap(issue => {
      return (issue.blockers ?? []).filter(blocker => blocker.statusCategory !== 'done').map(blocker => ({
        ...blocker,
        blockedIssueKey: issue.key
      }));
    });
  },
  "unassigned": context => context.issues.filter(issue => !issue.assignee),
  "no-preprod": context => {
    return context.issues.filter(issue => {
      return mergedFor(context, issue.key).length &&
        !context.deployments.some(deployment => {
          return preproduction(deployment) && deployment.state === 'SUCCESSFUL' &&
            deployment.issueKeys?.includes(issue.key);
        });
    });
  },
  "repositories": context => {
    return new Set(context.pullRequests.map(request => request.repository).filter(Boolean)).size >= 3
      ? [anchor(context)]
      : [];
  },
  "bus-factor": context => {
    const authors = new Set(context.pullRequests.map(request => request.author?.accountId).filter(Boolean));
    const independent = context.pullRequests.some(request => {
      return request.reviewers?.some(reviewer => reviewer.person?.accountId && !authors.has(reviewer.person.accountId));
    });
    return context.pullRequests.length && authors.size === 1 && !independent
      ? context.pullRequests.filter(request => active(request) &&
        !request.reviewers?.some(reviewer => reviewer.approvalStatus === 'APPROVED')).slice(0, 1)
      : [];
  },
  "no-team": context => context.teams.length ? [] : [anchor(context)],
  "stale-runbook": context => context.pages.filter(page => page.kind === 'runbook' && age(page.lastUpdatedAt, context.now) > 90),
  "changed-decision": context => {
    return context.pages.filter(page => {
      const merged = context.pullRequests.filter(request => request.status === 'MERGED' &&
        request.issueKeys?.some(key => page.linkedIssueKeys?.includes(key)));
      return page.kind === 'decision' && /superseded|deprecated/i.test(page.title) &&
        merged.length &&
        new Date(page.lastUpdatedAt) > Math.max(...merged.map(request => new Date(request.updatedAt)));
    });
  },
  "no-runbook": context => {
    return context.pages.some(page => page.kind === 'runbook')
      ? []
      : context.deployments.filter(deployment => deployment.environmentType === 'PRODUCTION').slice(
        0,
        1
      );
  },
  "open-incident": context => context.incidents.filter(incident => !/^(done|closed|resolved)$/i.test(incident.status))
};
