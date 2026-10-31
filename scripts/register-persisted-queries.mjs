import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PERSISTED_QUERIES } from '../src/graph/queries.js';
/** Build an offline registration plan from the verified persisted query catalog. */
export function planQueries(queries = PERSISTED_QUERIES) {
  return queries.map(query => ({
    method: 'POST',
    path: '/gateway/api/twg/cypher-queries',
    ...query
  }));
}
/** Print a registration plan unless apply is explicitly enabled. */
export async function registerQueries({
  env = process.env,
  apply = false,
  request = globalThis.fetch,
  write = writeFileSync
} = {}) {
  const plan = planQueries();
  if (!apply) {
    return plan;
  }
  const {
    ATLASSIAN_SITE: site,
    ATLASSIAN_EMAIL: email,
    ATLASSIAN_API_TOKEN: token,
    FORGE_APP_ID: appId
  } = env;
  if (!/^[a-z0-9-]+\.atlassian\.net$/i.test(site ?? '') || !email || !token ||
    !appId?.startsWith('ari:')) {
    throw new Error('Set site, email, API token, and Forge app ARI.');
  }
  const keys = {};
  for (const query of plan) {
    const response = await request(
      `https://${site}${query.path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appId,
          name: query.name,
          cypher: query.cypher,
          paramsSchema: query.paramsSchema
        })
      }
    );
    if (!response.ok) {
      throw new Error('Query registration failed; verify contributor access.');
    }
    const json = await response.json();
    if (typeof json.queryKey !== 'string') {
      throw new Error('Registration did not return a query key.');
    }
    keys[query.name] = json.queryKey;
  }
  write(
    new URL('../src/graph/queryKeys.js', import.meta.url),
    `export const QUERY_KEYS = ${JSON.stringify(keys, null, 2)};\n`
  );
  return plan;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const plan = await registerQueries({
      apply: process.argv.includes('--apply')
    });
    for (const query of plan) {
      console.log(`${query.name} [${query.status}]\n${query.cypher}\n`);
    }
  } catch {
    console.error('Query registration failed. Verify environment and contributor access.');
    process.exitCode = 1;
  }
}
