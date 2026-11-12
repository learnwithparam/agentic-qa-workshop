# When something goes wrong

Every message a script in this repo prints on failure is in this table.

| What you see | What it means | Fix |
|---|---|---|
| `bun: command not found` | Bun is not installed. | Install it from bun.sh, then open a new terminal. |
| `Bun 1.x is too old` | `bun run setup` needs Bun 1.4 or newer. | Run `bun upgrade`, then `bun run setup` again. |
| `No Chromium found. Run bun run setup, or set CHROMIUM_PATH in .env.` | Playwright could not download its browser (often a company proxy). | Set `CHROMIUM_PATH` in `.env` to a Chromium or Chrome you already have. |
| `Failed to download Chrome for Testing` | The same download problem, printed by Playwright itself. | As above, or run `bunx playwright install chromium` on another network. |
| `Unknown bug "..."` | `BUGS=` names a bug that does not exist. | Run `bun run world bugs` and copy an id. |
| `Unknown command "..."` | `bun run world` got a word it does not know. | Use `bun run world`, `bun run world reset` or `bun run world bugs`. |
| `error: Failed to start server. Is port 4173 in use?` | A shop is already running. | Use the one that is running, or stop it with Ctrl+C in its terminal. |
| `Error: Timed out waiting 20000ms from config.webServer` | Playwright tried to start the shop and it did not answer. | Start it yourself with `bun run shop` in another terminal, then rerun. |
| `No .spec.ts files in ...` | `bun run board <folder>` found no tests there. | Point it at the folder that holds your `*.spec.ts` files. |
| `fixed build is red, so no catch counts` | Your suite fails with every bug off, so a red run proves nothing. | Run your tests against `bun run shop` and fix them until all pass. |
| `There is no step called "..."` | The step name is misspelled. | Copy a name from the list it prints. |
| `There is no part called "..."` | The part name is misspelled. | Copy a name from the list it prints. |
| `ERROR the check for ... could not load` | The check itself is broken, not your work. | Open an issue with the full output. |
| `No recorded reply for this request` (HTTP 503 `no_recorded_reply`) | Replay mode only answers the requests the course recorded. | Use the seeds 1 to 20 and the shoppers ana, ben and chloe, or set a live provider in `.env`. |
| `LLM_PROVIDER is "..."` | The provider name is not one the course knows. | Use `replay`, `anthropic`, `openrouter`, `openai` or `ollama`. |
| `LLM_PROVIDER is anthropic but ANTHROPIC_API_KEY is not set` | A live provider needs its key. | Add the key to `.env` (copy `.env.example`). Never paste it on the command line. |
| `FAIL  fast ...` from `bun run models` | One role did not answer on the live provider. | Check the key and your account balance, or go back to `LLM_PROVIDER=replay`. |
| `Email or password is wrong.` | The shop sign-in failed. | Shoppers are `ana`, `ben` and `chloe` at `pantryrun.test`; the password is `pantry`. |
| `Spend $X more to check out.` | The basket is below the $25.00 minimum. | Add more, or raise a quantity. |
| `Book a delivery slot to check out.` | No slot is booked. | Open Delivery slots and book an open one. |
| `Your basket changed. Check it and try again.` | The checkout form was out of date. | Reload the basket and press Checkout once. |
