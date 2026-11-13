# Recordings for Part 2

Each folder here is one real Claude Code run, made with `claude -p` on a machine where Claude Code was signed in.
The sample `solution/` of each step holds the files that run wrote. Never edit a transcript by hand: make the
run again instead.

Each folder holds:

- `transcript.jsonl`: the stream-json output, with model ids, home paths and the run folder replaced by
  `(model)`, `<home>` and `<run>`.
- `meta.json`: the prompt, the command, the Claude Code version and how the run ended.

| Recording             | Step                  | Folder it ran in                                      | Output went to                            |
| --------------------- | --------------------- | ----------------------------------------------------- | ----------------------------------------- |
| catch-the-seeded-bugs | catch-the-seeded-bugs | a copy of the step's `problem/`, saved as `solution/` | `specs/`, `tests/substitutions.spec.ts`   |
| kill-the-mutants      | kill-the-mutants      | a copy of the step's `problem/`, saved as `solution/` | `domain/*.test.ts`, `stryker.config.json` |
| guard-the-assertions  | guard-the-assertions  | a copy of the step's `problem/`, saved as `solution/` | `qa/guard.ts`                             |
| guard-blocks-an-edit  | guard-the-assertions  | the finished `solution/`, with the hook on            | nothing: the hook blocked the edit        |

## How to make one again

Start the shop with `bun run shop`. Copy the step's `problem/` folder to `solution/` (keep `prompts.md`), go into
it, and run the command in `meta.json` with the prompt in `meta.json`. For example, for `kill-the-mutants`:

```bash
claude -p "$(jq -r .prompt ../../recordings/kill-the-mutants/meta.json)" --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools "Read,Glob,Grep,Write(domain/*.test.ts),Edit(domain/*.test.ts),Write(stryker.config.json),Edit(stryker.config.json),Bash(bunx vitest *),Bash(bunx stryker *)" --max-turns 80 > transcript.jsonl
```

Expect: the last line of `transcript.jsonl` has `"subtype":"success"`, and `bun run verify kill-the-mutants solution`
ends with `Done.`

Notes on what a person did between turns:

- `catch-the-seeded-bugs` ran with `--add-dir ../../../../world`, so Claude Code could read the requirements.
- `guard-the-assertions` is two prompts in one session. In `-p` mode Claude Code may not write
  `.claude/settings.json` without a person, so its first turn ended by proposing the hook. A person created the
  file with exactly that JSON, then sent the second prompt, the readability rewrite, with `--resume`.
- Claude Code also wrote `qa/guard.test.ts` with 24 cases. It deleted the file itself at the end, as the second
  prompt asked.
