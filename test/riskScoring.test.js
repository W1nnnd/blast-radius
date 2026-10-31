import { pr, issue, run } from './fixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
test(
  'category caps and total score clamp at 100',
  () => {
    const context = {
      pullRequests: Array.from({
        length: 10
      }, (_, i) => pr({
        id: String(i),
        reviewers: [],
        repository: String(i)
      })),
      builds: Array.from({
        length: 10
      }, (_, i) => ({
        id: String(i),
        state: 'FAILED'
      })),
      deployments: Array.from(
        {
          length: 10
        },
        (_, i) => ({
          id: String(i),
          state: 'FAILED',
          environmentType: 'STAGING'
        })
      ),
      issues: Array.from(
        {
          length: 10
        },
        (_, i) => issue({
          key: `PAY-${i}`,
          statusCategory: 'new',
          priority: 'High',
          assignee: null
        })
      ),
      pages: Array.from(
        {
          length: 4
        },
        (_, i) => ({
          id: String(i),
          kind: 'runbook',
          lastUpdatedAt: '2020-01-01'
        })
      ),
      teams: []
    };
    const result = run(context);
    assert.equal(result.score, 100);
    assert.equal(result.level, 'critical');
    for (const cat of result.categories) {
      assert.ok(cat.points <= cat.max);
    }
  }
);
test(
  'blocker alone does not make level critical',
  () => {
    const result = run({
      builds: [{
        id: 'b',
        state: 'FAILED'
      }]
    });
    assert.equal(result.level, 'low');
    assert.equal(result.blockers.length, 1);
  }
);
test(
  'merged review signal reduces medium-risk score without changing category caps',
  () => {
    const result = run({
      pullRequests: [pr({
        reviewers: [],
        linesChanged: 501
      })],
      issues: [issue({
        statusCategory: 'new',
        priority: 'High'
      })],
      pages: [{
        id: 'p',
        kind: 'runbook',
        lastUpdatedAt: '2020-01-01'
      }],
      teams: []
    });
    assert.equal(result.score, 35);
    assert.equal(result.level, 'medium');
    const high = run({
      pullRequests: [pr({
        reviewers: [],
        linesChanged: 501
      })],
      issues: Array.from({
        length: 5
      }, () => issue({
        statusCategory: 'new',
        assignee: null
      })),
      pages: [{
        id: 'p',
        kind: 'runbook',
        lastUpdatedAt: '2020-01-01'
      }],
      deployments: [{
        id: 'd',
        state: 'FAILED',
        environmentType: 'STAGING'
      }],
      teams: []
    });
    assert.equal(high.score, 59);
    assert.equal(high.level, 'medium');
  }
);
