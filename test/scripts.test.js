import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/graph/demoData.js';
import { planSeed, seedSite } from '../scripts/seed-demo-site.mjs';
import { planQueries, registerQueries } from '../scripts/register-persisted-queries.mjs';
import { PERSISTED_QUERIES } from '../src/graph/queries.js';
test(
  'seed plan deterministic, complete, and offline by default',
  async () => {
    const plan = planSeed(data);
    assert.deepEqual(plan, planSeed(data));
    assert.equal(plan.filter(source => source.kind === 'issue').length, 10);
    assert.equal(plan.filter(source => source.kind === 'page').length, 6);
    assert.ok(plan.some(source => source.kind === 'link'));
    assert.ok(plan.some(source => source.kind === 'remote'));
    assert.deepEqual(
      await seedSite(data, {
        env: {},
        request: () => {
          throw Error('network forbidden');
        }
      }),
      plan
    );
  }
);
test(
  'query planner contains all verified or NEEDS-LIVE entries and never sends by default',
  async () => {
    const plan = await registerQueries({
      env: {},
      request: () => {
        throw Error('network forbidden');
      }
    });
    assert.deepEqual(plan, planQueries());
    assert.equal(plan.length, PERSISTED_QUERIES.length);
    assert.equal(plan.find(query => query.name === 'blockers').status, 'NEEDS-LIVE');
    assert.match(
      plan.find(query => query.name === 'releaseIssues').cypher,
      /jira_version_links_jira_work_item/
    );
  }
);
test(
  'registration applies using injected transport and writes returned keys',
  async () => {
    let saved;
    const seen = [];
    await registerQueries({
      apply: true,
      env: {
        ATLASSIAN_SITE: 'demo.atlassian.net',
        ATLASSIAN_EMAIL: 'fictional@example.test',
        ATLASSIAN_API_TOKEN: 'not-a-real-token',
        FORGE_APP_ID: 'ari:app'
      },
      request: async (url, object) => {
        seen.push({
          url,
          body: JSON.parse(object.body)
        });
        return {
          ok: true,
          json: async () => ({
            queryKey: `key-${seen.length}`
          })
        };
      },
      write: (path, content) => {
        saved = content;
      }
    });
    assert.equal(seen.length, PERSISTED_QUERIES.length);
    assert.match(saved, /key-1/);
    assert.ok(seen.every(source => source.url.endsWith('/gateway/api/twg/cypher-queries')));
  }
);
test(
  'seed apply is testable without network and maps actual keys',
  async () => {
    const tiny = {
      ...structuredClone(data),
      versions: [data.versions[0]],
      issues: [structuredClone(data.issues[1])],
      pages: [{
        ...data.pages[0],
        linkedIssueKeys: ['PAY-143']
      }],
      pullRequests: [{
        ...data.pullRequests[1],
        issueKeys: ['PAY-143']
      }]
    };
    tiny.issues[0].blockers = [];
    const calls = [];
    const state = {};
    let saves = 0;
    await seedSite(
      tiny,
      {
        apply: true,
        env: {
          ATLASSIAN_SITE: 'fictional.atlassian.net',
          ATLASSIAN_EMAIL: 'demo@example.test',
          ATLASSIAN_API_TOKEN: 'dummy'
        },
        state,
        save: () => {
          saves++;
        },
        request: async (url, opts) => {
          const path = new URL(url).pathname;
          const body = opts.body ? JSON.parse(opts.body) : null;
          calls.push({
            path,
            method: opts.method,
            body
          });
          let json = {};
          if (path === '/rest/api/3/project/PAY') {
            json = {
              id: '10'
            };
          } else if (path.endsWith('/versions')) {
            json = [];
          } else if (path.endsWith('/spaces')) {
            json = {
              results: [{
                id: 'space-1'
              }]
            };
          } else if (path.endsWith('/version')) {
            json = {
              id: 'v240'
            };
          } else if (path.endsWith('/search/jql')) {
            json = {
              issues: []
            };
          } else if (path.endsWith('/issue')) {
            json = {
              key: 'PAY-900'
            };
          } else if (path.endsWith('/pages')) {
            json = opts.method === 'GET' ? {
              results: []
            } : {
              id: 'page-900'
            };
          }
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify(json)
          };
        }
      }
    );
    assert.equal(state['PAY-143'], 'PAY-900');
    assert.ok(saves >= 3);
    assert.deepEqual(calls.find(call => call.path === '/rest/api/3/version').body, {
      name: tiny.versions[0].name,
      projectId: 10
    });
    const issue = calls.find(context => context.path.endsWith('/issue'));
    assert.equal(issue.body.fields.description.type, 'doc');
    assert.deepEqual(issue.body.fields.fixVersions, [{
      id: 'v240'
    }]);
    assert.ok(calls.find(context => context.path.endsWith('/pages') && context.method === 'POST').body.body.value.includes('/browse/PAY-900'));
    assert.ok(calls.some(context => context.path.includes('/issue/PAY-900/remotelink')));
  }
);
test('seed apply accepts an empty-body 201 when creating an issue link', async () => {
  const dataset = {
    versions: [],
    issues: [{ key: 'PAY-2', summary: 'Blocked issue', blockers: [{ key: 'PAY-1' }] }],
    pages: [],
    pullRequests: []
  };
  const state = { 'PAY-1': 'PAY-901' };
  let linked = false;
  await seedSite(dataset, {
    apply: true,
    env: {
      ATLASSIAN_SITE: 'fictional.atlassian.net',
      ATLASSIAN_EMAIL: 'demo@example.test',
      ATLASSIAN_API_TOKEN: 'dummy'
    },
    state,
    save: () => {},
    request: async (url, options) => {
      const path = new URL(url).pathname;
      if (path === '/rest/api/3/issueLink') {
        assert.equal(options.method, 'POST');
        assert.deepEqual(JSON.parse(options.body).inwardIssue, { key: 'PAY-901' });
        linked = true;
        return new Response(null, { status: 201 });
      }
      const bodies = {
        '/rest/api/3/project/PAY': { id: '10' },
        '/rest/api/3/project/PAY/versions': [],
        '/wiki/api/v2/spaces': { results: [{ id: 'space-1' }] },
        '/rest/api/3/search/jql': {
          issues: [{ key: 'PAY-902', fields: { summary: 'Blocked issue' } }]
        }
      };
      assert.ok(Object.hasOwn(bodies, path), `Unexpected request: ${path}`);
      return new Response(JSON.stringify(bodies[path]), { status: 200 });
    }
  });
  assert.equal(linked, true);
  assert.equal(state['link:PAY-1:PAY-2'], true);
});

test(
  'seed apply project missing gives actionable instruction',
  async () => {
    await assert.rejects(
      seedSite(
        data,
        {
          apply: true,
          env: {
            ATLASSIAN_SITE: 'fictional.atlassian.net',
            ATLASSIAN_EMAIL: 'demo@example.test',
            ATLASSIAN_API_TOKEN: 'dummy'
          },
          request: async () => ({
            ok: false,
            status: 404
          })
        }
      ),
      /Create a Scrum software project with key PAY/
    );
  }
);
test(
  'registration and seed reject invalid environments before requests',
  async () => {
    const noRequest = () => {
      throw Error('must not request');
    };
    await assert.rejects(registerQueries({
      apply: true,
      env: {},
      request: noRequest
    }), /Set site/);
    await assert.rejects(
      seedSite(data, {
        apply: true,
        env: {},
        request: noRequest
      }),
      /Set ATLASSIAN_SITE/
    );
  }
);

const errorEnv = {
  ATLASSIAN_SITE: 'fictional.atlassian.net',
  ATLASSIAN_EMAIL: 'demo@example.test',
  ATLASSIAN_API_TOKEN: 'secret-token',
  FORGE_APP_ID: 'ari:app'
};

for (const script of ['seed-demo-site', 'register-persisted-queries']) {
  test(`${script} reports bounded HTTP errors without credentials or headers`, async () => {
    const register = script === 'register-persisted-queries';
    const body = 'Permission denied: ' + 'x'.repeat(400) + 'TRUNCATED';
    const options = {
      apply: true,
      env: errorEnv,
      request: async () => ({
        ok: false,
        status: 403,
        headers: { private: 'HEADER-SECRET' },
        text: async () => body
      })
    };
    await assert.rejects(register ? registerQueries(options) : seedSite(data, options), error => {
      assert.ok(error.message.includes(register
        ? 'POST /gateway/api/twg/cypher-queries (403)'
        : 'GET /rest/api/3/project/PAY (403)'));
      assert.ok(error.message.endsWith(body.slice(0, 300)));
      assert.ok(!error.message.includes('TRUNCATED'));
      assert.ok(!error.message.includes('HEADER-SECRET'));
      return true;
    });
  });

}

test('error details redact echoed credentials and tolerate unreadable bodies', async () => {
  const { responseDetail } = await import('../scripts/safe-error.mjs');
  const encoded = Buffer.from(`${errorEnv.ATLASSIAN_EMAIL}:${errorEnv.ATLASSIAN_API_TOKEN}`).toString('base64');
  assert.equal(await responseDetail({
    text: async () => `${errorEnv.ATLASSIAN_EMAIL} ${errorEnv.ATLASSIAN_API_TOKEN} ${encoded}`
  }, errorEnv), '[REDACTED] [REDACTED] [REDACTED]');
  assert.equal(await responseDetail({ text: async () => { throw Error('unreadable'); } }, errorEnv), '');
});
