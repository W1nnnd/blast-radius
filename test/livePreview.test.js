import test from 'node:test';
import assert from 'node:assert/strict';
import {preview, route} from '../scripts/live-preview.mjs';

test('preview encodes route interpolations and runs real Jira fallback with mocked HTTP', async () => {
  assert.equal(route`/issue/${'PAY/1?x=y'}?q=${'a & b'}`, '/issue/PAY%2F1%3Fx%3Dy?q=a%20%26%20b');
  const seen = [];
  const result = await preview(['--issue', 'PAY-1'], {
    env: {FORGE_EMAIL: 'test@example.invalid', FORGE_API_TOKEN: 'fake-token'},
    fetcher: async (url, options) => {
      seen.push(url);
      assert.equal(options.redirect, 'error');
      const data = url.endsWith('/_edge/tenant_info') ? {cloudId: 'tenant'}
        : url.endsWith('/remotelink') ? []
          : {id: '1', key: 'PAY-1', fields: {summary: 'Example', assignee: {accountId: 'private-id', displayName: 'Ada'}}};
      return {ok: true, json: async () => data};
    }
  });
  assert.equal(seen.length, 3);
  assert.equal(result.coverage.pages.reason, 'Teamwork Graph had no dev-tool data; Jira remote links checked');
  assert.equal(result.coverage.pages.available, true);
  assert.equal(result.coverage.pages.via, 'jira-remote-link');
  assert.ok(result.checklist.includes('Confirm rollback plan'));
  assert.equal(result.experts[0].name, 'Ada');
  assert.doesNotMatch(JSON.stringify(result), /private-id|fake-token|test@example/);
});
