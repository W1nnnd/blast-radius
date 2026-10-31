/** Representative review-rule matches. */
import { pr, ben } from './fixtures.js';
export const REVIEW_CASES = [
  [
    'no reviewers',
    {
      pullRequests: [pr({
        reviewers: []
      })]
    },
    'no-reviewers',
    12
  ],
  [
    'draft reviewers',
    {
      pullRequests: [pr({
        status: 'DRAFT',
        reviewers: []
      })]
    },
    'no-reviewers',
    12
  ],
  [
    'requested changes',
    {
      pullRequests: [pr({
        reviewers: [{
          person: ben,
          approvalStatus: 'NEEDSWORK'
        }]
      })]
    },
    'needs-work',
    10
  ],
  [
    'unapproved',
    {
      pullRequests: [pr({
        reviewers: [{
          person: ben,
          approvalStatus: 'UNAPPROVED'
        }]
      })]
    },
    'unapproved',
    6
  ]
];
