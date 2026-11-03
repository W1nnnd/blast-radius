# Devpost submission — Blast Radius

Category: **Apps for Software Teams**. Status as of **2026-11-03 15:45 SGT**: production **2.0.0** is deployed and installed in Jira + Confluence on the demo site, `one-atlas-wdon.atlassian.net`; production distribution is **Sharing** (anyone with the link). Development **2.4.0** remains installed on the same site alongside production.

## Project name
Blast Radius

## Tagline
Know what a release could break before you ship it — explainable release risk, evidence, checklists and suggested reviewers in Jira, Rovo and MCP tools.

## Inspiration
Release decisions depend on context scattered across Jira issues, code reviews, CI, deployments and Confluence. We wanted a release review that brings those signals together and makes missing evidence visible, so a team can see both what needs attention and what still needs checking.

## What it does
Blast Radius analyzes a Jira issue or release version and returns a deterministic 0–100 risk score, a verdict (`GO`, `GO_WITH_CAUTION`, `HOLD` or `INSUFFICIENT_EVIDENCE`), linked risks, a checklist with suggested reviewers, expert suggestions and evidence coverage. No LLM decides the score.

The live development story is **Northwind Pay 2.4.0**: seven release issues (PAY-1…PAY-7), failed CI on PAY-1 and PAY-4, open PRs awaiting approval, staging-only deployment of `2.4.0-rc1`, and open incident **[INCIDENT] PAY-11** linked to PAY-1 and PAY-4. PAY-2/PAY-7 block PAY-1; PAY-8 from 2.3.1 blocks PAY-4. Confluence provides a runbook, ADR-024, rollback plan and postmortem.

Real Jira-REST-only previews return **HOLD 82/100** for release 2.4.0 and **HOLD 67/100** for PAY-1. TWG is disabled in that preview script; the Forge panel can differ slightly when TWG adds pages. These are preview results, not completed browser verification.

The engine serves a Jira issue panel, Rovo agent **Blast Radius** with four actions, and `rovo:mcp` with the same four tools. External MCP exposure is implemented but not yet enabled on this site.

## How we built it
We built on Forge with UI Kit, `jira:issuePanel`, `rovo:agent`, four `action` modules and `rovo:mcp`. A shared JavaScript engine applies named risk rules in capped categories and builds the checklist and expert ranking from normalized evidence.

In Forge, **Teamwork Graph comes first**: curated queries retrieve PRs and deployments; six persisted Cypher queries cover builds, commits, blockers, pages, releaseIssues and incidents. The persisted queries were registered in TWG Labs and executed through `customQuery`; curated queries also supply team context.

On this site TWG returned two pages but no dev-tool objects because no GitHub/Bitbucket connector is installed. The app falls back to Jira remote links, explicitly labelled **“Jira remote link (not Teamwork Graph)”** in Evidence/coverage. Jira REST issue links provide blockers when the graph has none, and REST supports issue resolution and release membership. Every source failure becomes a coverage note rather than a blank panel.

Forge reads run as the requesting user. The repository has **141 tests** covering the engine, adapters, handlers and supporting behavior. The saved live preview JSON files are separate from the fixture dataset.

## Challenges we ran into

- **Forge webpack / CommonJS interop:** default imports from CommonJS Forge packages caused a module-load constructor crash. Namespace imports and explicit export resolution fixed the loading path.
- **TWG operation names:** the gateway required the `[company]_[operation]` shape; correcting the operation name unblocked requests.
- **Query registration:** API-token registration was rejected, so we registered the six persisted queries in TWG Labs.
- **Partial graph failures:** a persisted page query returned an internal error. We preserve source errors as coverage notes; later reads returning two pages do not prove all queries are healthy.
- **No dev-tool connector:** the demo site could not return graph PR/build/deployment objects. We added clearly labelled remote-link fallback rather than presenting seeded links as graph evidence.

## Accomplishments that we're proud of
We deployed development version 2.4.0 in Jira and Confluence, applied a coherent release-risk seed including PAY-11, and captured real REST preview results. The release preview identifies failed CI on both PAY-1 and PAY-4 and the open incident as its top risks. Its checklist includes suggested reviewers. The shared engine supports the panel, Rovo actions and MCP tools while keeping source provenance visible.

## What we learned
A graph integration needs to explain empty results and failures as carefully as successful results. Connector availability, query registration, operation naming and runtime packaging all affect whether evidence reaches the user. Coverage is part of the decision, and seeded remote links must remain distinguishable from connected dev-tool data.

## What's next
Complete browser verification of the panel, release analysis and Rovo flow; enable and verify MCP tools. Connect a dev tool to validate graph-backed PR/build/deployment evidence. Future ideas include release-gate automation and additional component signals; these are not shipped claims.

## Built with
Forge, UI Kit, Jira, Confluence, Rovo, Atlassian MCP, Teamwork Graph, JavaScript, Node.js, GraphQL, Cypher.

## How the project meets the main technology requirement
Blast Radius is a Forge app integrating Jira issue context and REST, Teamwork Graph curated and persisted queries, Confluence page context, and Rovo actions. The panel and agent use the same engine; external agents can use the MCP tools after a site admin enables exposure.

## Bonus prize explanations

- **Agents:** Blast Radius is a Rovo agent with four reusable actions: `get-change-context`, `score-release-risk`, `find-experts`, `generate-release-checklist`.
- **Atlassian MCP:** `rovo:mcp` exposes the same tools after admin enablement. TODO: enable and verify an external client recording. The repository includes `skills/blast-radius/SKILL.md`.
- **Teamwork Graph:** curated queries and six persisted Cypher queries run first, with explicit source coverage and labelled fallbacks.
- **Marketplace:** TODO: listing or review-ticket link, if pursuing this category. Publication and eligibility are not established here.

## Installation link & testing instructions (for judges)

**Production installation:** [Install Blast Radius (Jira + Confluence)](https://developer.atlassian.com/console/install/71f0dc36-ccf4-4d78-88d0-882f02159e9e?signature=AYABeEC%2FquugkMsvNi4Q7nmrOQcAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucB1%2BJ2sKS%2FiGZjMTu24%2FfDPgAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDAgRKouexwBl7hFEdAIBEIA71ZRwJmmI8Yj%2BkOwCEa74hIr%2BDM9JkRnFqGZA2h2908ktHUV%2FZFwddD6ZwM3qlb18xk9q%2FLyhQ5dF7fMAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgGBHpzSSMl6ujKbhtb8iqTZAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMJvsXT6yOk58RqcamAgEQgDvmQkuu%2Fku92GPq0wM3Dn8jRRbLu4PNVi8OQa%2B69v6Th%2B%2F05ETRLhJ8orYISi%2FjwtodcEyZfMGjeCDT5AAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAQxZt0EA9AWKXRENiqodsK8AAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAyRjMS7rsSk4bNigwICARCAO21WTrB9mtgKtRe7mh7ajV84qGQ51TRJP7vs3JOsaak4tSFtXrAANGJKWAbpEmPa%2BXza2D9Zf%2BcgWmtsAgAAAAAMAAAQAAAAAAAAAAAAAAAAADe9vyO6jXeBEtFTgo1PVN3%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADJodzFHBml8DIJfK4hoi2iG8TGoQxYU6rQEAPzXSPpBLK%2BTshD%2FALI6YMNFBzSY6A99snKSGZnPJ90rJS0T0INvNXc%3D&product=jira&product=confluence). The installing user must be a site admin and should install on **both Jira and Confluence**. Production **2.0.0** is deployed and installed in Jira + Confluence alongside development **2.4.0** on the demo site; judge access has not been established. Distribution is **Sharing** (anyone with the link); see [deployment status](DEPLOY_STATUS.md).

Install via the link on a site with **Jira + Confluence**, then open a Jira issue → **Apps → Blast Radius** and analyze an issue or release with evidence available to your user. Alternatively, once access to the seeded demo site is arranged, use the demo below (the PAY examples and scores apply to that site):

1. Open [PAY-1](https://one-atlas-wdon.atlassian.net/browse/PAY-1) → **Apps → Blast Radius**. Expect approximately **HOLD 67/100**; inspect failed CI and incident PAY-11.
2. Open **Evidence**. Check provenance labels, including **“Jira remote link (not Teamwork Graph)”**, and coverage notes for unavailable sources. No dev-tool connector is installed.
3. Use the panel’s release option to analyze **PAY 2.4.0**. Expect approximately **HOLD 82/100**, with failed builds on PAY-1/PAY-4 and open incident PAY-11 among the top risks. Open **Checklist** for actions and suggested reviewers. Panel scores can differ slightly from REST previews when TWG adds pages.
4. In Rovo Chat choose **Blast Radius** and ask **“Can we ship PAY 2.4.0?”**. TODO: verify the current browser response before recording or sharing.
5. Optional MCP, **only after enablement**: a site admin opens **Atlassian Administration → Apps → Sites → one-atlas-wdon → Connected apps → Blast Radius → View app details → Tools / “Expose tools via external MCP endpoint”**. Configure `https://mcp.atlassian.com/forge/71f0dc36-ccf4-4d78-88d0-882f02159e9e` in a compatible client and call `score-release-risk` with `projectKey: PAY`, `versionName: 2.4.0`. Tools are not yet enabled; verification is TODO.

For offline inspection, see [release preview](../demo/live-preview-release-2.4.0.json) and [PAY-1 preview](../demo/live-preview-PAY-1.json). These are real outputs of `node scripts/live-preview.mjs` after `scripts/seed-live-v2.mjs`; preview uses Jira REST only, with TWG disabled.

## Links

- Installation/sharing link: [Install Blast Radius (Jira + Confluence)](https://developer.atlassian.com/console/install/71f0dc36-ccf4-4d78-88d0-882f02159e9e?signature=AYABeEC%2FquugkMsvNi4Q7nmrOQcAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucB1%2BJ2sKS%2FiGZjMTu24%2FfDPgAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDAgRKouexwBl7hFEdAIBEIA71ZRwJmmI8Yj%2BkOwCEa74hIr%2BDM9JkRnFqGZA2h2908ktHUV%2FZFwddD6ZwM3qlb18xk9q%2FLyhQ5dF7fMAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgGBHpzSSMl6ujKbhtb8iqTZAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMJvsXT6yOk58RqcamAgEQgDvmQkuu%2Fku92GPq0wM3Dn8jRRbLu4PNVi8OQa%2B69v6Th%2B%2F05ETRLhJ8orYISi%2FjwtodcEyZfMGjeCDT5AAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAQxZt0EA9AWKXRENiqodsK8AAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAyRjMS7rsSk4bNigwICARCAO21WTrB9mtgKtRe7mh7ajV84qGQ51TRJP7vs3JOsaak4tSFtXrAANGJKWAbpEmPa%2BXza2D9Zf%2BcgWmtsAgAAAAAMAAAQAAAAAAAAAAAAAAAAADe9vyO6jXeBEtFTgo1PVN3%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADJodzFHBml8DIJfK4hoi2iG8TGoQxYU6rQEAPzXSPpBLK%2BTshD%2FALI6YMNFBzSY6A99snKSGZnPJ90rJS0T0INvNXc%3D&product=jira&product=confluence).
- Video URL: **TODO**.
- Repository URL: [W1nnnd/blast-radius](https://github.com/W1nnnd/blast-radius) (public, `main`, MIT).
