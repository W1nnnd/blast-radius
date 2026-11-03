import { now, ada, ben, base, pr } from './fixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rankExperts } from '../src/engine/experts.js';
test(
  'experts use all weights',
  () => {
    const context = {
      ...base(),
      pullRequests: [pr()],
      pages: [{
        owner: ada,
        lastUpdatedAt: now
      }],
      issues: [{
        assignee: ada,
        updatedAt: now
      }]
    };
    const rows = rankExperts(context, {
      now
    });
    assert.equal(rows[0].score, 6);
    assert.equal(rows[1].score, 2.5);
    assert.deepEqual(rows[0].teams, ['Core']);
  }
);
test(
  'nonapproved reviewer weight',
  () => {
    return assert.equal(
      rankExperts(
        {
          ...base(),
          pullRequests: [
            pr({
              author: null,
              reviewers: [{
                person: ben,
                approvalStatus: 'NEEDSWORK'
              }]
            })
          ]
        },
        {
          now
        }
      )[0].score,
      1.5
    );
  }
);
test(
  'recency weights 30 / 90 / older',
  () => {
    for (const [date, expected] of [['2026-12-01', 3], ['2026-10-01', 1.8], ['2026-01-01', .9]]) {
      assert.ok(Math.abs(rankExperts({
        ...base(),
        pullRequests: [pr({
          updatedAt: date,
          reviewers: []
        })]
      }, {
        now
      })[0].score - expected) < 1e-9);
    }
  }
);
test(
  'expert tie-break, exclusion and maximum',
  () => {
    const people = Array.from({
      length: 8
    }, (_, i) => ({
      accountId: String(i),
      name: `Name ${7 - i}`
    }));
    const context = {
      ...base(),
      pages: people.map(owner => ({
        owner,
        lastUpdatedAt: now
      }))
    };
    const rows = rankExperts(context, {
      now,
      excludeAccountIds: ['7']
    });
    assert.equal(rows.length, 5);
    assert.equal(rows[0].person.name, 'Name 1');
  }
);
test(
  'experts expose concrete reasons, at most three, and latest activity',
  () => {
    const context = {
      ...base(),
      pullRequests: [pr()],
      pages: [
        {
          owner: ada,
          title: 'Refunds runbook',
          lastUpdatedAt: '2026-12-09T09:00:00Z'
        }
      ],
      issues: [{
        key: 'PAY-142',
        assignee: ada,
        updatedAt: now
      }]
    };
    const expert = rankExperts(context, {
      now
    })[0];
    assert.deepEqual(
      expert.reasons,
      [
        'Authored PR #42 (api)',
        "Owns 'Refunds runbook'",
        'Assignee of PAY-142'
      ]
    );
    assert.equal(expert.lastActiveAt, now);
  }
);

test('review suggestions prefer linked owners and repository contributors over unrelated experts', async () => {
  const {suggestReviewer} = await import('../src/engine/experts.js');
  const owner = {accountId: 'owner', name: 'Owner'};
  const unrelated = {accountId: 'unrelated', name: 'Unrelated'};
  const request = pr({issueKeys: ['PAY-1'], reviewers: [], author: ada});
  const context = {...base(), people: [ada, unrelated],
    issues: [{key: 'PAY-1', assignee: owner}],
    pages: Array.from({length: 10}, () => ({owner: unrelated, lastUpdatedAt: now})),
    pullRequests: [request, pr({author: ben, reviewers: []})]};
  assert.equal(suggestReviewer(context, request, new Map(), now).person.accountId, owner.accountId);
  context.issues[0].assignee = ada;
  assert.equal(suggestReviewer(context, request, new Map(), now).person.accountId, ben.accountId);
  request.assignee = ben;
  assert.equal(suggestReviewer(context, request, new Map(), now).person.accountId, unrelated.accountId);
});
