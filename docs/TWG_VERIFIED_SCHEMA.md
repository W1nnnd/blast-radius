# Teamwork Graph — schema facts verified against official public docs

Fetched 2026-10-31 ~22:15 SGT from developer.atlassian.com/platform/teamwork-graph (raw copies in ../../official_docs/twg/).
Status legend: **VERIFIED-DOC** = name/shape appears verbatim in official docs; **NEEDS-LIVE** = must be confirmed
in the Query Builder / schema SDL (`GET https://<site>.atlassian.net/gateway/api/graphql/twg/schema`) on a real site.

## Critical platform change (VERIFIED-DOC)
- `migrate-from-raw-cypher` (updated 2026-09-15): "Raw `cypherQuery` is unavailable to new apps." New apps must use
  **curated queries** (typed GraphQL fields, max `first: 25`) or **persisted Cypher queries** registered via
  `POST https://<site>.atlassian.net/gateway/api/twg/cypher-queries` (body: appId, name, cypher, paramsSchema) and executed
  with `customQuery(queryKey:, queryParams:, first:)` which returns the same `CypherQueryConnection` shape.
- Registration is idempotent (same text → same queryKey, 200), propagation ≈ 1 minute (`QUERY_NOT_FOUND` meanwhile, retry).
- Only an app contributor can register; only the owning app can execute.
- Missing scope = silently empty rows (fail closed). An empty result is ambiguous → we report "unknown/coverage", never "safe".

## Curated queries used (VERIFIED-DOC: names + arguments from the catalog table)
| Field | Args | Returns |
|---|---|---|
| jiraWorkItemLinkedExternalPullRequests | id: ID! (issue ARI) | ExternalPullRequest |
| jiraWorkItemLinkedExternalDeployments | id: ID! | ExternalDeployment |
| atlassianUserInTeams | userId: ID! | AtlassianTeam |
| confluencePageOwners | id: ID! | users |
| atlassianTeamMembers | teamAri: ID! | users |
| jiraSpaceWorkItems | spaceAri: ID! | JiraWorkItem |
All accept `first` (≤25) and `after`; connection = edges{node} + pageInfo{hasNextPage endCursor}; node is a union → inline fragments.
NEEDS-LIVE: exact union member type names on the user-returning fields (we select `... on AtlassianUser { id name accountId }`).

## Relationship types used in persisted Cypher (VERIFIED-DOC: each has its own reference page with this exact Cypher example)
| Relationship | From → To |
|---|---|
| jira_version_links_jira_work_item | JiraVersion → JiraWorkItem |
| jira_space_has_jira_release_version | JiraSpace → JiraVersion |
| jira_work_item_links_external_build | JiraWorkItem → ExternalBuild |
| jira_work_item_links_external_commit | JiraWorkItem → ExternalCommit |
| external_pull_request_has_external_commit | ExternalPullRequest → ExternalCommit |
| jira_work_item_blocks_jira_work_item | JiraWorkItem → JiraWorkItem |
| jsm_incident_links_jira_work_item | (incident) JiraWorkItem → JiraWorkItem |
| atlassian_user_is_in_atlassian_team | AtlassianUser → AtlassianTeam |
| atlassian_user_reviewed_pull_requests | AtlassianUser → ExternalPullRequest |
| atlassian_user_created_pull_requests | AtlassianUser → ExternalPullRequest |
| atlassian_user_created_commits | AtlassianUser → ExternalCommit |
| atlassian_user_assigned_jira_work_item | AtlassianUser → JiraWorkItem |
| atlassian_user_owns_confluence_page | AtlassianUser → ConfluencePage |
| content_entity_links_entity | ConfluencePage/Blogpost/Comment → (Object Resolver types incl. JiraWorkItem) |
| jira_work_item_has_jira_priority | JiraWorkItem → JiraWorkItemPriority |
Node match pattern in docs: `(x:Label {ari: $id})`.
NEEDS-LIVE: `jira_work_item_links_external_pull_request` (appears in search index + connector table, its reference page now 404s → we use the curated field instead);
`jira_work_item_links_external_deployment` (connector table lists "Jira work item links external deployment"; no reference page → curated field instead);
direction of `content_entity_links_entity` for page→issue; whether persisted Cypher allows `collect()` with OPTIONAL MATCH chains (we keep each persisted query to one hop to stay safe).

## Object fields (VERIFIED-DOC from object-type pages)
- ExternalPullRequest: id, displayId, title, displayName, status (OPEN|DRAFT|MERGED|DECLINED|UNKNOWN), url, createdAt, lastUpdatedAt,
  author/createdBy (User), reviewers [ExternalReviewer{ approvalStatus (APPROVED|NEEDSWORK|UNAPPROVED), user }], commentCount, repositoryId, provider{name}
- ExternalDeployment: id, displayName, state (SUCCESSFUL|FAILED|IN_PROGRESS|PENDING|ROLLED_BACK|CANCELLED|UNKNOWN), environment{displayName type(PRODUCTION|STAGING|TESTING|DEVELOPMENT|UNMAPPED)},
  url, lastUpdatedAt, owners [User], pipeline{displayName}
- ExternalBuild: id, displayName, buildNumber, state (String: SUCCESSFUL|FAILED|IN_PROGRESS|CANCELLED…), url, lastUpdatedAt, createdBy
- JiraWorkItem: id, key, summary, status{name statusCategory{key}}, assignee, reporter, issueType{name}, webUrl, resolvedAt, dueAt
- JiraVersion: id, name, status (RELEASED|UNRELEASED|ARCHIVED), releasedAt, overdue
- ConfluencePage: id, title, webUrl, lastUpdatedAt, owner, author, lastEditor, space{key name}
- AtlassianUser: id, accountId, name, email
NEEDS-LIVE: the concrete type behind `User` (assumed union incl. AtlassianUser), JiraWorkItem priority field (not on object → via relationship jira_work_item_has_jira_priority or Jira REST).

## Scopes (VERIFIED-DOC: scope reference table, pattern read:graph:<object>:<product>; cap 50 scopes)
read:graph:issue:jira, read:graph:project:jira, read:graph:version:jira, read:graph:priority:jira, read:graph:issue-status:jira,
read:graph:page:confluence, read:graph:user:atlassian, read:graph:team:atlassian,
read:graph:pull-request:external, read:graph:commit:external, read:graph:build:external, read:graph:deployment:external
(EAP-wide read:graph:jira / read:graph:confluence are being retired.)

## ARIs
- Issue: `ari:cloud:jira:{cloudId}:issue/{issueId}` (VERIFIED-DOC example `ari:cloud:jira:abc123-def456:issue/10001`)
- User: `ari:cloud:identity::user/{accountId}` (VERIFIED-DOC)
- Version: `ari:cloud:jira:{cloudId}:version/{versionId}` (NEEDS-LIVE; follows the same pattern, ATI ati:cloud:jira:version)
- Project/space: `ari:cloud:jira:{cloudId}:project/{projectId}` (NEEDS-LIVE)

## Replaceable adapter layer — items that cannot be verified without a live site
All graph access goes through one interface (`src/graph/adapter.js`):
`resolveIssue(key)`, `resolveVersion(projectKey, name)`, `getIssueContext({key, ari})`, `getReleaseIssues(versionAri, versionRef)`.
Two implementations exist: `twgAdapter.js` (Teamwork Graph) and `fixtureAdapter.js` (demo data). The engines
(`src/engine/*`) only see the normalized domain model, so swapping a query never touches scoring.

| # | Item | Where | Status | If live check fails, replace with |
|---|---|---|---|---|
| 1 | `blockers` persisted query (inverse direction of `jira_work_item_blocks_jira_work_item`) | `src/graph/queries.js` | NEEDS-LIVE | Jira REST `issuelinks` on the issue (already fetched by `jiraRest.js`) |
| 2 | `pages` persisted query (`ConfluencePage -[content_entity_links_entity]-> JiraWorkItem`) | `queries.js` | NEEDS-LIVE | Jira REST remote links of type Confluence / CQL search for the issue key |
| 3 | `incidents` persisted query (`jsm_incident_links_jira_work_item`) | `queries.js` | NEEDS-LIVE | JQL `issue in linkedIssues(KEY) AND type = Incident` |
| 4 | `... on AtlassianUser { id accountId name }` inside `User` fields | `queries.js` | NEEDS-LIVE | the concrete union member shown in the schema SDL |
| 5 | Version ARI format `ari:cloud:jira:{cloudId}:version/{id}` | `src/jira/jiraRest.js` | NEEDS-LIVE | the ARI returned by the GraphQL `JiraVersion.id` |
| 6 | Curated `atlassianUserInTeams` returning `AtlassianTeam { id name }` | `queries.js` | NEEDS-LIVE (field `name`) | `displayName` (used in the official tutorial fragment) |
| 7 | Persisted-query registration endpoint access for the app contributor | `scripts/register-persisted-queries.mjs` | VERIFIED-DOC, untested | TWG Labs UI registration (same queryKey) |
| 8 | PR/build/deployment data on the demo site | dev-tool connector | unknown until site exists | fixture mode (`BLAST_RADIUS_DATA_SOURCE=fixture`) |
When any source is missing, `coverage` records why and confidence drops — the app never reports "safe" on empty data.
