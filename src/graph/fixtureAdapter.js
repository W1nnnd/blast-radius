/** Offline graph adapter over immutable, generated Northwind Pay demo evidence. */
import dataset from './demoData.js';
import {emptyContext} from '../domain/model.js';
import {SOURCES} from '../engine/coverage.js';

/** Resolve fixture subjects and return isolated, mutable copies of their neighborhoods. */
export function createFixtureAdapter(data = dataset) {
  // Live seeded PAY-1..PAY-10 aliases retain the dataset's original evidence links.
  const aliases = Object.fromEntries(Array.from({length: 10}, (_, index) =>
    [`PAY-${index + 1}`, `PAY-${index + 142}`]));
  const resolveIssue = async key => {
    key = aliases[key] ?? key;
    const issue = data.issues.find(candidate => candidate.key === key);
    if (!issue) throw new Error('Issue not found');
    return {...structuredClone(issue), ari: `fixture:issue/${issue.id}`};
  };
  const resolveVersion = async (projectKey, name) => {
    const version = data.versions.find(candidate =>
      candidate.projectKey === projectKey && candidate.name === name);
    if (!version) throw new Error('Version not found');
    return {...structuredClone(version), versionId: version.id, ari: `fixture:version/${version.id}`};
  };
  return {
    mode: 'fixture', now: data.meta.now, resolveIssue, resolveVersion,
    async getReleaseIssues(ari) {
      const version = data.versions.find(candidate => `fixture:version/${candidate.id}` === ari);
      return data.issues.filter(issue => version?.issueKeys.includes(issue.key))
        .map(issue => structuredClone(issue));
    },
    async getIssueContext(ref) {
      const issue = await resolveIssue(ref.key);
      const context = emptyContext({type: 'issue', key: issue.key, name: issue.summary});
      context.meta = {now: data.meta.now};
      context.issues = [issue];
      for (const name of ['pullRequests', 'builds', 'deployments', 'pages', 'incidents', 'commits']) {
        const related = (data[name] ?? []).filter(object =>
          (object.issueKeys ?? object.linkedIssueKeys ?? []).includes(issue.key));
        context[name] = structuredClone(related);
      }
      context.teams = structuredClone(data.teams);
      context.people = structuredClone(data.people);
      context.coverage = Object.fromEntries(SOURCES.map(name => [name, {available: true}]));
      return context;
    }
  };
}
