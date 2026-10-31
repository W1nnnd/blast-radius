# Devpost submission — Blast Radius (paste-ready, English)

> 风风 pastes these into the Devpost form and clicks Submit himself. Fill the `<…>` placeholders after deploy.
> Category: **Apps for Software Teams**. Bonus prizes (a submission can win at most one; we qualify for all four):
> Best Agents · Best app with Atlassian MCP · Best apps with Teamwork Graph integration · Best Marketplace published app.

## Project name
Blast Radius

## Tagline (≤ 200 chars)
Know what a release could break before you ship it — a Teamwork Graph–powered go/no-go verdict, checklist and experts in Jira, Rovo and any MCP client.

## Inspiration
Every release review asks the same three questions: *what could this break, who knows this code, and what did we already decide or learn the hard way?* The answers live in five places — Jira, pull requests, CI, deployments and Confluence — so teams either spend an hour clicking around or ship on gut feel. Most incidents we have seen started with something that was already visible: an unreviewed PR, a red staging deploy, a runbook nobody had touched in months. Codegeist's theme — *AI can think, but knowing what to do takes context* — is exactly this gap.

## What it does
Blast Radius turns a Jira issue or release version into a **release-readiness decision**:
- **Verdict** — `GO`, `GO WITH CAUTION`, `HOLD` or `INSUFFICIENT EVIDENCE`, with a 0–100 score and a confidence level.
- **Explainable risks** — 19 named rules in 6 capped categories (code review, CI, deployment, scope, ownership, knowledge). Every point links to the PR, build, deployment, page or incident that caused it.
- **Pre-release checklist** — concrete must/should/nice actions ("Get an approving review on PR #42 (payments-api) — suggested: Iris Lane"), with reviewer suggestions that are never the author and are load-balanced across the team.
- **Who to ask** — people ranked from authored and approved PRs, owned runbooks and assignments, decayed by recency, with their teams.

It works in three places from one engine: a **Jira issue panel**, a **Rovo agent** ("Can we ship PAY 2.4.0?"), and an **Atlassian MCP server** so Claude, Cursor or any MCP client can call the same tools — shipped with an open-source `SKILL.md`.

## How we built it
- **Forge** (nodejs24.x, UI Kit) with `jira:issuePanel`, `rovo:agent`, four reusable `action` modules and `rovo:mcp` exposing the same actions as MCP tools.
- **Teamwork Graph API** via `api.asUser().requestTeamworkGraph`: curated queries (`jiraWorkItemLinkedExternalPullRequests`, `jiraWorkItemLinkedExternalDeployments`, `atlassianUserInTeams`) plus **persisted Cypher** queries executed with `customQuery` for builds, commits, blockers, linked Confluence pages, incidents and release membership (`jira_version_links_jira_work_item`). Jira REST resolves keys to ARIs and provides fallbacks.
- **Deterministic engine** (pure JavaScript, no LLM in the score): declarative rule table → capped categories → level + blockers → verdict; coverage-aware confidence; checklist and expert ranking on the same normalized model.
- **Least privilege**: `read:jira-work` + 12 per-object `read:graph:*` scopes, read-only, no egress, all user-scoped.
- **Quality**: 101 unit tests (engine, adapters with fake GraphQL, handlers, manifest, scripts), manifest validated against the Forge JSON schema, bounded and sanitized outputs for LLM consumers.

## Challenges we ran into
- Teamwork Graph moved from raw Cypher to curated + persisted queries during the hackathon window, and a missing scope returns *empty* rather than an error. We designed for that: a swappable adapter, per-source coverage, and a verdict that says `INSUFFICIENT EVIDENCE` instead of a false green.
- Making a score that agents can explain without hallucinating — solved by keeping the number deterministic and returning evidence links with every signal.

## Accomplishments that we're proud of
- One engine, three surfaces (human, Rovo, any MCP client) with identical answers.
- A score you can audit line by line, and a checklist that assigns real people.

## What we learned
Graph context is only useful if the app is honest about what it *couldn't* see. Coverage and confidence are first-class outputs.

## What's next
Write the assessment back into Teamwork Graph through a connector so other agents can reuse it; release-gate automation rule ("block transition to Released when verdict is HOLD"); Bitbucket/Compass component signals.

## Built with
forge, ui-kit, rovo, rovo-mcp, teamwork-graph, jira, confluence, javascript, node.js, graphql, cypher

## How the project meets the main technology requirement
Blast Radius is a Forge app (`manifest.yml` with `jira:issuePanel`, `rovo:agent`, `action`, `rovo:mcp` modules) that integrates with Jira (issue panel, REST), Teamwork Graph (curated + persisted Cypher queries via `requestTeamworkGraph`), Confluence content via the graph, and Rovo (agent + MCP). It runs entirely on Atlassian Forge.

## Bonus prize explanations
- **Best Agents:** `rovo:agent` "Blast Radius" with four reusable `action` modules (GET) that other agents can invoke as tools; structured prompt with prompt-injection guard; conversation starters for the demo.
- **Best app with Atlassian MCP:** `rovo:mcp` exposes the same four actions at `https://mcp.atlassian.com/forge/<appId>`; open-source `skills/blast-radius/SKILL.md` teaches Claude/Cursor when and how to call them. Demo shows Claude/Cursor calling `score-release-risk`.
- **Best apps with Teamwork Graph integration:** consumes TWG with curated queries and six persisted Cypher traversals across Jira, external dev tools, Confluence, people and teams; per-object scopes; coverage-aware results.
- **Best Marketplace published app:** `<Marketplace listing or review-ticket link>` (separate unlicensed copy keeps the installation link for judges).

## Installation link & testing instructions (for judges)
1. Open `<installation link>` and install into your Jira Cloud site (Jira only; takes ~1 minute). Accept the read-only scopes.
2. Open any issue → **Apps → Blast Radius** panel. With linked PRs/builds/deployments (GitHub/Bitbucket for Jira) you get live results; otherwise the coverage tab tells you which sources were empty.
3. Rovo Chat → Agents → **Blast Radius** → "Can we ship <PROJECT> <version>?" or "What could <ISSUE-KEY> break?".
4. MCP (optional): an admin enables the app's tools under Atlassian Administration → Connected apps → Blast Radius. Add `https://mcp.atlassian.com/forge/<appId>` as a remote MCP server in Claude/Cursor.
5. Demo data: our demo site `<site>.atlassian.net` has project PAY with releases 2.4.0 (HOLD) and 2.3.1 (GO). Test account on request: `<email>`.

## Links
- Video: `<YouTube URL>` · Repository (optional, not required by rules): `<repo URL or "available on request">`
