# Blast Radius

> **Status: skeleton, not yet deployed**

Before a Jira release: what could this change break, who knows about it, and what was already decided? This Forge skeleton connects Jira issues to external pull requests, commits, builds and deployments, Confluence pages and decisions, and owners/teams through Teamwork Graph. It provides three Rovo/MCP actions and a UI Kit issue panel with a deterministic risk score and checklist.

Codegeist category: **Apps for Software Teams**. Bonus-prize eligibility (verified against the official rules on 2026-10-31): Best Agents (`rovo:agent` + reusable `action`s), Best app with Atlassian MCP (`rovo:mcp` + open-source `skills/blast-radius/SKILL.md`), Best apps with Teamwork Graph integration (`requestTeamworkGraph`), and Best Marketplace published app (once submitted for listing). A single submission can win at most one bonus prize.

## Development

Use Node 22 (recommended) or 24. The manifest runtime is nodejs22.x. ESM source is bundled by Forge; package.json declares type: module. The CLI is the only development dependency.

```sh
npm install
npm test
npx --no-install forge lint
```

The queries in src/twg.js are illustrative. Before deployment, verify labels, relationship names/directions, properties, GraphQL argument types and field selections at https://teamwork-graph.atlassian.com/query-builder. The current minimal selection returns IDs and types only. Add verified data fragments and map their fields into the contract documented in src/risk.js before relying on risk scores or expert names. Missing evidence is uncertainty; a low score does not establish safety.

Graph requests use api.asUser() and parameterized queries. Lists are capped at 25, strings at 2,000 characters, and total serialized output at 500,000 UTF-16 units (under 5 MB UTF-8). Risk covers returned evidence only. The Cypher row limit does not bound server-side collection aggregation: add verified collection limits/pagination for production. Errors are surfaced; empty results are explicitly marked.

## Setup when ready

These are instructions only; the app has not been registered, deployed or installed.

1. Authenticate Forge CLI in your environment.
2. Run `npx --no-install forge register` and replace the placeholder app ARI with the registered ID.
3. Verify graph queries, field mappings, scopes and MCP module support, then run `npx --no-install forge lint`.
4. Run `npx --no-install forge deploy`.
5. Install using `npx --no-install forge install --demo-site` or `npx --no-install forge install --site your-site.atlassian.net --product jira`. Confirm flag availability in your CLI version.
6. Enable **Rovo MCP external exposure** for the app through the relevant Atlassian app/admin controls available to your tenant; confirm organization policy and user consent.
7. Connect your OAuth-capable MCP client to `https://mcp.atlassian.com/forge/<appId>` using the registered app ID. See skills/blast-radius/SKILL.md for Claude/Cursor instructions.

`get-change-context` and `find-experts` take issueKey. `score-release-risk` takes versionName and projectKey. Tool outputs include only evidence accessible to the invoking user.

## Validation

The pure model in src/risk.js documents additive weights and thresholds. Tests cover empty context, exact combined scores, every weighted signal, score clamping, checklists, neutral evidence and malformed graph parsing. src/parse.js has no Forge dependency.

MIT license. Copyright 2026 W1nnnd.

### Checks in this workspace

- `npm test`: passed on Node 24.22.1. `node test/index.js` also ran all seven assertions successfully.
- `npm install`: succeeded (2026-10-31).
- `npx --no-install forge lint`: attempted with the available global CLI, offline npm mode, isolated temporary CLI configuration and network connections disabled. Blocked on this headless box by the Secret Service/keytar error (no keyring). Manifest/schema validation remains outstanding until `forge login` works (use `FORGE_EMAIL`/`FORGE_API_TOKEN` env vars or a keyring).
- No login, registration, deployment, installation or push was performed.
