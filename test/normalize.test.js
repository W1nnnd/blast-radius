/** Normalized TWG values preserve casing and unknown-state contracts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePR, normalizeDeployment, normalizePage, normalizeIssue } from '../src/graph/twgNormalize.js';
test(
  'TWG normalization handles casing and nulls without fixture-only line counts',
  () => {
    const pullRequest = normalizePR(
      {
        id: '1',
        status: 'merged',
        reviewers: [{
          user: null,
          approvalStatus: 'approved'
        }],
        linesChanged: 900
      },
      'PAY-1'
    );
    assert.equal(pullRequest.status, 'MERGED');
    assert.equal(pullRequest.linesChanged, null);
    assert.equal(pullRequest.reviewers[0].approvalStatus, 'APPROVED');
    assert.equal(pullRequest.author, null);
    assert.equal(
      normalizeDeployment({
        state: 'rolled_back',
        environment: {
          type: 'production'
        }
      }, 'PAY-1').environmentType,
      'PRODUCTION'
    );
    assert.equal(normalizeDeployment({}, 'PAY-1').state, 'UNKNOWN');
    assert.equal(normalizePage({
      title: 'ADR-17 decision'
    }, 'PAY-1').kind, 'decision');
    assert.equal(
      normalizeIssue({
        status: {
          name: 'Done',
          statusCategory: {
            key: 'DONE'
          }
        }
      }).statusCategory,
      'done'
    );
  }
);
