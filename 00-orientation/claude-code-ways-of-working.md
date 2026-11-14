# Claude Code ways of working

This page lists the ways of working with Claude Code that this course teaches. Each one links to the step where
you try it. You type prompts and say yes or no. Claude Code writes the files.

For example, the first row below is the habit you use most: ask for the plan, read it, then say yes or no.

| Way of working                   | What you do                                                                                      | Where you try it                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Open Claude Code in a folder     | Type `claude` in the folder. Say yes when it asks to trust the folder.                           | [meet-the-shop](meet-the-shop/problem/README.md)                                                                      |
| Sign in and leave                | Type `/login` to sign in. Type `/exit` to leave.                                                 | [Orientation](README.md)                                                                                              |
| Read each request                | Claude Code asks before it runs a command or edits a file. Read the request, then say yes or no. | [meet-the-shop](meet-the-shop/problem/README.md)                                                                      |
| Ask for the plan first           | End your prompt with "Show me your plan first." Read the plan. Say no if it is wrong.            | [write-the-seed-test](../parts/01-write-tests-with-agents/01-write-the-seed-test/problem/README.md)                   |
| Plan first on bigger jobs        | The same habit for bugs, the API contract, fuzzing and the pull request gate.                    | [catch-the-seeded-bugs](../parts/02-prove-the-tests-catch-bugs/01-catch-the-seeded-bugs/problem/README.md)            |
| Ask for a review with no changes | Say "Do not change any test yet. Show me the list." Then choose what to fix.                     | [review-the-agent-tests](../parts/01-write-tests-with-agents/04-review-the-agent-tests/problem/README.md)             |
| Send Claude Code back            | When the result is wrong, do not edit it yourself. Send a corrected prompt.                      | [plan-tests-from-requirements](../parts/01-write-tests-with-agents/02-plan-tests-from-requirements/problem/README.md) |
| Subagents                        | Playwright adds a planner, a generator and a healer. Ask for them by name.                       | [Part 1](../parts/01-write-tests-with-agents/README.md)                                                               |
| MCP servers                      | Allow the Playwright server the first time. Type `/mcp` to see it is connected.                  | [explore-with-an-agent](../parts/04-test-beyond-the-ui/02-explore-with-an-agent/problem/README.md)                    |
| `CLAUDE.md`                      | A file of project rules that Claude Code reads. You read the one in the folder.                  | [test-the-order-api-contract](../parts/04-test-beyond-the-ui/01-test-the-order-api-contract/problem/README.md)        |
| Hooks                            | A hook runs before each tool call and can block it.                                              | [guard-the-assertions](../parts/02-prove-the-tests-catch-bugs/03-guard-the-assertions/problem/README.md)              |
| Do not work around a block       | If a hook blocks an edit, ask Claude Code why. Do not go around it.                              | [heal-a-renamed-button](../parts/03-keep-the-suite-healthy/01-heal-a-renamed-button/problem/README.md)                |
| Headless runs                    | `claude -p` runs Claude Code with no chat window.                                                | [compare-mcp-and-cli](../parts/05-run-it-as-a-team/01-compare-mcp-and-cli/problem/README.md)                          |
| Cost of a run                    | Read the tokens and cost that a saved run reports.                                               | [measure-the-agent-cost](../parts/05-run-it-as-a-team/03-measure-the-agent-cost/problem/README.md)                    |
| Judge the work, not the chat     | The checks read the files and run the tests. They never read the chat.                           | [Part 1](../parts/01-write-tests-with-agents/README.md)                                                               |
