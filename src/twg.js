import api from '@forge/api';
import { parseColumns } from './parse.js';
export { parseColumns } from './parse.js';

// VERIFY relationship names in https://teamwork-graph.atlassian.com/query-builder before deploy
// These Cypher labels, properties and relationships are illustrative skeleton assumptions.
// Official docs use labels like AtlassianUser / AtlassianTeam and snake_case relationships such as
// atlassian_user_is_in_atlassian_team; replace the placeholders below with the verified names.
const TRAVERSAL = `
OPTIONAL MATCH (issue)-[:HAS_PULL_REQUEST]->(pr:PullRequest)
OPTIONAL MATCH (pr)-[:HAS_COMMIT]->(commit:Commit)
OPTIONAL MATCH (commit)-[:HAS_BUILD]->(build:Build)
OPTIONAL MATCH (build)-[:HAS_DEPLOYMENT]->(deployment:Deployment)
OPTIONAL MATCH (issue)-[:DOCUMENTED_BY]->(page:Page)
OPTIONAL MATCH (page)-[:HAS_DECISION]->(decision:Page)
OPTIONAL MATCH (issue)-[:OWNED_BY]->(owner:User)
OPTIONAL MATCH (owner)-[:MEMBER_OF]->(team:Team)
RETURN collect(DISTINCT issue) AS issues, collect(DISTINCT pr) AS pullRequests,
collect(DISTINCT commit) AS commits, collect(DISTINCT build) AS builds,
collect(DISTINCT deployment) AS deployments, collect(DISTINCT page) AS pages,
collect(DISTINCT decision) AS decisions, collect(DISTINCT owner) AS owners,
collect(DISTINCT team) AS teams LIMIT 25`;
export const CHANGE_CONTEXT_QUERY = `MATCH (issue:Issue {key: $issueKey}) ${TRAVERSAL}`;
export const RELEASE_RISK_QUERY = `MATCH (project:Project {key: $projectKey})-[:HAS_VERSION]->(version:Version {name: $versionName})<-[:FIX_VERSION]-(issue:Issue) ${TRAVERSAL}`;
export const EXPERTS_QUERY = CHANGE_CONTEXT_QUERY;

// Confirm the schema and params scalar in the query builder alongside the Cypher model.
export const GRAPHQL_QUERY = `query blastRadius_context($cypherQuery: String!, $params: CypherRequestParams) {
  cypherQuery(query: $cypherQuery, params: $params) {
    edges { node { columns { key value {
      __typename
      ... on CypherQueryResultListNode { nodes { id data { __typename } } }
    } } } }
  }
}`;

/** User-context requests respect the invoking user's graph access. Never fall back to app access. */
export async function requestTwg(query, variables = {}) {
  const response = await api.asUser().requestTeamworkGraph(query, variables);
  const json = typeof response?.json === 'function' ? await response.json() : response;
  if (response?.ok === false || json?.errors?.length) throw new Error('Teamwork Graph request failed. Verify graph access and query schema.');
  return parseColumns(json);
}

export async function getGraphContext(cypher, params) {
  const columns = await requestTwg(GRAPHQL_QUERY, { cypherQuery: cypher, params });
  // The minimal selection above provides IDs/types only. Add verified schema fields
  // to data fragments before expecting status, reviewers, titles, or timestamps.
  return Object.fromEntries(Object.entries(columns).map(([key, nodes]) => [key,
    nodes.slice(0, 25).map(node => ({ ...node.data, id: node.id }))]));
}
