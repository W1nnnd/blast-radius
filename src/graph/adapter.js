/** Select a graph implementation behind the shared asynchronous adapter contract. */
import { createFixtureAdapter } from './fixtureAdapter.js';
import { createTwgAdapter } from './twgAdapter.js';
/** GraphAdapter: {mode, resolveIssue(key), resolveVersion(projectKey,name),
 * getIssueContext({key,ari}), getReleaseIssues(versionAri,versionRef)}.
 * Methods are async; graph failures become coverage notes, not empty assurances.
 */
/** Select the explicitly configured fixture or live graph adapter. */
export function createAdapter(env = process.env, deps = {}) {
  const mode = env.BLAST_RADIUS_DATA_SOURCE ?? 'twg';
  if (mode === 'fixture') {
    return createFixtureAdapter();
  }
  if (mode === 'twg') {
    return createTwgAdapter(deps);
  }
  throw new Error('Invalid data source');
}
