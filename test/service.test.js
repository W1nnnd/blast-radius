import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureAdapter } from '../src/graph/fixtureAdapter.js';
import data from '../src/graph/demoData.js';
import { createService, bounded, mergeContexts } from '../src/service.js';
const service = createService(createFixtureAdapter());
test(
  'risky release HOLD, high confidence and score >= 60',
  async () => {
    const result = await service.analyzeRelease('PAY', '2.4.0');
    assert.equal(result.verdict, 'HOLD');
    assert.ok(result.risk.score >= 60);
    assert.equal(result.risk.confidence, 'high');
    assert.equal(result.counts.issues, 8);
    assert.equal(result.mode, 'fixture');
    assert.match(result.disclaimer, /Demo data/);
    assert.equal(result.generatedAt, data.meta.now.replace('Z', '.000Z'));
    assert.ok(result.topRisks.length <= 3);
    assert.ok(result.checklist.some(issue => issue.id === 'flags'));
  }
);
test(
  'clean hotfix GO, low risk and high confidence',
  async () => {
    const result = await service.analyzeRelease('PAY', '2.3.1');
    assert.equal(result.verdict, 'GO');
    assert.ok(result.risk.score < 30);
    assert.equal(result.risk.confidence, 'high');
    assert.equal(result.counts.issues, 2);
  }
);
test(
  'risky issue, experts and markdown end to end',
  async () => {
    const result = await service.analyzeIssue('PAY-142');
    assert.equal(result.verdict, 'HOLD');
    assert.ok(result.experts.length);
    assert.equal(result.counts.incidents, 1);
    assert.deepEqual((await service.findExperts('PAY-142')).experts, result.experts);
    const checklist = await service.releaseChecklist('PAY', '2.4.0');
    assert.match(checklist.markdown, /- \[ \]/);
    assert.ok(checklist.items.length <= 25);
  }
);
test(
  'fixture does not leak mutable state',
  async () => {
    const firstPerson = createFixtureAdapter();
    const ref = await firstPerson.resolveIssue('PAY-142');
    const context = await firstPerson.getIssueContext(ref);
    context.pullRequests[0].title = 'modified';
    assert.notEqual(
      (await firstPerson.getIssueContext(ref)).pullRequests[0].title,
      'modified'
    );
    assert.ok(Object.isFrozen(data.issues[0]));
  }
);
test(
  'fixture rejects unknown subjects',
  async () => {
    const firstPerson = createFixtureAdapter();
    await assert.rejects(firstPerson.resolveIssue('PAY-999'));
    await assert.rejects(firstPerson.resolveVersion('PAY', '99'));
  }
);
test(
  'merge deduplicates shared objects and unions links',
  async () => {
    const firstPerson = createFixtureAdapter();
    const context = await firstPerson.getIssueContext(await firstPerson.resolveIssue('PAY-142'));
    const deployment = structuredClone(context);
    deployment.pullRequests[0].issueKeys = ['PAY-143'];
    const out = mergeContexts([context, deployment], {
      key: 'release'
    });
    assert.equal(out.pullRequests.length, 1);
    assert.deepEqual(out.pullRequests[0].issueKeys, ['PAY-142', 'PAY-143']);
  }
);
test(
  'bounded recursively limits lists and strings',
  () => {
    const result = bounded({
      a: Array.from({
        length: 40
      }, () => ({
        s: 'x'.repeat(3000)
      }))
    });
    assert.equal(result.a.length, 25);
    assert.equal(result.a[0].s.length, 2000);
  }
);
test(
  'bounded measures UTF8 bytes and rejects over 100KB',
  () => {
    assert.throws(
      () => bounded({
        rows: Array.from({
          length: 25
        }, () => ({
          s: '界'.repeat(2000)
        }))
      }),
      /size limit/
    );
  }
);
test(
  'low confidence without blockers returns insufficient evidence',
  async () => {
    const adapter = createFixtureAdapter();
    const wrapped = {
      ...adapter,
      getIssueContext: async ref => {
        const context = await adapter.getIssueContext(ref);
        context.coverage = {};
        return context;
      }
    };
    const result = await createService(wrapped).analyzeIssue('PAY-150');
    assert.equal(result.verdict, 'INSUFFICIENT_EVIDENCE');
    assert.match(result.risk.summary, /incomplete/);
  }
);
test(
  'known blockers still HOLD when evidence is incomplete',
  async () => {
    const adapter = createFixtureAdapter();
    const wrapped = {
      ...adapter,
      getIssueContext: async ref => {
        const context = await adapter.getIssueContext(ref);
        context.coverage = {};
        return context;
      }
    };
    assert.equal((await createService(wrapped).analyzeIssue('PAY-142')).verdict, 'HOLD');
  }
);
test(
  'release over 25 issues reports truncated coverage',
  async () => {
    const firstPerson = createFixtureAdapter();
    const adapter = {
      ...firstPerson,
      getReleaseIssues: async () => Array.from({
        length: 26
      }, () => ({
        key: 'PAY-150'
      }))
    };
    const result = await createService(adapter).analyzeRelease('PAY', '2.3.1');
    assert.equal(result.risk.confidence, 'low');
    assert.equal(result.verdict, 'INSUFFICIENT_EVIDENCE');
    assert.match(result.coverage.sources.builds.reason, /limit/);
  }
);
test(
  'checklist-only response clearly labels fixture data',
  async () => {
    const result = await service.releaseChecklist('PAY', '2.3.1');
    assert.match(result.markdown, /Demo data/);
    assert.equal(result.mode, 'fixture');
  }
);
test(
  'bounded markdown keeps complete links and baseline actions',
  async () => {
    const result = await service.releaseChecklist('PAY', '2.4.0');
    assert.ok(result.markdown.length <= 2000);
    for (const text of [
      'Confirm rollback plan',
      'Draft release notes',
      'Notify on-call',
      'Identify feature flags / kill switch'
    ]) {
      assert.ok(result.markdown.includes(text));
    }
    assert.ok(result.markdown.endsWith('structured items.'));
  }
);
test(
  'summary names blockers and topRisks use severity then points',
  async () => {
    const report = await service.analyzeRelease('PAY', '2.4.0');
    assert.equal(
      report.risk.summary,
      'HOLD — 2 failing builds, a production rollback 12 days ago and an open incident block PAY 2.4.0.'
    );
    assert.equal(report.topRisks.length, 3);
    assert.ok(report.topRisks.every(signal => signal.severity === 'blocker'));
    assert.deepEqual(report.topRisks.map(signal => signal.points), [15, 15, 15]);
    assert.ok(report.topRisks.every(signal => report.risk.signals.some(item => item.id === signal.id)));
  }
);
test(
  'TWG uses wall-clock time even if the adapter carries fixture metadata',
  async () => {
    const fixture = createFixtureAdapter();
    const start = Date.now();
    const report = await createService({
      ...fixture,
      mode: 'twg'
    }).analyzeIssue('PAY-150');
    assert.ok(Date.parse(report.generatedAt) >= start);
    assert.ok(Date.parse(report.generatedAt) <= Date.now());
  }
);

test('fixture accepts all live demo issue aliases with original evidence', async () => {
  const adapter = createFixtureAdapter();
  for (let index = 0; index < 10; index++) {
    const alias = await adapter.resolveIssue(`PAY-${index + 1}`);
    const original = await adapter.resolveIssue(`PAY-${index + 142}`);
    assert.deepEqual(alias, original);
    assert.deepEqual(await adapter.getIssueContext({key: `PAY-${index + 1}`}),
      await adapter.getIssueContext(original));
  }
  assert.deepEqual(await service.analyzeIssue('PAY-1'), await service.analyzeIssue('PAY-142'));
});
