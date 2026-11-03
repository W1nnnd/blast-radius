import {dedupePages} from './pageIdentity.js';
import {remoteLinkEvidence} from '../jira/remoteLinkEvidence.js';
/** Bounded curated and persisted TWG reads with explicit visibility coverage. */
import { curatedQuery, CUSTOM_QUERY } from './queries.js';
import { parseColumns } from './parse.js';
import { emptyContext, person } from '../domain/model.js';
import { normalizeIssue, normalizePR, normalizeBuild, normalizeDeployment, normalizePage } from './twgNormalize.js';
/** Redact identifiers before bounding the diagnostic so truncated identifiers cannot leak. */
export function sanitizeGraphMessage(message) {
  if (typeof message !== 'string') return '';
  return message
    .replace(/ari:cloud:[^\s"'<>),;]+/gi, '<redacted>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<redacted>')
    .replace(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<redacted>')
    .replace(/\b\d+:[0-9a-f-]+/gi, '<redacted>')
    .slice(0, 160);
}

function diagnosticToken(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,99}$/.test(value)
    ? value : undefined;
}

export function graphErrorCode(error) {
  return diagnosticToken(error?.code) ?? diagnosticToken(error?.classification)
    ?? (Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599
      ? `HTTP_${error.status}` : 'UNKNOWN');
}

/** Read bounded TWG neighborhoods and preserve visibility failures as coverage notes. */
export function createTwgAdapter({
  request,
  jira,
  queryKeys = {}
}) {
  async function read(source, id, coverage, persisted = false, warned = new Set()) {
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
          throw Object.assign(new Error('GraphQL error'), {
            code: json.errors[0]?.extensions?.code,
            classification: json.errors[0]?.extensions?.classification,
            status: json.status,
            errors: json.errors
          });
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
    } catch (error) {
      const code = graphErrorCode(error);
      if (!warned.has(source)) {
        console.warn(`[blast-radius] twg ${JSON.stringify({
          source,
          status: Number.isInteger(error?.status) ? error.status : null,
          code: diagnosticToken(error?.code) ?? null,
          classification: diagnosticToken(error?.classification) ?? null,
          message: sanitizeGraphMessage(error?.errors?.[0]?.message)
        })}`);
        warned.add(source);
      }
      coverage[source] = {
        available: false,
        reason: `graph request unavailable (${code})`
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
      let items = [];
      try {
        items = nodes.map(normalizeIssue);
      } catch {
        coverage.releaseIssues = {available: false, reason: 'graph evidence unavailable'};
      }
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
      const warned = new Set();
      const readSource = (source, id, coverage, persisted = false) =>
        read(source, id, coverage, persisted, warned);
      const context = emptyContext({
        type: 'issue',
        key: ref.key,
        name: ref.summary ?? ref.key
      });
      const issue = normalizeIssue(ref);
      context.issues = [issue];
      // Independent graph neighborhoods share no pagination state.
      const sources = {
        pullRequests: node => normalizePR(node, ref.key),
        deployments: node => normalizeDeployment(node, ref.key),
        builds: node => normalizeBuild(node, ref.key),
        pages: node => normalizePage(node, ref.key),
        commits: node => ({ id: String(node.id ?? node.data?.id ?? '') }),
        blockers: normalizeIssue,
        incidents: node => ({
          ...normalizeIssue({ ...node, ...node.data }),
          linkedIssueKeys: [ref.key], createdAt: ''
        })
      };
      const remotePromise = jira.getRemoteLinks
        ? Promise.resolve().then(() => jira.getRemoteLinks(ref.key)).then(links => remoteLinkEvidence(links, ref.key)).catch(() => {
          context.coverage.remoteLinks = {available: false, reason: 'Jira remote links unavailable'};
          return {};
        }) : Promise.resolve({});
      const results = await Promise.all(Object.entries(sources).map(async ([source, normalize]) => {
        try {
          const nodes = await readSource(source, ref.ari, context.coverage,
            !['pullRequests', 'deployments'].includes(source));
          return [source, nodes.map(normalize)];
        } catch {
          context.coverage[source] = {available: false, reason: 'graph evidence unavailable'};
          return [source, []];
        }
      }));
      const {blockers: graphBlockers, ...collections} = Object.fromEntries(results);
      Object.assign(context, collections);
      const remote = await remotePromise;
      for (const source of ['pullRequests', 'builds', 'deployments', 'pages']) {
        if (!context[source].length && remote[source]) {
          context[source] = remote[source];
          context.coverage[source] = {available: true, via: 'jira-remote-link',
            reason: 'Teamwork Graph had no dev-tool data; Jira remote links checked'};
        }
      }
      context.pages = dedupePages([...context.pages, ...(remote.pages ?? [])]);
      if (!context.incidents.length) context.incidents = (ref.incidents ?? []).map(node => ({
        ...normalizeIssue(node), linkedIssueKeys: [ref.key], createdAt: ''
      }));
      issue.blockers = graphBlockers.length ? graphBlockers : (ref.blockers ?? []).map(normalizeIssue);
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
      const teamReads = await Promise.all(context.people.slice(0, 10).map(async pullRequest => {
        const coverage = {};
        const teams = await readSource('people', `ari:cloud:identity::user/${pullRequest.accountId}`, coverage);
        return {pullRequest, teams, state: coverage.people};
      }));
      const states = teamReads.map(result => result.state);
      for (const {pullRequest, teams} of teamReads) {
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
      context.coverage.people = context.people.length <= 10 && states.length && states.every(source => source.available)
        ? {
          available: true
        }
        : {
          available: false,
          reason: 'team/person coverage incomplete'
        };
      const counts = {
        pullRequests: context.pullRequests.length,
        deployments: context.deployments.length,
        builds: context.builds.length,
        pages: context.pages.length,
        commits: context.commits.length,
        blockers: graphBlockers.length,
        incidents: context.incidents.length,
        people: context.people.length,
        teams: context.teams.length
      };
      console.log(`[blast-radius] twg counts ${JSON.stringify(counts)}`);
      return context;
    }
  };
}
