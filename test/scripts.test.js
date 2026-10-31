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
            json: async () => json
          };
        }
      }
    );
    assert.equal(state['PAY-143'], 'PAY-900');
    assert.ok(saves >= 3);
    const issue = calls.find(context => context.path.endsWith('/issue'));
    assert.equal(issue.body.fields.description.type, 'doc');
    assert.deepEqual(issue.body.fields.fixVersions, [{
      id: 'v240'
    }]);
    assert.ok(calls.find(context => context.path.endsWith('/pages') && context.method === 'POST').body.body.value.includes('/browse/PAY-900'));
    assert.ok(calls.some(context => context.path.includes('/issue/PAY-900/remotelink')));
  }
);
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
