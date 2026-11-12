# Meet the shop

## The problem

You cannot judge tests until you know the shop they test. Pantry Run has rules that hide real bugs.
For example:

- Slots for the next day close at 22:00 store time.
- Bananas are priced by weight.
- A shopper can say "no substitutes" for one item.

Skip this, and your tests click buttons but check nothing a shopper cares about.

```mermaid
sequenceDiagram
  participant You
  participant Shop as Pantry Run
  participant Claude as Claude Code
  You->>Shop: sign in as Ana
  You->>Shop: add bananas by weight, whole milk, coffee
  You->>Shop: untick Allow substitutes on the milk
  You->>Shop: book a slot and check out
  Shop-->>You: order page, Download receipt
  You->>Claude: run the goal board, save its last line
```

## Your challenge

You shop in the browser, like a shopper. You write no code.

With `bun run shop` running, open http://localhost:4173 and place one order as Ana (`ana@pantryrun.test`,
password `pantry`):

1. Add **Bananas, loose** with a weight of 1 kg.
2. Add **Whole milk 2 L**. It is out of stock. In the basket, untick **Allow substitutes** on its line.
3. Add **Ground coffee 227 g** and set its quantity to 5. Now the basket is over the $25.00 minimum.
4. Book any open delivery slot, then check out.
5. On the order page, click **Download receipt**. Save the file in this folder as `receipt.json`.

Look at the order page. The milk says "Not available": the store respected your choice. That one line is
requirement SUB-2, and one of the 16 planted bugs breaks it.

![The order page after checkout](../images/expected.png)

Now give Claude Code its first job. Start it in this folder:

```bash
claude
```

Expect: Claude Code opens and asks if you trust this folder. Say yes.

Type this prompt:

```text
Run bun run board from the repo root (two folders up). When it ends, put its last line
under the heading in goal.md. Change nothing else.
```

Claude Code asks before it runs a command or edits `goal.md`. Read each request, then say yes.

## Done when

- Bun is 1.4 or newer and Playwright can find a Chromium.
- `receipt.json` is in this folder, as the shop signed it.
- The order has a delivery slot and loose produce sold by weight.
- The whole milk line had substitutes switched off and says Not available.
- `goal.md` has the last line of the goal board.

```bash
bun run verify meet-the-shop
```

Expect: `Done. All 6 rules pass.` and a `Progress:` line.

## If you get stuck

| What you see | Fix |
|---|---|
| `FAIL receipt.json is in this folder and the shop signed it` | Save the downloaded file here, unchanged. A changed receipt fails on purpose. |
| `FAIL a chilled out-of-stock item had substitutes switched off` | Untick the box, then place a new order. |
| Checkout is grey | The page says why: spend more, or book a slot first. |
| The basket sends you to Sign in | Sign in as `ana@pantryrun.test` with password `pantry`. |

## Words you will use

- **Planted bug**: a known fault the course can switch on, to see if your tests catch it.
- **Fixed build**: the shop with every bug off (`BUGS=none`). A good suite is green here.
- **Bug-kill matrix**: your suite, run once per planted bug. Each red run is a bug caught.
- **Goal board**: the summary `bun run board` prints from the matrix.
- **Substitution**: a store picker puts a similar item in place of one that is out of stock.
