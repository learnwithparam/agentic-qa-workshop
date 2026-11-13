# How Claude Code got here

You wrote no code. You told Claude Code what counts as weakening a test, approved the hook, asked for a
readable version, and tested the guard.

This solution is a real run: 40 turns for the guard, then 25 for the rewrite. The recording is in
`../../recordings/guard-the-assertions/`. A second recording, `../../recordings/guard-blocks-an-edit/`, shows the
hook blocking a real edit.

## The prompts

You started `claude` in this step's `problem/` folder and typed:

```text
Write qa/guard.ts, a script run with bun, that stops any agent from weakening a Playwright test.
It reads stdin in one of two forms:
1. a unified diff, like the output of git diff (try qa/examples/*.diff);
2. the JSON Claude Code sends a PreToolUse hook for an Edit or a Write. For an Edit, compare old_string with new_string. For a Write, compare the new content with the file already on disk at file_path.
Only judge test files (*.spec.ts) and playwright.config.ts. Anything else is accepted.
Reject with exit code 2 and a one-line reason on stderr when a change:
- removes an expect, or leaves fewer expects than before;
- adds test.skip or test.fixme;
- changes an expected value inside a matcher, for example toHaveText("$12.40") to toHaveText("$12.41");
- raises maxDiffPixels, maxDiffPixelRatio, threshold or retries.
Accept with exit code 0: a locator change (for example the button name "Book slot" to "Reserve"), a new expect, and a renamed test.
Then wire it in .claude/settings.json as a PreToolUse hook with matcher "Edit|Write" and the command bun "$CLAUDE_PROJECT_DIR/qa/guard.ts".
Test it with bun qa/guard.ts < qa/examples/removes-an-expect.diff (must exit 2) and qa/examples/changes-a-locator.diff (must exit 0), and with a few small diffs and hook inputs of your own. Keep the code short and readable.
```

Claude Code wrote `qa/guard.ts` and proposed this hook. It asks before it changes `.claude/settings.json`,
because a hook runs code on your machine. You read it and approved it:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "bun \"$CLAUDE_PROJECT_DIR/qa/guard.ts\"" }]
      }
    ]
  }
}
```

The first guard worked but was hard to read: names like `t`, `s` and `m`, and long one-line expressions. So you
asked for a rewrite:

```text
I created .claude/settings.json with your hook. Now make qa/guard.ts easy for a beginner to read, without changing what it accepts or rejects:
- every name is a whole word (never t, e, s, c, m, re, cur);
- one idea per line: no comma operator, no chained one-liners, no non-null assertion (!), no any;
- each function does one job in 40 lines or fewer;
- lines of 100 characters or fewer;
- a comment says why, in a plain sentence.
Then run bunx biome check qa/guard.ts and fix what it reports, and run bun test qa to prove every case still gives the same exit code. When it passes, delete qa/guard.test.ts.
```

## What Claude Code reported

```text
removes-an-expect.diff  exit 2  guard: tests/basket.spec.ts: removes an expect (2 -> 1)
changes-a-locator.diff  exit 0
9 more cases of its own, all right: a changed toHaveText value, test.skip, retries and
maxDiffPixels raised, a dropped .not; a renamed test, a new expect and a locator change pass.
```

It compares every matcher with its value, like `.toHaveText("$12.40")`, before and after. A locator sits inside
`expect(...)`, not in the matcher, so changing it is allowed.

It also named a gap. An Edit that replaces only `toHaveText("$1.04")`, without the dot in front, slips through.
Claude Code's own edits include the whole line, so the hook still catches them. Note gaps like this in your
review.

## What you checked

- Both examples give the right exit code.
- In a fresh `claude`, you asked for the banana test to expect `$1.05`. The hook blocked it with
  `changes an expected value: .toHaveText("$1.04")`, and Claude Code did not try to get around it.

## What you would reject

- A guard that only counts expects. It lets `$12.40` become `$12.41`. See `wrong/counts-expects-only/`.
- A guard that blocks every change to a test file. It also blocks the safe locator fixes in Part 3, so people
  turn it off. See `wrong/blocks-every-test-change/`.
- A hook with the wrong matcher, such as `Bash`. It never runs on Edit or Write. See `wrong/hook-not-wired/`.
