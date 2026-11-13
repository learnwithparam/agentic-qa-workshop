# How Claude Code got here

You edited no test. You started the shop on release v2, gave Claude Code the healer job with clear rules, and
read every fix.

This solution is a real run: 8 turns in the main session, with the `playwright-test-healer` subagent doing the
fixes. The recording is in `../../recordings/heal-a-renamed-button/`.

## The prompt

With `RELEASE=v2 bun run shop` running, you ran `bunx playwright init-agents --loop=claude` and `claude` in this
step's `problem/` folder, and typed:

```text
Release v2 of Pantry Run is running on http://localhost:4173. Run bunx playwright test: many tests now fail.
Use the playwright-test-healer agent to fix them.
Rules for every fix:
- change only how a test finds things on the page: a locator, a renamed button, opening the dialog the slot picker now sits in;
- never change an expected value, never remove an expect, never add test.skip or test.fixme;
- if a test fails because the shop itself is wrong, leave it failing and tell me which requirement it breaks.
A guard hook checks every edit to a test. If it blocks an edit, do not work around it: tell me why it blocked.
At the end, run bunx playwright test and list which tests still fail and why.
```

## What Claude Code reported

```text
I ran the full suite after the healer's fixes: 16 pass and 7 still fail. All 7 fail
because the shop is wrong, not because a test can't find something.
- Opening the dialog: it added a click on "Choose a delivery time" after each visit to /slots.
- The renamed button: "Book slot" became "Reserve" in the same places.
No expected value changed, no expect was removed, and no skip or fixme was added.
Still failing (7, all in tests/substitutions.spec.ts): the shop breaks SUB-1.
```

It explained each red test. The first checks SUB-1 directly. Two time out, because the box they switch off is
already off. Four expect "Substituted with ..." and get "Not available", because no line allows substitutes.

## What you checked

- `diff -r ../problem/tests tests` shows only two kinds of change: a new click on "Choose a delivery time",
  and "Book slot" changed to "Reserve".
- No `expect` line changed. The guard hook never had to block anything.
- The 7 red tests all sit in `substitutions.spec.ts`, and Claude Code named the rule they break.

The `.claude/agents/` and `.mcp.json` files from `init-agents` are left out of this folder, since Playwright makes
them.

## What you would reject

- `test.fixme` on the red substitution test. See `wrong/fixme-the-red-ones/`.
- Changing `toBeChecked()` to `not.toBeChecked()` so the SUB-1 test goes green. That hides a real regression.
  See `wrong/flipped-the-default/`.
- Renaming the button but not opening the dialog. The slot tests stay red. See `wrong/renamed-only/`.
