/** Forge entry points wiring user-scoped transports to the shared analysis service. */
import api, { route } from '@forge/api';
import Resolver from '@forge/resolver';
import { createAdapter } from './graph/adapter.js';
import { QUERY_KEYS } from './graph/queryKeys.js';
import { createJiraRest } from './jira/jiraRest.js';
import { createService } from './service.js';
import { createHandlers } from './handlers.js';
function handlers(context = {}) {
  const jira = createJiraRest({
    request: (...args) => api.asUser().requestJira(...args),
    route,
    cloudId: context.cloudId ?? context.extension?.cloudId
  });
  const adapter = createAdapter(
    process.env,
    {
      jira,
      queryKeys: QUERY_KEYS,
      request: async (query, variables) => {
        const response = await api.asUser().requestTeamworkGraph(query, variables);
        if (response.ok === false) {
          throw new Error('Graph unavailable');
        }
        return response.json();
      }
    }
  );
  const panelJira = adapter.mode === 'fixture'
    ? {
      resolveIssue: async key => {
        const issue = await adapter.resolveIssue(key);
        return {
          ...issue,
          projectKey: 'PAY',
          fixVersions: [{
            name: issue.version
          }]
        };
      }
    }
    : jira;
  return createHandlers({
    service: createService(adapter),
    jira: panelJira
  });
}
async function call(name, payload, context) {
  try {
    // Rovo/MCP actions carry cloudId in payload.context; UI resolvers carry it in context.
    const cloudId = context?.cloudId ?? payload?.context?.cloudId;
    return await handlers({ ...context, cloudId })[name](payload, context);
  } catch {
    return {
      error: {
        code: 'UNAVAILABLE',
        message: 'Unable to initialize analysis. Check configuration.'
      }
    };
  }
}
/** Analyze an issue using the shared permission-aware service. */
export async function getChangeContext(payload, context) {
  return call('getChangeContext', payload, context);
}
/** Analyze a release using the shared permission-aware service. */
export async function scoreReleaseRisk(payload, context) {
  return call('scoreReleaseRisk', payload, context);
}
/** Find people with evidence of related contributions. */
export async function findExperts(payload, context) {
  return call('findExperts', payload, context);
}
/** Generate concrete release actions from observed risk evidence. */
export async function generateReleaseChecklist(payload, context) {
  return call('generateReleaseChecklist', payload, context);
}
const resolver = new Resolver();
resolver.define(
  'getPanelData',
  ({
    payload,
    context
  }) => call('getPanelData', payload, context)
);
resolver.define(
  'getReleaseData',
  ({
    payload,
    context
  }) => call('getReleaseData', payload, context)
);
export const handler = resolver.getDefinitions();
