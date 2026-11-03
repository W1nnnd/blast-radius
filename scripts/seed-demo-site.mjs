/** Apply or print an explicit demo seed plan using an injected REST transport. */
import { safeErrorMessage, responseDetail } from './safe-error.mjs';
import { planSeed } from './seed-plan.mjs';
export { planSeed } from './seed-plan.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
// PR/build/deployment graph objects require a connected dev tool (GitHub/Bitbucket
// for Jira). REST remote links do not create these objects; fixture mode covers them.

/** Apply an explicit seed plan with reusable object mappings, or return it offline. */
export async function seedSite(dataset, {
  apply = false,
  env = process.env,
  space = 'PAYDOCS',
  request = globalThis.fetch,
  state = {},
  save = step => {
    return writeFileSync(
      new URL('../demo/seed/.seed-state.json', import.meta.url),
      JSON.stringify(step, null, 2)
    );
  }
} = {}) {
  const steps = planSeed(dataset, {
    space
  });
  if (!apply) {
    return steps;
  }
  const {
    ATLASSIAN_SITE: site,
    ATLASSIAN_EMAIL: email,
    ATLASSIAN_API_TOKEN: token
  } = env;
  if (!/^[a-z0-9-]+\.atlassian\.net$/i.test(site ?? '') || !email || !token) {
    throw new Error('Set ATLASSIAN_SITE, ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN (masked).');
  }
  const headers = {
    Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
    'Content-Type': 'application/json'
  };
  async function call(method, path, body) {
    const response = await request(
      `https://${site}${path}`,
      {
        method,
        headers,
        ...(body ? {
          body: JSON.stringify(body)
        } : {})
      }
    );
    if (!response.ok) {
      const detail = await responseDetail(response, env);
      if (response.status === 404 && path === '/rest/api/3/project/PAY') {
        throw new Error(`Create a Scrum software project with key PAY in Jira UI first. ${method} ${path} (${response.status}): ${detail}`);
      }
      throw new Error(`REST operation failed: ${method} ${path} (${response.status}): ${detail}`);
    }
    const text = await response.text();
    return text === '' ? {} : JSON.parse(text);
  }
  const project = await call('GET', '/rest/api/3/project/PAY');
  const versions = await call('GET', '/rest/api/3/project/PAY/versions');
  const spaces = await call('GET', `/wiki/api/v2/spaces?keys=${encodeURIComponent(space)}`);
  const spaceId = spaces.results?.[0]?.id;
  if (!spaceId) {
    throw new Error(`Create Confluence space ${space} in UI first.`);
  }
  const persist = () => save(state);
  const escape = step => {
    return String(step).replace(
      /[&<>"']/g,
      context => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[context]
    );
  };
  for (const step of steps.slice(1)) {
    if (step.kind === 'version') {
      const version = versions.find(v => v.name === step.body.name) ??
        (await call('POST', step.path, {
          name: step.body.name,
          projectId: Number(project.id)
        }));
      state[step.seedId] = version.id;
      persist();
    }
    if (step.kind === 'issue') {
      const issue = step.issue;
      const result = await call(
        'POST',
        '/rest/api/3/search/jql',
        {
          jql: `project = PAY AND labels = "blast-radius-demo" AND summary ~ ${JSON.stringify('"' + issue.summary.replace(/["\\]/g, '') + '"')}`,
          fields: ['summary'],
          maxResults: 100
        }
      );
      const existing = result.issues?.find(object => object.fields?.summary === issue.summary);
      const created = existing ??
        (await call(
          'POST',
          step.path,
          {
            fields: {
              project: {
                key: 'PAY'
              },
              summary: issue.summary,
              issuetype: {
                name: issue.type
              },
              priority: {
                name: issue.priority
              },
              fixVersions: [
                {
                  id: String(state[dataset.versions.find(version => version.name === issue.version).id])
                }
              ],
              labels: ['blast-radius-demo'],
              description: {
                type: 'doc',
                version: 1,
                content: [
                  {
                    type: 'paragraph',
                    content: [{
                      type: 'text',
                      text: `Northwind Pay demo: ${issue.summary}`
                    }]
                  }
                ]
              }
            }
          }
        ));
      state[step.seedId] = created.key;
      persist();
    }
    if (step.kind === 'link') {
      const id = `link:${step.from}:${step.to}`;
      if (!state[id]) {
        await call(
          'POST',
          step.path,
          {
            type: {
              name: 'Blocks'
            },
            inwardIssue: {
              key: state[step.from]
            },
            outwardIssue: {
              key: state[step.to]
            }
          }
        );
        state[id] = true;
        persist();
      }
    }
    if (step.kind === 'page' && !state[step.seedId]) {
      const pageRef = step.page;
      const existing = await call(
        'GET',
        `/wiki/api/v2/pages?space-id=${encodeURIComponent(spaceId)}&title=${encodeURIComponent(pageRef.title)}`
      );
      const page = existing.results?.find(x => x.title === pageRef.title) ??
        (await call(
          'POST',
          step.path,
          {
            spaceId,
            status: 'current',
            title: pageRef.title,
            body: {
              representation: 'storage',
              value: `<p>${escape(pageRef.title)}</p>` + pageRef.linkedIssueKeys.map(key => `<p><a href="https://${site}/browse/${escape(state[key])}">${escape(state[key])}</a></p>`).join('')
            }
          }
        ));
      state[step.seedId] = page.id;
      persist();
    }
    if (step.kind === 'remote') {
      await call(
        'POST',
        `/rest/api/3/issue/${encodeURIComponent(state[step.issueKey])}/remotelink`,
        {
          globalId: `blast-radius:${step.pr.id}`,
          object: {
            url: step.pr.url,
            title: `GitHub PR #${step.pr.displayId}: ${step.pr.title}`
          }
        }
      );
    }
  }
  return steps;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = JSON.parse(readFileSync(new URL('../demo/seed/dataset.json', import.meta.url), 'utf8'));
  const statePath = new URL('../demo/seed/.seed-state.json', import.meta.url);
  const spaceIndex = process.argv.indexOf('--space');
  try {
    const steps = await seedSite(
      data,
      {
        apply: process.argv.includes('--apply'),
        space: spaceIndex >= 0 ? process.argv[spaceIndex + 1] : 'PAYDOCS',
        state: existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {}
      }
    );
    for (const step of steps) {
      console.log(`${step.method} ${step.path} — ${step.summary}`);
    }
  } catch (error) {
    console.error(safeErrorMessage(error.message, process.env));
    process.exitCode = 1;
  }
}
