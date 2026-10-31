/** Resolve Jira subjects and release membership using an injected REST transport. */
export function createJiraRest({
  request,
  route,
  cloudId
}) {
  async function get(path, options) {
    const response = await request(path, options);
    if (response?.ok === false) {
      throw new Error('Jira request unavailable');
    }
    return typeof response?.json === 'function' ? response.json() : response;
  }
  const ari = (type, id) => {
    if (!cloudId) {
      throw new Error('Jira cloud context unavailable');
    }
    return `ari:cloud:jira:${cloudId}:${type}/${id}`;
  };
  return {
    async resolveIssue(key) {
      const issue = await get(
        route`/rest/api/3/issue/${key}?fields=summary,status,priority,issuetype,assignee,fixVersions,project,issuelinks`
      );
      const fields = issue.fields ?? {};
      return {
        id: issue.id,
        key: issue.key,
        ari: ari('issue', issue.id),
        summary: fields.summary,
        status: fields.status,
        priority: fields.priority,
        type: fields.issuetype?.name,
        issueType: fields.issuetype,
        assignee: fields.assignee
          ? {
            accountId: fields.assignee.accountId,
            name: fields.assignee.displayName
          }
          : null,
        url: `/browse/${issue.key}`,
        fixVersions: fields.fixVersions ?? [],
        // REST fallback for the NEEDS-LIVE graph `blockers` query: inward "Blocks" links.
        blockers: (fields.issuelinks ?? [])
          .filter(link => link?.type?.name === 'Blocks' && link.inwardIssue?.key)
          .map(link => ({
            key: link.inwardIssue.key,
            summary: link.inwardIssue.fields?.summary,
            status: link.inwardIssue.fields?.status
          })),
        projectKey: fields.project?.key
      };
    },
    async resolveVersion(projectKey, name) {
      const versions = await get(route`/rest/api/3/project/${projectKey}/versions`);
      const value = versions.find(v => v.name === name);
      if (!value) {
        throw new Error('Version not found');
      }
      const issueKeys = [];
      let nextPageToken;
      for (let page = 0; page < 4; page++) {
        const result = await get(
          route`/rest/api/3/search/jql`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              jql: `project = "${projectKey.replace(/["\\]/g, '')}" AND fixVersion = ${JSON.stringify(String(value.id))}`,
              fields: ['key'],
              maxResults: 25,
              ...(nextPageToken ? {
                nextPageToken
              } : {})
            })
          }
        );
        issueKeys.push(...(result.issues ?? []).map(issue => issue.key));
        if (result.isLast !== false && !result.nextPageToken) {
          break;
        }
        nextPageToken = result.nextPageToken;
        if (!nextPageToken) {
          break;
        }
      }
      return {
        versionId: value.id,
        ari: ari('version', value.id),
        name,
        projectKey,
        issueKeys,
        possiblyTruncated: issueKeys.length >= 100
      };
    }
  };
}
