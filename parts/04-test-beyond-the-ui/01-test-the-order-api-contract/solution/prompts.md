# How Claude Code got here

You wrote no test code. You pointed Claude Code at the contract, read its plan line by line, and proved the
tests go red on both API bugs.

## The prompts

You started `claude` in this step's `problem/` folder. Claude Code read `CLAUDE.md` first. Then you typed:

```text
Read the contract in ../../../../world/openapi.yaml. Plan one API test for every path and
every status code it lists. Then write them in tests/api/orders.spec.ts with the request
fixture. Check every order body with a strict zod schema made from the Order in the contract,
so an extra or renamed field fails. Use slot 2026-03-11T18, which is full, for the 409.
Show me the plan first: one line per path and status code.
```

## The plan Claude Code showed

```text
GET  /api/slots              200  list of Slots, 18:00 slot is full
POST /api/orders             201  six coffees into 2026-03-12T09, an Order, total 2993
POST /api/orders             400  no lines
POST /api/orders             401  no partner key
POST /api/orders             404  slot 2026-04-30T09 does not exist
POST /api/orders             409  full slot 2026-03-11T18, error slot_full
POST /api/orders             422  two penne, below the minimum
GET  /api/orders             200  Ana's orders after one is placed
GET  /api/orders             401  wrong partner key
GET  /api/orders/{orderId}   200  the order just placed
GET  /api/orders/{orderId}   401  no partner key
GET  /api/orders/{orderId}   404  PR-9999
```

## What you checked

- The plan had 12 lines, one per pair in the contract.
- Every order body goes through `Order.parse`, and `Order` is a `z.strictObject`. A renamed field fails.
- The 409 test expects `409` and `slot_full`, not whatever the shop answered.
- You proved it. With `BUGS=api-field-rename` the order tests went red. With `BUGS=api-status` the full slot test
  went red.

## What you would reject

- Tests that only check status codes. They stay green when `slotId` becomes `slot_id`. See
  `wrong/status-codes-only/`.
- Only the happy path. Half the contract is error codes. See `wrong/happy-path-only/`.
- Tests written by watching a buggy shop. They expect `500` and `slot_id`, so they fail on the fixed build. See
  `wrong/copied-the-running-shop/`.
