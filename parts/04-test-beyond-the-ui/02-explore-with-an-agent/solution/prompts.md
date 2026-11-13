# How Claude Code got here

You wrote no test code. You aimed the exploration with a charter, read every finding, and asked for one repro
test per finding.

## The prompts

With `BUGS=release bun run shop` running, you started `claude` in this step's `problem/` folder and typed:

```text
Fill in qa/explore/charter.md: a Mission, the Areas to try and a Time box of 40 browser
actions. Aim at ways a shopper pays twice, pays the wrong amount or gets two orders:
double clicks, odd numbers in boxes, and the Back button. Show me the charter, then
explore the shop at http://localhost:4173 with the playwright browser. Report each finding
as steps, expected and actual. Do not write tests yet.
```

After you read the findings, you typed:

```text
Write one repro test per finding in qa/explore/, as CLAUDE.md says. Each test checks what
should happen, so it fails on this shop and passes once the bug is fixed.
```

## The findings Claude Code reported

```text
1. Double click on Book slot. Expected: one slot held, delivery $2.99.
   Actual: two slots held, delivery $5.98.
2. Quantity of Penne set to -1, then Update. Expected: refused, subtotal $0.95.
   Actual: accepted, and the subtotal goes down.
3. Checkout, then Back, then Checkout again. Expected: one order.
   Actual: a second order, PR-1002, for the same basket.
```

## What you checked

- Each finding costs real money: a double fee, a lower total, or two vans for one order.
- Each repro test expects what should happen. For example, `double-book.spec.ts` expects one held slot and
  `$2.99`, not the two slots Claude Code saw.
- The three tests went red on `BUGS=release`, and green on `BUGS=none`.

## What you would reject

- A repro that writes down what the buggy shop did. It fails on the fixed build. See
  `wrong/repro-copies-the-bug/`.
- A repro with no real check, such as only the page address. It stays green with the bug on. See
  `wrong/repro-checks-nothing/`.
- A charter so narrow it finds one bug. See `wrong/one-finding-only/`.
