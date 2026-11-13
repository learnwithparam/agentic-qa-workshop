# How Claude Code got here

You did the shopping in the browser yourself. Claude Code did one job: it ran the goal board and saved its last
line. This page shows the prompt, the plan Claude Code showed, and what you checked.

## The prompt

You started `claude` in `00-orientation/meet-the-shop/problem/` and typed:

```text
Run bun run board from the repo root (two folders up). When it ends, put its last line
under the heading in goal.md. Change nothing else.
```

## The plan Claude Code showed

Claude Code showed a short plan like this, and asked before each step:

```text
1. Run `bun run board` in the repo root. It runs the reference suite once per planted bug.
2. Copy the last line it prints.
3. Edit goal.md: add that line under "The last line that `bun run board` printed:".
```

## What you checked

- Claude Code asked before it ran `bun run board`. You read the command, then said yes.
- The board ended with `Reference suite: 16 of 16 planted bugs caught, fixed build green.`
- The edit to `goal.md` added one line and changed nothing else.
- `receipt.json` is the file the shop gave you. Neither you nor Claude Code changed it.

## What you would reject

- Claude Code offers to write `receipt.json` for you. Say no. The check finds a typed receipt, because the shop
  signs every real one. For example, see `wrong/typed-by-hand/`.
- Claude Code types a line it did not see the board print. Say no, and ask it to run the board first.
