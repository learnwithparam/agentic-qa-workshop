# How Claude Code got here

You wrote no code. You ran one task twice with `claude -p`, let Claude Code read the numbers from the two runs,
and judged the findings yourself.

## The commands and the prompt

With `BUGS=release bun run shop` running, in this step's `problem/` folder, you ran the two `claude -p` commands
from the README. Each saved its stream-json transcript in `qa/runs/`. The two runs in `solution/qa/runs/` are
real runs of those commands, with model names and folder paths removed.

Then you opened `claude` and typed:

```text
Read the last line of qa/runs/mcp.jsonl and qa/runs/cli.jsonl. Fill the table in
qa/mcp-vs-cli.md: Tokens is input + output + cache creation + cache read tokens, Turns is
num_turns, Seconds is duration_ms / 1000 rounded, Cost is total_cost_usd, Findings is the
number of FINDING: lines. Leave Real findings and Choice to me. List each finding under
## What we saw.
```

## What Claude Code showed

```text
MCP: 572392 tokens, 24 turns, 43 seconds, cost 0.38, 3 findings
CLI: 680348 tokens, 16 turns, 77 seconds, cost 0.34, 3 findings
```

## What you checked

- Each finding, in the shop. The CLI run's third finding ("an empty basket charges for delivery") was the
  double-book bug again, so you counted 2 real findings for the CLI.
- The MCP run's third finding, the slot buttons with no name, is real. It is the planted `missing-label` bug.
- Your choice names the numbers that decided it.

## What you would reject

- Numbers from a blog post instead of your own runs. See `wrong/typed-numbers/`.
- Two runs with the same browser. See `wrong/same-tool-twice/`.
- "Both are fine." A team needs one default. See `wrong/no-choice/`.
