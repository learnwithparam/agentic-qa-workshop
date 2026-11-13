# How Claude Code got here

You wrote no test. You gave Claude Code the job, read the two files, and proved each one goes red with its bug.

This solution is a real run: 21 turns. The recording is in `../../recordings/check-looks-and-access/`.

## The prompt

With `bun run shop` running, you started `claude` in this step's `problem/` folder and typed:

```text
Pantry Run is running on http://localhost:4173. tests/seed.spec.ts shows how to reset the data and sign in.
Write two new test files:
1. tests/visual.spec.ts: toHaveScreenshot of the "Bananas, loose" product card and of the slot picker on /slots, each at 375 px and at 1280 px wide. Reset the shop data before each test.
2. tests/a11y.spec.ts: use @axe-core/playwright with the tags wcag2a, wcag2aa, wcag21a and wcag21aa on the shop page and on the slot picker, and expect no violations. Share the AxeBuilder setup through a makeAxeBuilder fixture, as the Playwright accessibility docs show.
Do not turn any axe rule off. If you ever must, add a comment that names the ticket.
Run bunx playwright test tests/visual.spec.ts --update-snapshots to make the baselines, then run both files twice more to show they are stable.
```

## What Claude Code reported

```text
--update-snapshots: 4 passed, 4 baselines written.
Both files, run 1: 6 passed (4.5s).
Both files, run 2: 6 passed (4.3s).
No axe rules are turned off; none had to be.
```

It named two choices for you to judge. The axe scan of the slot picker covers only the form, `#slot-form`. And
the baseline names end in `-linux`, so they match only on Linux.

## What you checked

- With `BUGS=price-overlap bun run shop`, the 375 px card test failed: 1683 pixels differ, and the diff shows the
  price on the Add button. The 1280 px test stayed green, as it should.
- With `BUGS=missing-label`, the slot picker scan failed: axe found a violation.
- `disableRules` appears only in a comment that says a turned-off rule needs a ticket.

## What you would reject

- Screenshots at 1280 px only. The overlap happens only on a phone, so nothing goes red. See
  `wrong/desktop-only/`.
- `.disableRules(["label"])` to make the slot picker pass. It hides the very bug the test is for. See
  `wrong/rule-turned-off/`.
