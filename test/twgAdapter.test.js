import { connection, custom, ref } from './graphFixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdapter } from '../src/graph/adapter.js';
import { createTwgAdapter } from '../src/graph/twgAdapter.js';
test(
  'adapter defaults to twg and requires explicit fixture',
  () => {
    assert.equal(createAdapter({}, {}).mode, 'twg');
    assert.equal(createAdapter({
      BLAST_RADIUS_DATA_SOURCE: 'fixture'
    }).mode, 'fixture');
    assert.throws(() => createAdapter({
      BLAST_RADIUS_DATA_SOURCE: 'other'
    }));
  }
);
test(
  'TWG curated fields use issue ARI, first 25 and persisted keys',
  async () => {
    const seen = [];
    const request = async (query, value) => {
      seen.push({
        q: query,
        v: value
      });
      if (query.includes('BlastRadiusPersisted')) {
        return custom('builds', [{
          id: 'b',
          data: {
            displayName: 'CI',
            state: 'failed'
          }
        }]);
      }
      if (query.includes('jiraWorkItemLinkedExternalPullRequests')) {
        return {
          data: {
            jiraWorkItemLinkedExternalPullRequests: connection([{
              id: 'p',
              status: 'open',
              author: {
                accountId: 'a',
                name: 'Ada'
              }
            }])
          }
        };
      }
      if (query.includes('atlassianUserInTeams')) {
        return {
          data: {
            atlassianUserInTeams: connection([{
              id: 't',
              name: 'Core'
            }])
          }
        };
      }
      return {
        data: {
          jiraWorkItemLinkedExternalDeployments: connection()
        }
      };
    };
    const firstPerson = createTwgAdapter({
      request,
      jira: {},
      queryKeys: {
        builds: 'registered'
      }
    });
    const context = await firstPerson.getIssueContext(ref);
    assert.equal(context.pullRequests[0].status, 'OPEN');
    assert.equal(context.builds[0].state, 'FAILED');
    assert.ok(seen.every(x => x.v.first === 25));
    assert.equal(seen[0].v.id, ref.ari);
    assert.ok(seen.some(x => x.v.queryKey === 'registered' && x.v.queryParams.id === ref.ari));
    assert.ok(seen.some(x => x.v.id === 'ari:cloud:identity::user/a'));
  }
);
test(
  'TWG stops at four pages and marks truncation',
  async () => {
    let node = 0;
    const firstPerson = createTwgAdapter({
      request: async query => {
        if (query.includes('jiraWorkItemLinkedExternalPullRequests')) {
          node++;
          return {
            data: {
              jiraWorkItemLinkedExternalPullRequests: connection([{
                id: `p${node}`
              }], true, `cursor${node}`)
            }
          };
        }
        return {
          data: {
            jiraWorkItemLinkedExternalDeployments: connection()
          }
        };
      },
      jira: {}
    });
    const context = await firstPerson.getIssueContext(ref);
    assert.equal(node, 4);
    assert.equal(context.pullRequests.length, 4);
    assert.equal(context.coverage.pullRequests.available, false);
    assert.match(context.coverage.pullRequests.reason, /truncated/);
  }
);
test(
  'TWG missing persisted key marks source unavailable',
  async () => {
    const firstPerson = createTwgAdapter({
      request: async () => ({
        errors: [{}]
      }),
      jira: {}
    });
    const context = await firstPerson.getIssueContext(ref);
    assert.deepEqual(
      context.coverage.builds,
      {
        available: false,
        reason: 'persisted query not registered'
      }
    );
    assert.equal(context.coverage.pages.available, false);
  }
);
test(
  'TWG GraphQL and thrown errors never leak payload',
  async () => {
    for (const request of [
      async () => ({
        errors: [{
          message: 'private'
        }]
      }),
      async () => {
        throw new Error('private');
      }
    ]) {
      const context = await createTwgAdapter({
        request,
        jira: {}
      }).getIssueContext(ref);
      assert.equal(context.coverage.pullRequests.available, false);
      assert.doesNotMatch(JSON.stringify(context), /private/);
    }
  }
);
test(
  'TWG empty results stay unknown instead of asserting coverage',
  async () => {
    const context = await createTwgAdapter({
      request: async query => {
        return {
          data: {
            [query.includes('PullRequests')
              ? 'jiraWorkItemLinkedExternalPullRequests'
              : 'jiraWorkItemLinkedExternalDeployments']: connection()
          }
        };
      },
      jira: {}
    }).getIssueContext(ref);
    assert.equal(context.coverage.pullRequests.available, false);
    assert.match(context.coverage.pullRequests.reason, /unknown/);
  }
);
test(
  'release persisted query returns issues and fallback JQL keys',
  async () => {
    const firstPerson = createTwgAdapter({
      request: async () => custom('items', [{
        id: '1',
        data: {
          key: 'PAY-142'
        }
      }]),
      jira: {},
      queryKeys: {
        releaseIssues: 'release'
      }
    });
    assert.equal((await firstPerson.getReleaseIssues('ari:version'))[0].key, 'PAY-142');
    const build = createTwgAdapter({
      request: async () => {
        throw Error();
      },
      jira: {}
    });
    assert.equal(
      (await build.getReleaseIssues('ari:version', {
        issueKeys: ['PAY-150']
      }))[0].key,
      'PAY-150'
    );
  }
);
test(
  'persisted pagination carries cursors and combines columns',
  async () => {
    let node = 0;
    const seen = [];
    const firstPerson = createTwgAdapter({
      queryKeys: {
        builds: 'build-key'
      },
      jira: {},
      request: async (query, value) => {
        if (value.queryKey) {
          seen.push(value);
          node++;
          const result = custom('builds', [{
            id: `b${node}`,
            data: {
              state: 'successful'
            }
          }]);
          result.data.customQuery.pageInfo = {
            hasNextPage: node < 2,
            endCursor: `cursor${node}`
          };
          return result;
        }
        return {
          errors: [{}]
        };
      }
    });
    const context = await firstPerson.getIssueContext(ref);
    assert.equal(context.builds.length, 2);
    assert.equal(seen[1].after, 'cursor1');
    assert.equal(context.coverage.builds.available, true);
  }
);
test(
  'commit query results are retained as normalized evidence counts',
  async () => {
    const adapter = createTwgAdapter({
      jira: {},
      queryKeys: {
        commits: 'commits-key'
      },
      request: async (query, variables) => variables.queryKey
        ? custom(
          'commits',
          [
            {
              id: 'commit-1'
            },
            {
              id: 'commit-2',
              data: {
                __typename: 'ExternalCommit'
              }
            }
          ]
        )
        : {
          errors: [{}]
        }
    });
    const context = await adapter.getIssueContext(ref);
    assert.deepEqual(context.commits, [{
      id: 'commit-1'
    }, {
      id: 'commit-2'
    }]);
    assert.equal(context.coverage.commits.available, true);
  }
);

test('registered query keys are six frozen UUIDs', async () => {
  const { QUERY_KEYS } = await import('../src/graph/queryKeys.js');
  assert.deepEqual(Object.keys(QUERY_KEYS).sort(),
    ['builds', 'commits', 'blockers', 'pages', 'releaseIssues', 'incidents'].sort());
  assert.ok(Object.isFrozen(QUERY_KEYS));
  for (const key of Object.values(QUERY_KEYS)) {
    assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  }
});

test('real persisted keys use id params and isolate pages GraphQL failure', async () => {
  const { QUERY_KEYS } = await import('../src/graph/queryKeys.js');
  const seen = [];
  const warnings = [];
  const summaries = [];
  const warn = console.warn;
  const log = console.log;
  console.warn = value => warnings.push(value);
  console.log = value => summaries.push(value);
  try {
    const adapter = createTwgAdapter({
      jira: {},
      queryKeys: QUERY_KEYS,
      request: async (query, variables) => {
        if (variables.queryKey) {
          seen.push(variables);
          if (variables.queryKey === QUERY_KEYS.pages) {
            return { data: { customQuery: null }, errors: [{
              message: 'private payload', extensions: { code: 'INTERNAL_SERVER_ERROR' }
            }] };
          }
          return custom('items', [{ id: 'node', data: { key: 'PAY-1', state: 'failed' } }]);
        }
        return { data: {
          [query.includes('PullRequests')
            ? 'jiraWorkItemLinkedExternalPullRequests'
            : 'jiraWorkItemLinkedExternalDeployments']: connection([{ id: 'node' }])
        } };
      }
    });
    const context = await adapter.getIssueContext(ref);
    await adapter.getReleaseIssues(ref.ari);
    assert.deepEqual(new Set(seen.map(value => value.queryKey)), new Set(Object.values(QUERY_KEYS)));
    for (const variables of seen) {
      assert.deepEqual(variables.queryParams, { id: ref.ari });
      assert.equal(variables.first, 25);
    }
    assert.equal(context.coverage.pages.available, false);
    assert.match(context.coverage.pages.reason, /INTERNAL_SERVER_ERROR/);
    for (const source of ['pullRequests', 'deployments', 'builds', 'commits', 'incidents']) {
      assert.equal(context[source].length, 1);
      assert.equal(context.coverage[source].available, true);
    }
    assert.equal(context.issues[0].blockers.length, 1);
    assert.deepEqual(warnings, ['[blast-radius] twg source=pages code=INTERNAL_SERVER_ERROR']);
    assert.equal(summaries.length, 1);
    assert.match(summaries[0], /"pages":0/);
    assert.doesNotMatch(JSON.stringify([context, warnings, summaries]), /private payload/);
  } finally {
    console.warn = warn;
    console.log = log;
  }
});

test('independent graph sources and at most ten person reads run concurrently', async () => {
  const {QUERY_KEYS} = await import('../src/graph/queryKeys.js');
  let active = 0;
  let graphPeak = 0;
  let teamPeak = 0;
  let teamReads = 0;
  const adapter = createTwgAdapter({jira: {}, queryKeys: QUERY_KEYS,
    request: async (query, variables) => {
      const team = query.includes('atlassianUserInTeams');
      active++;
      if (team) {
        teamReads++;
        teamPeak = Math.max(teamPeak, active);
      } else graphPeak = Math.max(graphPeak, active);
      await new Promise(resolve => setImmediate(resolve));
      active--;
      if (team) return {data: {atlassianUserInTeams: connection([{id: 'team'}])}};
      if (variables.queryKey) return custom('items', []);
      if (query.includes('PullRequests')) return {data: {
        jiraWorkItemLinkedExternalPullRequests: connection(Array.from({length: 15}, (_, i) => ({
          id: `pr-${i}`, author: {accountId: `person-${i}`}
        })))
      }};
      return {data: {jiraWorkItemLinkedExternalDeployments: connection()}};
    }});
  const context = await adapter.getIssueContext(ref);
  assert.equal(graphPeak, 7);
  assert.equal(teamReads, 10);
  assert.equal(teamPeak, 10);
  assert.equal(context.coverage.people.available, false);
  assert.equal(context.teams[0].members.length, 10);
});
