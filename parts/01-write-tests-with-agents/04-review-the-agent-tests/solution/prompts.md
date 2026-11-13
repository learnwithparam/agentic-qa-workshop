# How Claude Code got here

You edited no file. You asked Claude Code for a review, checked every verdict, then asked for the fixes and proved
each one with its bug switched on.

## The prompts

You started `claude` in this step's `problem/` folder and asked for the review first:

```text
Read every test in tests/slots.spec.ts and tests/basket.spec.ts next to its scenario in specs/.
For each test, ask: if the rule in this title broke, would this test go red?
Write one line per test in qa/review.md in this form:
- <test title>: keep | fix | drop: <why, in a few words>
Do not change any test yet. Show me the list.
```

After you checked the list, you asked for the fixes:

```text
Fix every test marked fix in qa/review.md. Make each one check the number or line
the shopper sees. Do not change any test marked keep.
```

## The plan Claude Code showed

For the fixes, Claude Code showed a plan like this:

```text
1. "750 g of bananas at $1.39 per kg costs $1.04": open the basket, expect the weight
   "750 g" and the line total "$1.04", instead of only the "Added" message.
2. "Removing the last unit removes the line": replace toBeTruthy() with a check that no
   line is left and the header shows 0.
3. "The SAVE10 voucher skips 3 for 2 lines": expect the voucher row to be "-$0.33",
   not only visible.
4. Run the three tests on the fixed build.
```

## What you checked

- Each fix or drop in `qa/review.md` says why, in a few words.
- You agreed with every keep. For example, "Peak slots cost $4.99 and others $2.99" already checks both prices.
- You proved each fix. With `BUGS=weighted-price bun run shop`, the banana test went red. With the bug off, it
  passed.

## What you would reject

- A review that marks everything keep. Three weak tests stay weak. See `wrong/keep-everything/`.
- A review that says fix but leaves the test as it was. See `wrong/fix-without-change/`.
