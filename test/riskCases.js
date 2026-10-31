import { REVIEW_CASES } from './reviewCases.js';
/** One representative match for each declarative risk rule. */
import { pr, issue, ben, now, ada } from './fixtures.js';
export const RISK_CASES = [
  ...REVIEW_CASES,
  [
    'large diff',
    {
      pullRequests: [pr({
        linesChanged: 501
      })]
    },
    'large-pr',
    5
  ],
  [
    'failing CI',
    {
      builds: [{
        id: 'b',
        state: 'FAILED'
      }]
    },
    'failed-build',
    15
  ],
  [
    'running CI',
    {
      builds: [{
        id: 'b',
        state: 'IN_PROGRESS'
      }]
    },
    'running-build',
    4
  ],
  [
    'staging failure',
    {
      deployments: [{
        id: 'd',
        state: 'FAILED',
        environmentType: 'STAGING'
      }]
    },
    'failed-preprod',
    12
  ],
  [
    'testing rollback',
    {
      deployments: [{
        id: 'd',
        state: 'ROLLED_BACK',
        environmentType: 'TESTING'
      }]
    },
    'failed-preprod',
    12
  ],
  [
    'production rollback',
    {
      deployments: [
        {
          id: 'd',
          state: 'ROLLED_BACK',
          environmentType: 'PRODUCTION',
          updatedAt: '2026-11-28T09:00:00Z'
        }
      ]
    },
    'prod-rollback',
    15
  ],
  [
    'missing validation',
    {
      issues: [issue()],
      pullRequests: [pr({
        status: 'MERGED'
      })]
    },
    'no-preprod',
    6
  ],
  [
    'unfinished issue',
    {
      issues: [issue({
        statusCategory: 'new'
      })]
    },
    'unfinished',
    3
  ],
  [
    'high priority issue',
    {
      issues: [issue({
        statusCategory: 'indeterminate',
        priority: 'High'
      })]
    },
    'unfinished',
    6
  ],
  [
    'unresolved blocker',
    {
      issues: [
        issue({
          blockers: [issue({
            key: 'PAY-143',
            statusCategory: 'new'
          })]
        })
      ]
    },
    'blocked-PAY-142',
    5
  ],
  ['unassigned', {
    issues: [issue({
      assignee: null
    })]
  }, 'unassigned', 3],
  [
    'bus factor',
    {
      pullRequests: [pr({
        reviewers: [{
          person: ada,
          approvalStatus: 'APPROVED'
        }]
      })]
    },
    'bus-factor',
    5
  ],
  ['missing team', {
    teams: [],
    issues: [issue()]
  }, 'no-team', 2],
  [
    'stale runbook',
    {
      pages: [
        {
          id: 'p',
          title: 'Runbook',
          kind: 'runbook',
          lastUpdatedAt: '2026-07-23T09:00:00Z'
        }
      ]
    },
    'stale-runbook',
    5
  ],
  [
    'missing runbook',
    {
      deployments: [{
        id: 'd',
        environmentType: 'PRODUCTION'
      }]
    },
    'no-runbook',
    4
  ],
  [
    'open incident',
    {
      incidents: [{
        key: 'INC-1',
        status: 'Investigating'
      }]
    },
    'open-incident',
    10
  ],
  [
    'three repositories',
    {
      pullRequests: [
        pr(),
        pr({
          id: '2',
          repository: 'ledger'
        }),
        pr({
          id: '3',
          repository: 'checkout'
        })
      ]
    },
    'repositories',
    5
  ],
  [
    'superseded decision',
    {
      pages: [
        {
          id: 'p',
          title: 'ADR deprecated',
          kind: 'decision',
          lastUpdatedAt: now,
          linkedIssueKeys: ['PAY-142']
        }
      ],
      pullRequests: [pr({
        status: 'MERGED',
        updatedAt: '2026-12-01T09:00:00Z'
      })]
    },
    'changed-decision',
    3
  ]
];
