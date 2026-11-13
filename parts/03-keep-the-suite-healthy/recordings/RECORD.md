# Recordings for Part 3

Each folder here is one real Claude Code run, made with `claude -p` on a machine where Claude Code was signed in.
The sample `solution/` of each step holds the files that run wrote. Never edit a transcript by hand: make the
run again instead.

Each folder holds `transcript.jsonl` (stream-json, with model ids and paths redacted) and `meta.json` (the
prompts, the command, the Claude Code version and how the run ended).

| Recording                    | Shop it ran against       | Folder it ran in                                        | Output went to                                          |
| ---------------------------- | ------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| heal-a-renamed-button        | `RELEASE=v2 bun run shop` | a copy of the step's `problem/`, with `init-agents` run | `tests/`                                                |
| stop-the-healer-hiding-a-bug | `RELEASE=v2 bun run shop` | a copy of the step's `problem/`, with `init-agents` run | `qa/bugs/SUB-1.md`; no test changed                     |
| triage-the-flaky-tests       | `bun run shop`            | a copy of the step's `problem/`                         | `tests/`, `qa/triage.json`                              |
| check-looks-and-access       | `bun run shop`            | a copy of the step's `problem/`                         | `tests/visual.spec.ts`, `tests/a11y.spec.ts`, baselines |

## How to make one again

Start the right shop. Copy the step's `problem/` folder to `solution/` (keep `prompts.md`), go into it, and run
the command in `meta.json` with its prompt. For example, for `heal-a-renamed-button`:

```bash
bunx playwright init-agents --loop=claude
claude -p "$(jq -r .prompt ../../recordings/heal-a-renamed-button/meta.json)" --mcp-config .mcp.json --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools "mcp__playwright-test,Read,Glob,Grep,Edit(tests/**),Write(tests/**),Bash(bunx playwright test),Bash(bunx playwright test *)" --max-turns 200 > transcript.jsonl
```

Expect: the last line of `transcript.jsonl` has `"subtype":"success"`, and `bun run verify heal-a-renamed-button solution`
ends with `Done.`

Notes on what a person did between turns:

- `stop-the-healer-hiding-a-bug` and `triage-the-flaky-tests` are two prompts each, the second sent with
  `--resume`. In the triage run, the person corrected the clock time Claude Code proposed.
- Steps 1 and 2 leave out the `.claude/agents/` and `.mcp.json` that `init-agents` writes.
- In the SUB-1 report, em dashes in one quoted line became commas, to fit the course style.
- The behaviour of a healer varies run to run. One recording per step is here. The course brief asks for 3 runs
  for behaviour that varies; the supervisor should record two more of `heal-a-renamed-button` and
  `stop-the-healer-hiding-a-bug` with the same command.
