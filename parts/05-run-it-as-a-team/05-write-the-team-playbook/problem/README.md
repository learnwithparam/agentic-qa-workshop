# Write the team playbook

## The problem

You have a gate, a cost per kept test, and habits from this course. But they live in your head, and a new teammate or agent does not know them. Unless the team agrees on numbers, leadership will pick one, usually "tests written by AI".

```mermaid
flowchart LR
  SC[qa/scorecard.json<br/>from the gate] --> N[Numbers we report]
  C[qa/cost.md] --> N
  M[Agents may] --> P[qa/playbook.md]
  MN[Agents may not] --> P
  H[Human gates] --> P
  N --> P
```

## Watch it done

That number grows when the suite gets worse. For example, the `catches-nothing` pull request adds a test, so "tests written" goes up. The gate blocks it, because "new tests that catch a planted bug" says 0 of 1.

## Your turn

Get Claude Code to draft `qa/playbook.md`, then make it yours. You decide every rule. Claude Code drafts and
checks the numbers against what the gate really computes.

Start Claude Code in this folder:

```bash
claude
```

Expect: Claude Code opens in this folder.

Then type this prompt:

```text
Draft qa/playbook.md with four sections: Agents may, Agents may not, Human gates and
Numbers we report. Agents may not must forbid removing or changing an expect, and adding
skip, fixme or retries. Each human gate names who approves. Numbers we report uses only
the numbers in qa/scorecard.json, word for word, plus cost per kept test from qa/cost.md.
Do not report tests written. Show me the draft.
```

Read every rule. Would your team follow it? Change any rule you do not agree with, in your own words or by asking
Claude Code.

## Parallel and unattended work

Add two more sections to the playbook. Under Parallel work, say each agent gets its own worktree with `claude -w <name>`, and when to use `/batch`. Under Unattended runs, say what `/loop` and `/schedule` are for.

Then write `qa/run-contract.md` for one scheduled run, with five parts: Goal, Stop condition, Tools allowed, Budget and Report to. A run with no one watching must know when to stop.

## Do it on your work

Write down one number your team reports.

## Done when

- The four sections each have at least two rules.
- Agents may not forbids weakening an expect and skipping a test.
- Every human gate names who approves.
- At least 4 numbers, each one the gate or the cost step computes, and none counts tests written.
- The playbook has Parallel work and Unattended runs, and `qa/run-contract.md` has all five parts.

Ask Claude Code:

```text
Run `bun run verify write-the-team-playbook` from the repo root and tell me what it printed. Do not change anything to make it pass.
```

Or run it yourself:

```bash
bun run verify write-the-team-playbook
```

Expect: `Done. All 8 rules pass.`

## If you get stuck

| What you see                      | Fix                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `FAIL at least 4 numbers ...`     | Use the names in `qa/scorecard.json` word for word, such as "mutation score". |
| `FAIL every human gate names who` | Each gate says who signs off: the QA lead, a reviewer, a developer.           |
| `FAIL no number counts tests ...` | Drop "tests written". Report what the tests catch instead.                    |

## Words you will use

- **Playbook**: the team's written rules for a kind of work, kept in the repo next to the tests.
- **Human gate**: a step where a named person must approve before work moves on.
- **Vanity number**: a number that looks good but does not tell you if quality went up.

## Solution

See `solution/`.
