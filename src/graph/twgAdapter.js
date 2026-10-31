/** Bounded curated and persisted TWG reads with explicit visibility coverage. */
import { curatedQuery, CUSTOM_QUERY } from './queries.js';
import { parseColumns } from './parse.js';
import { emptyContext, person } from '../domain/model.js';
import { normalizeIssue, normalizePR, normalizeBuild, normalizeDeployment, normalizePage } from './twgNormalize.js';
/** Read bounded TWG neighborhoods and preserve visibility failures as coverage notes. */
export function createTwgAdapter({
  request,
  jira,
  queryKeys = {}
}) {
  async function read(source, id, coverage, persisted = false) {
    if (persisted && !queryKeys[source]) {
      coverage[source] = {
        available: false,
        reason: 'persisted query not registered'
      };
      return [];
    }
    const nodes = [];
    let after = null;
    try {
      for (let page = 0; page < 4; page++) {
        const variables = persisted
          ? {
            queryKey: queryKeys[source],
            queryParams: {
              id
            },
            first: 25,
            after
          }
          : {
            id,
            first: 25,
            after
          };
        const json = await request(persisted ? CUSTOM_QUERY : curatedQuery(source), variables);
        if (json?.errors?.length) {
          throw new Error('GraphQL error');
        }
        const field = persisted
          ? 'customQuery'
          : {
            pullRequests: 'jiraWorkItemLinkedExternalPullRequests',
            deployments: 'jiraWorkItemLinkedExternalDeployments',
            people: 'atlassianUserInTeams'
          }[source];
        const connection = json?.data?.[field];
        if (!connection || !Array.isArray(connection.edges)) {
          throw new Error('Invalid graph response');
        }
        if (persisted) {
          nodes.push(...Object.values(parseColumns(json)).flat());
        } else {
          nodes.push(...connection.edges.map(edge => edge?.node).filter(Boolean));
        }
        if (!connection.pageInfo?.hasNextPage) {
          coverage[source] = nodes.length
            ? {
              available: true
            }
            : {
              available: false,
              reason: 'empty graph result; access or connector coverage unknown'
            };
          return nodes;
        }
        if (!connection.pageInfo.endCursor || connection.pageInfo.endCursor === after) {
          break;
        }
        after = connection.pageInfo.endCursor;
      }
      coverage[source] = {
        available: false,
        reason: 'pagination limit reached; evidence truncated'
      };
      return nodes;
    } catch {
      coverage[source] = {
        available: false,
        reason: 'graph request unavailable; verify access and schema'
      };
      return [];
    }
  }
  return {
    mode: 'twg',
    resolveIssue: key => jira.resolveIssue(key),
    resolveVersion: (projectKey, version) => jira.resolveVersion(projectKey, version),
    async getReleaseIssues(ari, version) {
      const coverage = {};
      const nodes = await read('releaseIssues', ari, coverage, true);
      const items = nodes.map(normalizeIssue);
      const fallback = !coverage.releaseIssues?.available || !items.length ? version?.issueKeys : [];
      const result = items.length ? items : (fallback ?? []).map(key => ({
        key
      }));
      Object.defineProperty(result, 'coverage', {
        value: coverage.releaseIssues
      });
      return result;
    },
    async getIssueContext(ref) {
      const context = emptyContext({
        type: 'issue',
        key: ref.key,
        name: ref.summary ?? ref.key
      });
      const issue = normalizeIssue(ref);
      context.issues = [issue];
      context.pullRequests = (await read('pullRequests', ref.ari, context.coverage))
        .map(node => normalizePR(node, ref.key));
      context.deployments = (await read('deployments', ref.ari, context.coverage))
        .map(node => normalizeDeployment(node, ref.key));
      context.builds = (await read('builds', ref.ari, context.coverage, true))
        .map(node => normalizeBuild(node, ref.key));
      context.pages = (await read('pages', ref.ari, context.coverage, true))
        .map(node => normalizePage(node, ref.key));
      context.commits = (await read('commits', ref.ari, context.coverage, true)).map(node => ({
        id: String(node.id ?? node.data?.id ?? '')
      }));
      const graphBlockers = await read('blockers', ref.ari, context.coverage, true);
      // Prefer graph evidence; fall back to Jira REST issue links resolved with the issue.
      issue.blockers = (graphBlockers.length ? graphBlockers : ref.blockers ?? []).map(normalizeIssue);
      context.incidents = (await read('incidents', ref.ari, context.coverage, true)).map(node => ({
        ...normalizeIssue({
          ...node,
          ...node.data
        }),
        linkedIssueKeys: [ref.key],
        createdAt: ''
      }));
      const people = [
        issue.assignee,
        ...context.pullRequests.flatMap(pullRequest => [
          pullRequest.author,
          ...pullRequest.reviewers.map(result => result.person)
        ]),
        ...context.pages.map(page => page.owner)
      ].filter(contributor => contributor?.accountId);
      context.people = [
        ...new Map(people.map(pullRequest => [pullRequest.accountId, person(pullRequest)])).values()
      ];
      const states = [];
      for (const pullRequest of context.people.slice(0, 25)) {
        const coverage = {};
        const teams = await read('people', `ari:cloud:identity::user/${pullRequest.accountId}`, coverage);
        states.push(coverage.people);
        for (const team of teams) {
          const old = context.teams.find(x => x.id === team.id);
          if (old) {
            old.members.push(pullRequest.accountId);
          } else {
            context.teams.push({
              id: team.id,
              name: team.name ?? 'Team',
              members: [pullRequest.accountId]
            });
          }
        }
      }
      context.coverage.people = states.length && states.every(source => source.available)
        ? {
          available: true
        }
        : {
          available: false,
          reason: 'team/person coverage incomplete'
        };
      return context;
    }
  };
}
