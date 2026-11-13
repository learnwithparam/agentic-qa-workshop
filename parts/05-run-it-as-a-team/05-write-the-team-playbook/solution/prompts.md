# How Claude Code got here

You wrote the rules. Claude Code drafted them and matched the numbers to what the gate computes.

## The prompt

You started `claude` in this step's `problem/` folder and typed:

```text
Draft qa/playbook.md with four sections: Agents may, Agents may not, Human gates and
Numbers we report. Agents may not must forbid removing or changing an expect, and adding
skip, fixme or retries. Each human gate names who approves. Numbers we report uses only
the numbers in qa/scorecard.json, word for word, plus cost per kept test from qa/cost.md.
Do not report tests written. Show me the draft.
```

## What you changed in the draft

- Claude Code's draft let agents heal "any failing test". You narrowed it to locators only, as in Part 3.
- You added "Merge their own pull request" under Agents may not.
- You named the QA lead on the plan and bug report gates, and a reviewer on the keep, fix or drop gate.

## What you checked

- Each number is a key in `qa/scorecard.json`: assertions removed, mutation score, flaky failures, new tests
  that catch a planted bug. The fifth, cost per kept test, comes from `qa/cost.md`.
- Each rule under Agents may not is one the gate or a person can enforce.

## What you would reject

- "Tests written by AI" as a number. See `wrong/vanity-numbers/`.
- Human gates with no person named. Nobody owns them. See `wrong/no-human-gates/`.
- An Agents may not section that lets the healer change expected values. See `wrong/agents-may-weaken/`.
