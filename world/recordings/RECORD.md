# Recordings

Each folder here is one real run of Claude Code, made with `claude -p` on a machine where Claude Code was signed in.
`bun run finished` replays them when there is no signed-in Claude Code, and in CI. Never write or edit a
transcript by hand: remake the recording instead.

Each recording holds:

- `transcript.jsonl`: the stream-json output of the run, line for line, with model ids, this machine's home paths
  and the run folder's path replaced by `(model)`, `<home>` and `<run>`.
- `files/`: the `specs/` and `tests/` the run wrote.
- `meta.json`: the command, the prompt, the Claude Code version and how the run ended.

## How to make one

Run from the repo root, with Claude Code installed and signed in (`bun run doctor` says `Signed in: yes`):

```bash
bun run finished --record 1
```

Expect: `Live run: Claude Code plans and writes the suite in .runs/finished/record-1 against a fresh shop.`, one line
per tool call, `Saved the recording to world/recordings/finished-1.`, then the score of what it wrote.

| Recording | Command | Folder it runs in | Output goes to |
|---|---|---|---|
| finished-1 | `bun run finished --record 1` | `.runs/finished/record-1`, a fresh copy of `world/finished/template` with `world/requirements` copied in and `bunx playwright init-agents --loop=claude` run first | `world/recordings/finished-1/` |
| finished-2 | `bun run finished --record 2` | `.runs/finished/record-2`, made the same way | `world/recordings/finished-2/` |
| finished-3 | `bun run finished --record 3` | `.runs/finished/record-3`, made the same way | `world/recordings/finished-3/` |

Inside the run folder the script starts a private shop, sets `BASE_URL` to it, and runs:

```text
claude -p "<the PROMPT in world/finished/run.ts>" --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools "mcp__playwright-test,Bash(bunx playwright test),Bash(bunx playwright test *),Write(specs/**),Edit(specs/**),Write(tests/**),Edit(tests/**)" --max-turns 200
```

Three recordings exist because a run differs from the next: `bun run finished --replay all` scores each one, and
the course judges Claude Code's work over all three, never one.

After recording, run `bun test` (it checks every recording finished and wrote its four files) and
`bun run check` (it fails on any model id that slipped past the redaction).
