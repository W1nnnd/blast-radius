import { now, ada, ben, base, pr, run } from './fixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChecklist, toMarkdown } from '../src/engine/checklist.js';
test(
  'baseline checklist is always present',
  () => {
    const items = buildChecklist(base(), run({}));
    assert.equal(items.length, 4);
    assert.ok(items.every(i => i.source === 'baseline' && !i.done));
  }
);
test(
  'checklist is deduplicated and must sorts first',
  () => {
    const context = {
      ...base(),
      builds: [{
        id: 'b',
        state: 'FAILED'
      }],
      pullRequests: [pr({
        reviewers: []
      })]
    };
    const result = run(context);
    result.signals.push(result.signals[0]);
    const items = buildChecklist(context, result);
    assert.equal(new Set(items.map(i => i.id)).size, items.length);
    assert.equal(items[0].priority, 'must');
  }
);
test(
  'checklist reviewer excludes author',
  () => {
    const context = {
      ...base(),
      pullRequests: [pr({
        reviewers: []
      }), pr({
        id: 'pr2',
        author: ben,
        reviewers: []
      })]
    };
    const items = buildChecklist(context, run(context));
    assert.match(items.find(i => i.id === 'no-reviewers:42').text, /suggested: Ben/);
  }
);
test(
  'markdown includes checkboxes, links and risk',
  () => {
    const context = {
      ...base(),
      builds: [
        {
          id: 'b',
          state: 'FAILED',
          url: 'https://example.test/build',
          name: 'Build'
        }
      ]
    };
    const result = run(context);
    const md = toMarkdown(buildChecklist(context, result), result, {
      key: 'PAY:2.4.0'
    });
    assert.match(md, /- \[ \] \*\*must\*\*/);
    assert.match(md, /\[Build\]\(https:\/\/example.test\/build\)/);
    assert.match(md, /15\/100/);
    assert.match(md, /Confirm rollback plan/);
  }
);
test(
  'reviewer suggestions exclude authors and rotate after two assignments',
  () => {
    const context = {
      ...base(),
      meta: {
        now
      },
      people: [
        ada,
        ben,
        {
          accountId: 'd',
          name: 'Dara'
        },
        {
          accountId: 'c',
          name: 'Cara'
        }
      ],
      pullRequests: Array.from(
        {
          length: 6
        },
        (_, index) => pr({
          id: `review-${index}`,
          displayId: String(100 + index),
          reviewers: []
        })
      )
    };
    const items = buildChecklist(context, run(context)).filter(item => item.owner);
    const assignments = new Map();
    for (const item of items) {
      assert.notEqual(item.owner.accountId, ada.accountId);
      assignments.set(item.owner.accountId, (assignments.get(item.owner.accountId) ?? 0) + 1);
    }
    assert.equal(items.length, 6);
    assert.equal(assignments.size, 3);
    assert.ok(Math.max(...assignments.values()) <= 2);
    assert.deepEqual(
      buildChecklist(context, run(context)),
      buildChecklist(context, run(context))
    );
  }
);
test(
  'checklist caps signal actions, preserves baselines and reports overflow last',
  () => {
    const context = {
      ...base(),
      builds: Array.from(
        {
          length: 20
        },
        (_, index) => ({
          id: `build-${index}`,
          name: `payments-api #${index}`,
          state: 'FAILED'
        })
      )
    };
    const items = buildChecklist(context, run(context));
    assert.equal(items.filter(item => item.source === 'signal').length, 12);
    assert.equal(items.filter(item => item.source === 'baseline').length, 4);
    assert.equal(items.at(-1).text, '8 more lower-priority items in the Risks tab');
  }
);
test(
  'reviewer preference uses repository history before team membership',
  () => {
    const cara = {
      accountId: 'c',
      name: 'Cara'
    };
    const context = {
      ...base(),
      meta: {
        now
      },
      people: [ada, ben, cara],
      teams: [{
        name: 'Core',
        members: ['a', 'b']
      }],
      pullRequests: [
        pr({
          reviewers: []
        }),
        pr({
          id: 'old',
          displayId: '40',
          status: 'MERGED',
          reviewers: [{
            person: cara,
            approvalStatus: 'APPROVED'
          }]
        })
      ]
    };
    const item = buildChecklist(context, run(context)).find(item => item.id === 'no-reviewers:42');
    assert.equal(item.owner.accountId, 'c');
    assert.match(item.text, /owns api reviews/);
  }
);
test(
  'reviewer recency uses analysis time rather than the PR update timestamp',
  () => {
    const cara = {
      accountId: 'c',
      name: 'Cara'
    };
    const context = {
      ...base(),
      meta: {
        now
      },
      people: [ada, ben, cara],
      pullRequests: [pr({
        updatedAt: '2020-01-01T00:00:00Z',
        reviewers: []
      })],
      pages: [
        {
          owner: ben,
          title: 'Old guide',
          lastUpdatedAt: '2020-01-01T00:00:00Z'
        },
        {
          owner: cara,
          title: 'Current guide',
          lastUpdatedAt: now
        }
      ]
    };
    const item = buildChecklist(context, run(context)).find(item => item.id === 'no-reviewers:42');
    assert.equal(item.owner.accountId, 'c');
  }
);
