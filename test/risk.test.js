import { now, base, pr, issue, run, has } from './fixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreRisk } from '../src/engine/risk.js';
test(
  'null or boundary-sized diffs do not add large-PR signal',
  () => {
    for (const node of [null, 0, 500]) {
      assert.equal(
        has(run({
          pullRequests: [pr({
            linesChanged: node
          })]
        }), 'large-pr'),
        undefined
      );
    }
  }
);
test(
  'old and future rollback are outside the window',
  () => {
    for (const date of ['2026-10-01T00:00:00Z', '2026-12-11T00:00:00Z']) {
      assert.equal(
        has(
          run({
            deployments: [
              {
                id: 'd',
                state: 'ROLLED_BACK',
                environmentType: 'PRODUCTION',
                updatedAt: date
              }
            ]
          }),
          'prod-rollback'
        ),
        undefined
      );
    }
  }
);
test(
  'successful preproduction suppresses missing validation',
  () => {
    return assert.equal(
      has(
        run({
          issues: [issue()],
          pullRequests: [pr({
            status: 'MERGED'
          })],
          deployments: [
            {
              state: 'SUCCESSFUL',
              environmentType: 'TESTING',
              issueKeys: ['PAY-142']
            }
          ]
        }),
        'no-preprod'
      ),
      undefined
    );
  }
);
test(
  'resolved blockers and incidents do not add signals',
  () => {
    return assert.equal(
      run({
        issues: [issue({
          blockers: [issue()]
        })],
        incidents: [{
          key: 'I',
          status: 'Resolved'
        }]
      }).score,
      0
    );
  }
);
test(
  'deterministic and does not mutate input',
  () => {
    const context = {
      ...base(),
      pullRequests: [pr({
        reviewers: []
      })]
    };
    const before = structuredClone(context);
    assert.deepEqual(scoreRisk(context, {
      now
    }), scoreRisk(context, {
      now: new Date(now)
    }));
    assert.deepEqual(context, before);
  }
);
test(
  'injected now changes runbook ageing',
  () => {
    const context = {
      ...base(),
      pages: [{
        id: 'p',
        kind: 'runbook',
        lastUpdatedAt: now
      }]
    };
    assert.equal(has(scoreRisk(context, {
      now
    }), 'stale-runbook'), undefined);
    assert.ok(has(scoreRisk(context, {
      now: '2027-04-01'
    }), 'stale-runbook'));
  }
);
test(
  'every risk has object evidence',
  () => {
    const result = run({
      pullRequests: [pr({
        reviewers: []
      })],
      builds: [{
        id: 'b',
        state: 'FAILED'
      }],
      teams: []
    });
    for (const source of result.signals) {
      assert.ok(source.evidence.length);
      assert.ok(source.evidence[0].id);
      assert.ok(source.evidence[0].type);
    }
  }
);
test(
  'low confidence wording never claims safety',
  () => {
    const result = run({
      coverage: {}
    });
    assert.equal(result.confidence, 'low');
    assert.match(result.summary, /incomplete/);
    assert.doesNotMatch(result.summary, /safe/);
  }
);
test(
  'no reviewers implies unapproved and emits only the stronger review signal',
  () => {
    const risk = run({
      pullRequests: [pr({
        reviewers: []
      })]
    });
    assert.ok(has(risk, 'no-reviewers'));
    assert.equal(has(risk, 'unapproved'), undefined);
    assert.match(has(risk, 'no-reviewers').title, /PR #42 in api has no reviewers/);
  }
);
test(
  'signals use human keys and self-contained titles',
  () => {
    const risk = run({
      issues: [
        issue({
          status: 'In Progress',
          statusCategory: 'indeterminate',
          priority: 'High'
        })
      ],
      builds: [
        {
          id: 'internal',
          name: 'payments-api #918',
          state: 'FAILED',
          issueKeys: ['PAY-142']
        }
      ]
    });
    assert.equal(has(risk, 'unfinished').id, 'unfinished:PAY-142');
    assert.match(has(risk, 'unfinished').title, /PAY-142 \(High\) is still In Progress/);
    assert.equal(has(risk, 'failed-build').id, 'failed-build:payments-api #918');
    assert.match(has(risk, 'failed-build').title, /payments-api #918.*PAY-142/);
  }
);
