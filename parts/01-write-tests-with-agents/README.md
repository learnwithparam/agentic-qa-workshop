# Part 1: Write tests with agents

This part moves the objective: you get Claude Code to plan and write tests, and you judge them.

## The problem

Pantry Run's regression sheet has 120 rows and nobody has time to automate it. An agent can write tests faster
than anyone on the team. But speed is not the risk. The risk is a suite that is long, green and empty: tests
that click through the shop and check nothing a shopper would notice.

## Why it matters

Playwright ships three agents for this job: a planner, a generator and a healer. Read their prompts before you
run them.

- The planner is asked for "Happy path scenarios", "Edge cases and boundary conditions" and "Error handling and
  validation"
  ([planner prompt](https://raw.githubusercontent.com/microsoft/playwright/main/packages/playwright/src/agents/playwright-test-planner.agent.md)).
  Nothing checks that it covered every written rule.
- The healer is told to work on "Fixing assertions and expected values". When it is stuck, it marks a test
  `test.fixme()`, so the test is skipped
  ([healer prompt, microsoft/playwright](https://raw.githubusercontent.com/microsoft/playwright/main/packages/playwright/src/agents/playwright-test-healer.agent.md)).

For example, a planner can write ten basket scenarios and still skip BASK-4, the price by weight. Then no test
ever checks that 750 g of bananas costs $1.04.
This part builds the habits that keep the planner and generator honest. Part 3 deals with
the healer.

```mermaid
flowchart LR
  Q[world/requirements] --> PL[planner]
  S[seed test] --> PL
  S --> GE[generator]
  PL --> SP[specs/*.md]
  SP --> GE
  GE --> T[tests/*.spec.ts]
  T --> YOU{your review<br/>keep, fix, drop}
  YOU --> OK[a suite that catches bugs]
```

In every step you type prompts and review. Claude Code makes each file below. The check reads what it made.

| Step                                                                              | Minutes | Claude Code makes                              | The check reads                                                   |
| --------------------------------------------------------------------------------- | ------- | --------------------------------------------- | ----------------------------------------------------------------- |
| [write-the-seed-test](01-write-the-seed-test/problem/README.md)                   | 10      | `tests/seed.spec.ts`                          | three runs against a private shop and its event log               |
| [plan-tests-from-requirements](02-plan-tests-from-requirements/problem/README.md) | 20      | `specs/slots.md`, `specs/basket.md`           | every SLOT and BASK ID covered, a boundary case per plan          |
| [generate-tests-from-the-plan](03-generate-tests-from-the-plan/problem/README.md) | 15      | `tests/slots.spec.ts`, `tests/basket.spec.ts` | one test per scenario, no CSS or sleeps, green on the fixed build |
| [review-the-agent-tests](04-review-the-agent-tests/problem/README.md)             | 10      | `qa/review.md` and fixed tests                | a verdict per test, and the fixed suite catching 3 planted bugs   |

Total: 55 minutes. Each step's folder is self-contained: work in its `problem/` folder.

## The agents, in Claude Code

You run Playwright's own agents inside Claude Code. In a step's `problem/` folder,
`bunx playwright init-agents --loop=claude` writes three Claude Code subagents to `.claude/agents/`
(`playwright-test-planner`, `playwright-test-generator`, `playwright-test-healer`) and a `.mcp.json` that gives
them a browser through Playwright's test MCP server. Open `claude` in that folder and ask for an agent by name. The
first time, Claude Code asks you to trust the folder and to allow the `playwright-test` MCP server: say yes to both.
The checks read the files the agents leave behind and run the tests, never the chat.

## Walkthrough

Start the shop in one terminal and leave it running.

```bash
bun run shop
```

Expect: `Pantry Run ready on http://localhost:4173 (bugs: none)`

Then, for each step, work in its `problem/` folder and check it from the repo root.

```bash
bun run verify write-the-seed-test
bun run verify plan-tests-from-requirements
bun run verify generate-tests-from-the-plan
bun run verify review-the-agent-tests
```

Expect: `Done.` on each step once its work is in place, and a `Progress:` line after each.

When all four pass, the whole part passes.

```bash
bun run verify part write-tests-with-agents
```

Expect: `Part write-tests-with-agents is done: 4/4 steps pass.`

## Recap

You can now give Claude Code a seed and a set of requirements. You can read its plan against the rules. And
you can judge its tests by one question: would this go red if the rule broke? Part 2 answers that question for the whole suite at once.
