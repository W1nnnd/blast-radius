import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandlers } from '../src/handlers.js';
const calls = [];
const fakeService = {
  analyzeIssue: async key => {
    calls.push(key);
    return {
      key: key
    };
  },
  analyzeRelease: async (pullRequest, value) => ({
    p: pullRequest,
    v: value
  }),
  findExperts: async key => ({
    key: key
  }),
  releaseChecklist: async (pullRequest, value) => ({
    p: pullRequest,
    v: value
  })
};
const handlers = createHandlers({
  service: fakeService,
  jira: {
    resolveIssue: async () => ({
      projectKey: 'PAY',
      fixVersions: [{
        name: '2.4.0'
      }]
    })
  }
});
test(
  'handler issue validation accepts valid keys',
  async () => {
    assert.equal((await handlers.getChangeContext({
      issueKey: 'PAY-142'
    })).key, 'PAY-142');
  }
);
test(
  'handler context fallback for missing and invalid input',
  async () => {
    for (const issueKey of [undefined, 'bad']) {
      assert.equal(
        (await handlers.getChangeContext({
          issueKey,
          context: {
            jira: {
              issueKey: 'PAY-143'
            }
          }
        })).key,
        'PAY-143'
      );
    }
    assert.equal(
      (await handlers.scoreReleaseRisk(
        {
          projectKey: 'x',
          versionName: '2.4.0'
        },
        {
          jira: {
            projectKey: 'PAY'
          }
        }
      )).p,
      'PAY'
    );
  }
);
test(
  'handler rejects malformed keys and versions',
  async () => {
    for (const key of ['x-1', 'P-1', 'PAY-1 OR 1=1', 'PAY-']) {
      assert.equal(
        (await handlers.getChangeContext({
          issueKey: key
        })).error.code,
        'VALIDATION'
      );
    }
    for (const value of ['', 'x'.repeat(101), null]) {
      assert.equal(
        (await handlers.scoreReleaseRisk({
          projectKey: 'PAY',
          versionName: value
        })).error.code,
        'VALIDATION'
      );
    }
  }
);
test(
  'handler error envelope sanitizes exceptions',
  async () => {
    const h = createHandlers({
      service: {
        analyzeIssue: () => {
          throw new Error('secret payload');
        }
      }
    });
    const result = await h.getChangeContext({
      issueKey: 'PAY-142'
    });
    assert.equal(result.error.code, 'UNAVAILABLE');
    assert.doesNotMatch(JSON.stringify(result), /secret/);
  }
);
test(
  'panel handler reads extension issue and returns versions',
  async () => {
    const result = await handlers.getPanelData({}, {
      extension: {
        issue: {
          key: 'PAY-142'
        }
      }
    });
    assert.equal(result.key, 'PAY-142');
    assert.equal(result.releaseOptions[0].name, '2.4.0');
  }
);
test(
  'all action handlers use shared service',
  async () => {
    assert.equal((await handlers.findExperts({
      issueKey: 'PAY-142'
    })).key, 'PAY-142');
    assert.equal(
      (await handlers.generateReleaseChecklist({
        projectKey: 'PAY',
        versionName: '2.4.0'
      })).v,
      '2.4.0'
    );
    assert.equal(
      (await handlers.getReleaseData({
        projectKey: 'PAY',
        versionName: '2.4.0'
      })).p,
      'PAY'
    );
  }
);
test(
  'handler normalizes lowercase keys and trims versions and panel keys',
  async () => {
    assert.equal(
      (await handlers.getChangeContext({
        issueKey: ' pay-142 '
      })).key,
      'PAY-142'
    );
    const release = await handlers.scoreReleaseRisk({
      projectKey: ' pay ',
      versionName: ' 2.4.0 '
    });
    assert.deepEqual(release, {
      p: 'PAY',
      v: '2.4.0'
    });
    assert.equal(
      (await handlers.getPanelData({}, {
        extension: {
          issue: {
            key: ' pay-142 '
          }
        }
      })).key,
      'PAY-142'
    );
  }
);
