# Explore with an agent

## The problem

Planned tests only find what someone wrote down. Pantry Run's release candidate has three bugs that break no
written requirement. No plan in Part 1 has a scenario for them, so no planned test can catch them.

People find these bugs by exploring: trying what a real shopper might do by accident. For example, a shopper on
a slow phone taps "Book slot" twice. Does the shop book one slot or two? Does it charge the $2.99 fee twice?

```mermaid
flowchart LR
  CH[charter.md<br/>mission, areas, time box] --> CC[Claude Code with<br/>the Playwright MCP browser]
  CC -->|clicks, types, goes back| SH[shop on BUGS=release]
  CC --> F[findings: steps, expected, actual]
  F --> RP[one repro test per finding]
  RP --> V{red on the bug,<br/>green when fixed?}
```

## Your challenge

Write a charter with Claude Code, let it explore the release candidate through a real browser, and turn each
finding into a repro test. A **repro test** is a test that shows one bug: it fails while the bug is there and
passes once it is fixed. You type prompts and judge each finding. You write no test code.

This folder has a `.mcp.json` that gives Claude Code a browser through Playwright MCP. Start the release
candidate in one terminal:

```bash
BUGS=release bun run shop
```

Expect: `Pantry Run ready on http://localhost:4173 (bugs: 16 on)`

Start Claude Code in this folder in a second terminal. The first time, say yes to the `playwright` MCP server.

```bash
claude
```

Expect: Claude Code opens and lists the `playwright` MCP server as connected when you type `/mcp`.

Then type this prompt:

```text
Fill in qa/explore/charter.md: a Mission, the Areas to try and a Time box of 40 browser
actions. Aim at ways a shopper pays twice, pays the wrong amount or gets two orders:
double clicks, odd numbers in boxes, and the Back button. Show me the charter, then
explore the shop at http://localhost:4173 with the playwright browser. Report each finding
as steps, expected and actual. Do not write tests yet.
```

Read each finding. Ask yourself: would a shopper or the shop lose money? Then ask for the repro tests:

```text
Write one repro test per finding in qa/explore/, as CLAUDE.md says. Each test checks what
should happen, so it fails on this shop and passes once the bug is fixed.
```

Run them against the release candidate. Each should go red:

```bash
bunx playwright test
```

Expect: each repro test fails, with the bug it describes in its error.

## Done when

- `qa/explore/charter.md` has a Mission, Areas and a Time box.
- Each repro test starts with `// finding:`, passes on the fixed build and goes red with its bug on.
- The repro tests find at least 2 of the 3 unwritten bugs.

```bash
bun run verify explore-with-an-agent
```

Expect: `Done. All 5 rules pass.`

![The check passing](../images/expected.png)

## If you get stuck

| What you see                                      | Fix                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `/mcp` shows `playwright` as failed               | Run `bun run setup` at the repo root so Chromium is installed, then restart Claude. |
| `FAIL every repro test passes on the fixed build` | The test expects what the bug did. Ask Claude Code to expect what should happen.    |
| `Found 1 of 3`                                    | Explore again. Try a double click on Book slot, or Back after checkout.             |

## Words you will use

- **Exploring**: trying the product the way a curious shopper would, without a script.
- **Charter**: one short page that aims the exploration: its mission, its areas and how long it may take.
- **Finding**: something odd you saw, written as steps, expected and actual.
- **Repro test**: a test that reproduces one finding. Red with the bug, green without it.
