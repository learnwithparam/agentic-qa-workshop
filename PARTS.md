# Parts: what is built and what each part session builds

The spine is built: the world, the checker library, the finished suite, the orientation, Part 1 and Part 6. Parts 2 to 5
have a README with the problem, a diagram and the step table, and no step folders yet. A part session builds one
part from this file, its part README, and the code it points to.

## Built

| Folder                                              | Steps                                                                                                   | Minutes                | Status                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `00-orientation/`                                   | meet-the-shop                                                                                           | 15                     | complete: check, solution, 2 wrong answers, picture                                                       |
| `parts/01-write-tests-with-agents/`                 | write-the-seed-test, plan-tests-from-requirements, generate-tests-from-the-plan, review-the-agent-tests | 10 + 20 + 15 + 10 = 55 | complete: 4 checks, solutions, 2 or 3 wrong answers each, pictures; agent work in Claude Code             |
| `parts/06-redo-a-flow-with-playwright-test-agents/` | redo-the-flow-with-agents                                                                               | 15                     | complete: check, solution, wrong answers; Playwright Test Agents on one flow, run as `bun run assignment` |
| `world/finished/`                                   | the finished system                                                                                     | none                   | `bun run finished`: a real Claude Code run, or a replay of `world/recordings/`                            |

## To build

### `parts/02-prove-the-tests-catch-bugs/` (60 minutes)

| Step                  | Min | The check reads                                                                                                                                                                                                                                                                                 |
| --------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| catch-the-seeded-bugs | 20  | `bugKillMatrix(problem/tests, <the 8 requirement bugs>)`: at least 7 caught, baseline green. Print the grid with `printMatrix` and name each missed bug with its requirement and a hint.                                                                                                        |
| kill-the-mutants      | 25  | Stryker's JSON report: score at least 70 on `world/domain/{slots,basket,substitutions}.ts` with `thresholds.break: 70`; every learner test file kills at least one mutant; tests pass on the fixed domain code.                                                                                 |
| guard-the-assertions  | 15  | Feed 8 planted unified diffs to the learner's `qa/guard.ts` on stdin: reject (exit 2) an `expect` removed, `test.fixme` added, `test.skip` added, an expected total changed from `12.40` to `12.41`, `maxDiffPixels` raised; accept (exit 0) a locator change, a new assertion, a renamed test. |

### `parts/03-keep-the-suite-healthy/` (60 minutes)

| Step                         | Min | The check reads                                                                                                                                                                                                                                                      |
| ---------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| heal-a-renamed-button        | 15  | The learner suite on `startShop({ release: "v2" })`: tests that failed only on renamed or moved elements pass; diff against the starter touches locators only; `expect` count per file the same or higher (`checks/lib/static.ts`); no `fixme` or `skip`.            |
| stop-the-healer-hiding-a-bug | 10  | The SUB-1 test still fails on v2 and still asserts substitutes are allowed by default; `qa/bugs/SUB-1.md` has Steps, Expected, Actual, Requirement.                                                                                                                  |
| triage-the-flaky-tests       | 20  | `runSuite(..., { repeatEach: 20, args: ["--shuffle"] })` on the learner's fixed copy of `world/legacy-tests`: 0 failures, 0 flaky; no `retries` raised; `qa/triage.json` entries `{ test, cause, evidence, fix, approvedBy }` with causes matching the planted ones. |
| check-looks-and-access       | 15  | `tests/visual.spec.ts` and `tests/a11y.spec.ts`: green on the fixed build, red on `price-overlap` and on `missing-label`.                                                                                                                                            |

### `parts/04-test-beyond-the-ui/` (60 minutes)

| Step                            | Min | The check reads                                                                                                                                                                                                                                |
| ------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| test-the-order-api-contract     | 20  | Green on the fixed build, red on `api-field-rename` and on `api-status`; every path and status code in `world/openapi.yaml` exercised (count `request.` calls and status expectations).                                                        |
| explore-with-an-agent           | 15  | `qa/explore/charter.md` with Mission, Areas, Time box; each `qa/explore/*.spec.ts` with a `// finding:` line fails on `BUGS=release` and passes with only its own bug off; at least 2 of `double-book`, `negative-qty`, `back-resubmit` found. |
| test-the-substitution-suggester | 25  | Notes list at least 3 failure kinds seen in 20 outputs; `qa/ai-thresholds.json` `{ seeds, minPassRate, hardFail }`; suite passes at least 95% on the fixed build and goes red on `ai-allergen`; allergen is in `hardFail`.                     |

### `parts/05-run-it-as-a-team/` (100 minutes)

| Step                         | Min | The check reads                                                                                                                                                                                                                       |
| ---------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| compare-mcp-and-cli          | 20  | `qa/mcp-vs-cli.md`: tokens, time and findings for both, and a choice with a reason.                                                                                                                                                   |
| fuzz-the-api-from-the-schema | 20  | A Schemathesis run (pin with `==` in `pyproject.toml`, `uv run`) or a TypeScript property test: finds `api-status` on `BUGS=release`, zero failures on the fixed build.                                                               |
| measure-the-agent-cost       | 15  | `qa/cost.md`: numbers for plan, generate and heal; a cost per kept test, kept tests counted from git.                                                                                                                                 |
| gate-the-pull-request        | 25  | `bun run gate`: guard, suite, matrix, Stryker break, `--fail-on-flaky-tests`; fails on 4 planted bad pull requests, passes on a clean one. The CI file is the learner's, inside their step folder: never edit this repo's `.github/`. |
| write-the-team-playbook      | 20  | `qa/playbook.md` sections Agents may, Agents may not, Human gates, Numbers we report; each number is one the gate computes.                                                                                                           |

## What the world gives a part session

- **Bug switches**: `world/bugs.ts` (id, requirement, group, the step that should catch it). `startShop({ bugs })`
  in `checks/lib/world.ts` starts a private shop on a free port with its own data folder.
- **Release v2**: `RELEASE=v2` or `startShop({ release: "v2" })`. Add becomes "Add to basket", Book slot becomes
  "Reserve", the slot picker moves into a dialog behind "Choose a delivery time", and new lines start with
  substitutes off (the SUB-1 regression).
- **Legacy suite**: `world/legacy-tests/`, 25 tests. Three are flaky by design: "suggestions appear for out of stock
  milk" (race: a fixed 500 ms sleep against a 100 to 800 ms delay), "orders page lists my order" in
  `orders.spec.ts` (shared data: passes only when it runs straight after "place an order"; `--shuffle` breaks it),
  and "next-date slots are open when the store clock is now" (clock: uses the real time, so it fails after 22:00
  Larkford time).
- **Test hooks**: `POST /__test/reset`, `POST /__test/clock { at }`, `GET /__test/state`. The event log
  `events.jsonl` in the shop's data folder survives resets; `checks/lib/events.ts` reads it.
- **Checker library**: `runSuite` (Playwright JSON results), `bugKillMatrix` and `printMatrix`, `testsIn` and
  `CSS_OR_XPATH` for static rules, `scenarios` for plans, `once` to share one run between rules.
- **AI feature**: `world/suggester.ts` asks the shop's stand-in model, `world/replay/model.ts`, which answers from
  `world/replay/replies.json` for the 5 out-of-stock items, the 3 shoppers and seeds 1 to 20, in both the fixed
  and the `ai-allergen` variant. `bun world/replay/make.ts` rebuilds the replies (scripted). No step's subject is
  calling a model from code, so the suggester never calls one: the learner tests the feature from outside.
- **Finished suite**: `reference/tests` catches all 16 bugs. Which test catches which bug:

| Bug                | Caught by (reference suite)                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| slot-cutoff        | next-date slots close at 22:00 store time                                                        |
| slot-capacity      | a full slot shows Full and cannot be booked; a full slot answers 409 slot_full                   |
| weighted-price     | 750 g of bananas at $1.39 per kg costs $1.04                                                     |
| promo-stacking     | the SAVE10 voucher skips 3 for 2 lines; the total adds delivery and takes off offers and voucher |
| min-order          | checkout closes again when the basket drops below $25.00                                         |
| ghost-line         | removing the last unit removes the line                                                          |
| sub-allergen       | a substitute never has an allergen the shopper declared                                          |
| sub-optout-chilled | no substitutes is respected for chilled milk                                                     |
| price-overlap      | on a 375 px phone no price sits on its Add button                                                |
| missing-label      | the slot picker has no WCAG 2.1 AA violations, and every test that finds a slot by its name      |
| api-field-rename   | POST /api/orders returns 201 and an Order                                                        |
| api-status         | a full slot answers 409 slot_full                                                                |
| double-book        | a double click on Book slot books one slot                                                       |
| negative-qty       | the quantity box refuses a negative number                                                       |
| back-resubmit      | going back after checkout does not place a second order                                          |
| ai-allergen        | suggestions follow SUB-3 to SUB-7 over 20 seeds                                                  |

## Claude Code is the agent

This course follows `briefs/build/CLAUDE-CODE.md` in the curriculum repo. Every agent step runs in the real Claude
Code (the `claude` CLI, the editor extension or Claude Desktop's Code tab), signed in with the learner's own Claude
account. No step calls the model API, asks for an API key, or ships a script that stands in for Claude.
What the learner builds is Claude Code configuration and the work Claude Code does with it.

- **Checks read what Claude Code produced**: plans, tests, `qa/` files, git history, the guard log. Never a reply.
- **Hooks are tested for real with no model**: feed the hook the exact PreToolUse JSON Claude Code sends on stdin
  (`session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, `tool_name`, `tool_input`,
  `tool_use_id`) and assert the exit code (2 blocks, the reason on stderr). `tests/claude-code.test.ts` shows the
  pattern on the finished run's `test-rules` hook.
- **The finished system** is `bun run finished` (`world/finished/run.ts`): a live `claude -p` run on a fresh copy of
  `world/finished/template` (its `CLAUDE.md`, `.claude/settings.json`, `.claude/hooks/test-rules.ts`, the seed
  test, and Playwright's agents from `init-agents --loop=claude`), scored by the Part 1 rules and the bug-kill
  matrix. With no signed-in `claude`, or in CI, it replays `world/recordings/finished-N`. Run-to-run variance is
  judged over 3 recordings with `bun run finished --replay all`.
- **Recordings are real.** `bun run finished --record N` saves the stream-json transcript (model ids and home paths
  redacted) and the files it wrote. `world/recordings/RECORD.md` lists every recording and how to remake it.

What each remaining part does in Claude Code:

| Step                                                | In Claude Code                                                                                                                                                                                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| guard-the-assertions                                | `qa/guard.ts` keeps the diff-on-stdin contract for the gate, and also runs as a PreToolUse hook on `Edit                                                                                                                               | Write`in the learner's`.claude/settings.json`. The check feeds it real PreToolUse JSON for Edit and Write calls (old and new text) as well as the 8 diffs. |
| heal-a-renamed-button, stop-the-healer-hiding-a-bug | The learner runs `playwright-test-healer` in Claude Code with the guard hook on. The check reads the healed files and the guard log, never the chat. A recording of one healer run goes in `world/recordings/` with a RECORD.md entry. |
| triage-the-flaky-tests                              | Claude Code proposes causes and fixes; `approvedBy` stays a human.                                                                                                                                                                     |
| explore-with-an-agent                               | Claude Code with Playwright MCP (from `.mcp.json`) explores; findings are repro tests.                                                                                                                                                 |
| compare-mcp-and-cli, measure-the-agent-cost         | The same task run twice with `claude -p --output-format json`; tokens, turns and time come from the result's `usage`, `num_turns` and `duration_ms`. On a subscription, `total_cost_usd` is Claude Code's estimate: say so.            |
| gate-the-pull-request                               | The gate is deterministic and never calls `claude`.                                                                                                                                                                                    |

## Owed by the part sessions

- **Numbers to verify.** This session's network loaded only GitHub raw files and package registries, so no company
  number reached a learner file. Each skeleton README has a `TODO(part session)` naming the page to open: Meta ACH
  and Google mutation testing (Part 2), Slack flaky tests (Part 3), Slack agentic testing and DoorDash (Part 4),
  GitHub flaky builds (Part 5). The Uber "30-40%" figure is dropped. The Slack cost per run stays out until the
  Slack post is opened.
- **Visual baselines.** The reference suite checks layout with bounding boxes, which holds across machines.
  Screenshot tests in `check-looks-and-access` need the pinned container; the research names
  `mcr.microsoft.com/playwright:v1.65.0-noble` (confirm the tag before using it).
- **Dependencies.** Add `vitest` and `@stryker-mutator/core` plus `@stryker-mutator/vitest-runner` (Part 2) at the
  current release, pinned exactly, read from the registry on the day.
