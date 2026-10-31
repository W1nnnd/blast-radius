/** Forge input normalization and sanitized action boundaries. */
import { bounded } from './service.js';
export const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;
export const PROJECT_KEY = /^[A-Z][A-Z0-9_]{1,9}$/;
/** Validate action inputs and expose sanitized errors through a shared service. */
export function createHandlers({
  service,
  jira
}) {
  const safe = fn => {
    return async (payload = {}, context = {}) => {
      try {
        return bounded(await fn(payload, context));
      } catch (error) {
        return {
          error: {
            code: error.code === 'VALIDATION'
              ? 'VALIDATION'
              : error.code === 'RESPONSE_TOO_LARGE' ? 'RESPONSE_TOO_LARGE' : 'UNAVAILABLE',
            message: error.code === 'VALIDATION'
              ? 'Provide a valid issue key, project key, and release version as required.'
              : 'Unable to retrieve analysis. Check access and data-source configuration.'
          }
        };
      }
    };
  };
  const invalid = () => {
    throw Object.assign(new Error(), {
      code: 'VALIDATION'
    });
  };
  const key = (payload, context, name, regex) => {
    for (const value of [
      payload[name],
      payload.context?.jira?.[name],
      context.jira?.[name]
    ]) {
      if (typeof value === 'string' && regex.test(value.trim().toUpperCase())) {
        return value.trim().toUpperCase();
      }
    }
    return invalid();
  };
  const version = payload => {
    return typeof payload.versionName === 'string' && payload.versionName.trim() &&
      payload.versionName.length <= 100
      ? payload.versionName.trim()
      : invalid();
  };
  return {
    getChangeContext: safe((payload, context) => service.analyzeIssue(key(payload, context, 'issueKey', ISSUE_KEY))),
    scoreReleaseRisk: safe((payload, context) => service.analyzeRelease(
      key(payload, context, 'projectKey', PROJECT_KEY),
      version(payload)
    )),
    findExperts: safe((payload, context) => service.findExperts(key(payload, context, 'issueKey', ISSUE_KEY))),
    generateReleaseChecklist: safe((payload, context) => {
      return service.releaseChecklist(
        key(payload, context, 'projectKey', PROJECT_KEY),
        version(payload),
        'markdown'
      );
    }),
    getPanelData: safe(async (payload, context) => {
      const issueKey = context.extension?.issue?.key?.trim().toUpperCase();
      if (!ISSUE_KEY.test(issueKey ?? '')) {
        return invalid();
      }
      const result = await service.analyzeIssue(issueKey);
      const ref = await jira.resolveIssue(issueKey);
      return {
        ...result,
        releaseOptions: (ref.fixVersions ?? []).map(value => ({
          projectKey: ref.projectKey,
          name: value.name
        }))
      };
    }),
    getReleaseData: safe((payload, context) => service.analyzeRelease(
      key(payload, context, 'projectKey', PROJECT_KEY),
      version(payload)
    ))
  };
}
