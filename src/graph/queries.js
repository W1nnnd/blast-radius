/** Verified TWG query contracts; union fragments still require live schema validation. */
const userFields = '... on AtlassianUser { id accountId name }';
const issueFields = `
  id key summary status { name statusCategory { key } }
  assignee { ${userFields} } issueType { name } webUrl
`;
export const FIELDS = {
  pullRequests: `
    jiraWorkItemLinkedExternalPullRequests(id: $id, first: $first, after: $after) {
      edges { node { ... on ExternalPullRequest {
        id displayId title status url lastUpdatedAt repositoryId
        author { ${userFields} }
        reviewers { approvalStatus user { ${userFields} } }
      } } }
      pageInfo { hasNextPage endCursor }
    }
  `,
  deployments: `
    jiraWorkItemLinkedExternalDeployments(id: $id, first: $first, after: $after) {
      edges { node { ... on ExternalDeployment {
        id displayName state url lastUpdatedAt environment { displayName type }
      } } }
      pageInfo { hasNextPage endCursor }
    }
  `,
  // AtlassianTeam union selection is NEEDS-LIVE; no other team fields are assumed.
  people: `
    atlassianUserInTeams(userId: $id, first: $first, after: $after) {
      edges { node { ... on AtlassianTeam { id name } } }
      pageInfo { hasNextPage endCursor }
    }
  `
};

/** Build a curated query using only fields in the verified schema catalog. */
export const curatedQuery = source => `
  query BlastRadius_${source}($id: ID!, $first: Int!, $after: String) {
    ${FIELDS[source]}
  }
`;

export const CUSTOM_QUERY = `
  query BlastRadiusPersisted(
    $queryKey: String!, $queryParams: CypherRequestParams, $first: Int!, $after: String
  ) {
    customQuery(queryKey: $queryKey, queryParams: $queryParams, first: $first, after: $after) {
      edges { node { columns { key value {
        __typename
        ... on CypherQueryResultListNode { nodes { id data {
          __typename
          ... on ExternalBuild { id displayName state url lastUpdatedAt }
          ... on JiraWorkItem { ${issueFields} }
          ... on ConfluencePage { id title webUrl lastUpdatedAt owner { ${userFields} } }
          ... on ExternalCommit { __typename }
        } } }
      } } } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const relationshipDocs =
  'https://developer.atlassian.com/platform/teamwork-graph/api-reference/relationship-types/';

function entry(name, relationship, cypher, status = 'VERIFIED-DOC') {
  return {
    name,
    cypher: cypher.trim(),
    paramsSchema: [{name: 'id', type: 'ARI', required: true}],
    status,
    docUrl: `${relationshipDocs}${relationship.replaceAll('_', '-')}/`
  };
}

export const PERSISTED_QUERIES = [
  entry('builds', 'jira_work_item_links_external_build', `
    MATCH (item:JiraWorkItem {ari: $id})-[:jira_work_item_links_external_build]->(build:ExternalBuild)
    RETURN collect(distinct build) as builds
  `),
  entry('commits', 'jira_work_item_links_external_commit', `
    MATCH (item:JiraWorkItem {ari: $id})-[:jira_work_item_links_external_commit]->(commit:ExternalCommit)
    RETURN collect(distinct commit) as commits
  `),
  entry('blockers', 'jira_work_item_blocks_jira_work_item', `
    MATCH (item:JiraWorkItem {ari: $id})<-[:jira_work_item_blocks_jira_work_item]-(blocker:JiraWorkItem)
    RETURN collect(distinct blocker) as blockers
  `, 'NEEDS-LIVE'),
  entry('pages', 'content_entity_links_entity', `
    MATCH (page:ConfluencePage)-[:content_entity_links_entity]->(item:JiraWorkItem {ari: $id})
    RETURN collect(distinct page) as pages
  `, 'NEEDS-LIVE'),
  entry('releaseIssues', 'jira_version_links_jira_work_item', `
    MATCH (version:JiraVersion {ari: $id})-[:jira_version_links_jira_work_item]->(item:JiraWorkItem)
    RETURN collect(distinct item) as items
  `),
  entry('incidents', 'jsm_incident_links_jira_work_item', `
    MATCH (incident:JiraWorkItem)-[:jsm_incident_links_jira_work_item]->(item:JiraWorkItem {ari: $id})
    RETURN collect(distinct incident) as incidents
  `, 'NEEDS-LIVE')
];
export const PERSISTED_QUERIES_DOC_URL =
  'https://developer.atlassian.com/platform/teamwork-graph/persisted-cypher-queries/';
