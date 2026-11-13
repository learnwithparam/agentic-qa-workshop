# How Claude Code got here

You wrote no code. You ran three agents with `claude -p`, kept every result, and had Claude Code do the sums.

## The runs

In this step's `problem/` folder you ran `bunx playwright init-agents --loop=claude`, then the three `claude -p`
commands from the README. The results in `solution/qa/runs/` are those real runs. Model names, folder paths and
timing fields Claude Code adds for itself were removed, and nothing else.

- **plan**: 35 turns. It walked the shop and wrote 21 scenarios in `specs/basket.md`.
- **generate**: 5 turns. It wrote 21 tests, and all passed on the first run.
- **heal**: 2 turns, on release v2. 6 tests failed because the slot picker moved into a dialog. It changed one
  helper, `bookSlot`, and left every expected value alone.

The kept tests in `solution/tests/basket.spec.ts` are the healed file. It was formatted with Biome after the
run, and two one-letter names were made whole words. No test changed what it checks.

## The prompt

```text
Fill in qa/cost.md from qa/runs/plan.json, generate.json and heal.json: Tokens is input +
output + cache creation + cache read tokens, Minutes is duration_ms in minutes to one
decimal, Cost is total_cost_usd. Kept tests is the tests in tests/ apart from the seed.
Cost per kept test is the three costs added up, divided by Kept tests, to the cent.
```

## What you checked

- One row against its run: `plan.json` says `total_cost_usd` 0.8069377, so the row says 0.81.
- Kept tests: 21. The seed is not counted.
- The three unrounded costs add up to $1.70, and $1.70 / 21 is $0.08.

## What you would reject

- Round numbers typed from memory. See `wrong/typed-numbers/`.
- Counting the seed as a kept test. See `wrong/counts-the-seed/`.
- Leaving out the heal run. Healing is part of what tests cost. See `wrong/missing-heal/`.
