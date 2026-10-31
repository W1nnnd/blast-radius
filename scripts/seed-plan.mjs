/** Pure offline seed planning for Jira issues, versions and Confluence pages. */
/** Build a deterministic offline plan for demo Jira and Confluence objects. */
export function planSeed(dataset, {
  space = 'PAYDOCS'
} = {}) {
  return [
    {
      method: 'GET',
      path: '/rest/api/3/project/PAY',
      kind: 'project',
      summary: 'Ensure PAY exists; create Scrum software project in UI if absent'
    },
    ...dataset.versions.map(version => {
      return {
        method: 'POST',
        path: '/rest/api/3/version',
        kind: 'version',
        seedId: version.id,
        body: {
          name: version.name,
          project: 'PAY'
        },
        summary: `Ensure version ${version.name}`
      };
    }),
    ...dataset.issues.map(issue => {
      return {
        method: 'POST',
        path: '/rest/api/3/issue',
        kind: 'issue',
        seedId: issue.key,
        issue: issue,
        summary: `Ensure ${issue.key}: ${issue.summary}`
      };
    }),
    ...dataset.issues.flatMap(issue => {
      return (issue.blockers ?? []).map(blocker => {
        return {
          method: 'POST',
          path: '/rest/api/3/issueLink',
          kind: 'link',
          from: blocker.key,
          to: issue.key,
          summary: `${blocker.key} blocks ${issue.key}`
        };
      });
    }),
    ...dataset.pages.map(page => {
      return {
        method: 'POST',
        path: '/wiki/api/v2/pages',
        kind: 'page',
        seedId: page.id,
        page: page,
        space,
        summary: `Ensure page: ${page.title}`
      };
    }),
    ...dataset.pullRequests.flatMap(page => {
      return page.issueKeys.map(key => {
        return {
          method: 'POST',
          path: `/rest/api/3/issue/${key}/remotelink`,
          kind: 'remote',
          issueKey: key,
          pr: page,
          summary: `Link PR #${page.displayId} to ${key}`
        };
      });
    })
  ];
}
