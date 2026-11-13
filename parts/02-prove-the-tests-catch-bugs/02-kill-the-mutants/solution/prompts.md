# How Claude Code got here

You wrote no test. You gave Claude Code the job, read the score, and checked that it left the domain code alone.

This solution is a real run. Claude Code wrote the three test files and `stryker.config.json` in 28 turns. The
recording is in `../../recordings/kill-the-mutants/`.

## The prompt

You started `claude` in this step's `problem/` folder and typed:

```text
Write Vitest unit tests for the shop rules in domain/slots.ts, domain/basket.ts and domain/substitutions.ts. Put one test file next to each: domain/slots.test.ts, domain/basket.test.ts and domain/substitutions.test.ts.
Every expect compares an exact value, such as a price in cents or a slot status. Test the edges of each rule, for example 21:59 and 22:00 for the cutoff, and 19 and 20 orders booked in a 20-order slot.
Then write stryker.config.json: the vitest test runner, mutate only those three files, and "thresholds": { "break": 70 }.
Run bunx vitest run, then bunx stryker run. For each survived mutant, add or fix a test that goes red on that change, until the score is 70 or more.
Do not change the domain code itself, only the .test.ts files and stryker.config.json.
```

## What Claude Code reported

```text
bunx vitest run passes all 109 tests, and bunx stryker run scores 100%:
287 mutants killed, 2 timed out, 0 survived. The domain files are unchanged.

| File             | Killed | Timeout | Survived | Score |
| basket.ts        | 143    | 0       | 0        | 100%  |
| slots.ts         | 82     | 2       | 0        | 100%  |
| substitutions.ts | 62     | 0       | 0        | 100%  |
```

It also found a real bug. `withinPrice` uses `Math.floor(price * 1.15)`. For a 100 cent item, `100 * 1.15` is
`114.99999999999999` in floating point, so a 115 cent substitute is refused. That breaks SUB-5, "at most 15%
more". It was told not to change the domain code. So it wrote its edge tests with prices that come out exact (1000
and 1150), and said why in a comment. A good next step is a bug report, not a quiet fix.

## What you checked

- `git diff domain/*.ts` shows no change to the rules, only new `.test.ts` files.
- `stryker.config.json` still says `"break": 70`.
- Each test file names exact values, for example `expect(slotFee(17)).toBe(499)`.

## What you would reject

- Tests that only check a value exists, like `toBeDefined()` or `toBeGreaterThan(0)`. They run every line and
  kill few mutants: the score is 17. See `wrong/checks-it-runs/`.
- A config with `"break": 30`, so Stryker passes on a low score. See `wrong/lowered-the-bar/`.
