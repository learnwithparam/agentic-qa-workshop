# Orientation: meet the shop

You test Pantry Run, a grocery delivery shop in the fictional city of Larkford. Shoppers book a one-hour
delivery slot, fill a basket (loose produce is sold by weight), and say what the store may do when an item is out
of stock. The shop ships with 16 planted bugs. Each one sits behind a switch, so a script can turn it on and ask:
did your tests notice?

In this orientation you set up the repo, place one order by hand, and run the finished suite to see the goal.
It takes about 15 minutes and you write no code.

```mermaid
flowchart LR
  R[Requirements<br/>world/requirements] --> P[Plan<br/>specs/*.md]
  P --> T[Tests<br/>tests/*.spec.ts]
  T --> M{Bug-kill matrix<br/>one run per planted bug}
  M -->|caught| G[Goal board]
  M -->|missed| T
  A[An agent] -.writes.-> P
  A -.writes.-> T
  H[You] -->|review and guard| T
```

![The goal board after the finished suite ran against all 16 planted bugs](images/goal-board.png)

## What you need

- Bun 1.4 or newer, and git.
- Claude Code, signed in with your own Claude account (Pro, Max or a Console account). You use it in a
  terminal (`claude`), in your editor through the Claude Code extension, or in the Code tab of Claude Desktop.
  The course is tested on Claude Code 2.1.322 and newer.
- No API key. Claude Code uses your Claude sign-in, and the shop's one AI feature, the substitution suggester,
  answers from a stand-in model with recorded replies, so it costs nothing.

## Walkthrough

Install Claude Code by the official method. On macOS, Linux or WSL:

```bash
curl -fsSL https://claude.ai/install.sh | bash
claude --version
```

Expect: a version such as `2.1.322 (Claude Code)`. On Windows PowerShell run `irm https://claude.ai/install.ps1 | iex`
instead, and Homebrew users can run `brew install --cask claude-code`.

Sign in. Open Claude Code in this repo, accept the prompt that asks whether you trust the folder, type `/login`
and follow the browser steps with your Claude account. Then type `/exit`.

```bash
claude
```

Expect: Claude Code opens in the terminal and, after `/login`, says you are signed in.

Set up. This installs packages, finds or downloads Chromium for Playwright, and seeds the shop.

```bash
bun install
bun run setup
```

Expect: `Ready: Bun 1.4.4, Playwright 1.65.0, Chromium installed. Shop data seeded.`

Check that the course can see Claude Code. This asks the `claude` command itself, so it works however you installed it.

```bash
bun run doctor
```

Expect: `Claude Code: 2.1.322` (or newer) and `Signed in: yes. Claude Code is ready for this course.`

Meet the world: who shops here, what is out of stock, and which bugs are planted.

```bash
bun run world
bun run world bugs
```

Expect: `Products: 40, out of stock: MLK-WH2, GRN-OAT, PB-SMOOTH, JUI-ORA, EGG-6.` and then `16 bugs. BUGS=none is the fixed build. BUGS=release turns every bug on.`

Open the shop. Leave this terminal running and use a second one for the rest.

```bash
bun run shop
```

Expect: `Pantry Run ready on http://localhost:4173 (bugs: none)`

![The Pantry Run shop](images/shop.png)

Now do the step [meet-the-shop](meet-the-shop/problem/README.md): place one order by hand. Then run the finished
system. It starts the shop once on the fixed build and once per planted bug, and runs the finished suite each
time. It takes a few minutes.

```bash
bun run board
```

Expect: `Reference suite: 16 of 16 planted bugs caught, fixed build green.`

That is the goal. Now see your own board. Your tests folder is empty, so nothing is caught yet.

```bash
bun run board 00-orientation/meet-the-shop/problem/tests
```

Expect: `No .spec.ts files in 00-orientation/meet-the-shop/problem/tests. Your board: 0 of 16 planted bugs caught.`

Check the step.

```bash
bun run verify meet-the-shop
```

Expect: `Done. All 6 rules pass.` and a `Progress:` line.

## Switching bugs on

`BUGS=weighted-price bun run shop` starts the shop with one bug on. `BUGS=release bun run shop` turns all 16 on.
`bun run world reset` puts the data back to the seed. The shop's store clock is frozen at a fixed time, so slot
rules behave the same on every machine. Tests move it with `POST /__test/clock`.

## Watch Claude Code do Part 1

The finished system is Claude Code itself, with the course's `CLAUDE.md`, settings and hook, and Playwright's
planner and generator agents. It plans and writes a suite for the shop in a fresh folder, and the bug-kill matrix
scores what it wrote. With Claude Code signed in it makes a live run on your own plan; without it, it replays a
recorded real run and says so in its first line.

```bash
bun run finished
```

Expect: lines for each tool Claude Code used, then `Finished run: plans cover 17 of 17 requirements` and how
many of the 8 requirement bugs its tests caught.

When a command prints something you do not expect, look it up in [troubleshooting.md](troubleshooting.md).
