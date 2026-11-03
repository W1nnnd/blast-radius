import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiraRest } from '../src/jira/jiraRest.js';
test(
  'Jira REST resolves issue ARI and fixVersions via injected transport',
  async () => {
    const seen = [];
    const jira = createJiraRest({
      cloudId: 'cloud',
      route: (strings, ...value) => strings.reduce((source, x, issue) => source + x + (value[issue] ?? ''), ''),
      request: async path => {
        seen.push(path);
        return {
          id: '100',
          key: 'PAY-142',
          fields: {
            summary: 'Refund',
            fixVersions: [{
              name: '2.4.0'
            }],
            project: {
              key: 'PAY'
            },
            assignee: {
              accountId: 'a',
              displayName: 'Ada'
            }
          }
        };
      }
    });
    const result = await jira.resolveIssue('PAY-142');
    assert.equal(result.ari, 'ari:cloud:jira:cloud:issue/100');
    assert.equal(result.assignee.name, 'Ada');
    assert.match(seen[0], /\/rest\/api\/3\/issue\/PAY-142/);
  }
);
test(
  'Jira REST version resolution queries fixVersion name and follows JQL pages',
  async () => {
    const seen = [];
    let node = 0;
    const jira = createJiraRest({
      cloudId: 'c',
      route: (source, ...value) => source.reduce((firstPerson, build, issue) => firstPerson + build + (value[issue] ?? ''), ''),
      request: async (path, opts) => {
        seen.push({
          path,
          opts
        });
        if (path.includes('/versions')) {
          return [{
            id: '240',
            name: '2.4.0'
          }];
        }
        return ++node === 1
          ? {
            issues: [{
              key: 'PAY-142'
            }],
            nextPageToken: 'next',
            isLast: false
          }
          : {
            issues: [{
              key: 'PAY-143'
            }],
            isLast: true
          };
      }
    });
    const result = await jira.resolveVersion('PAY', '2.4.0');
    assert.deepEqual(result.issueKeys, ['PAY-142', 'PAY-143']);
    assert.equal(result.ari, 'ari:cloud:jira:c:version/240');
    assert.match(JSON.parse(seen[1].opts.body).jql, /fixVersion = "2\.4\.0"/);
    assert.equal(JSON.parse(seen[2].opts.body).nextPageToken, 'next');
  }
);
test(
  'Jira failures fail closed and no cloudId is invented',
  async () => {
    const route = () => '/';
    await assert.rejects(createJiraRest({
      route,
      request: async () => ({
        ok: false
      })
    }).resolveIssue('PAY-142'));
    await assert.rejects(createJiraRest({
      route,
      request: async () => ({
        id: '1',
        key: 'PAY-142'
      })
    }).resolveIssue('PAY-142'));
  }
);
