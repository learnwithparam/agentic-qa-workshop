# How Claude Code got here

You wrote no code. You asked for a seeded fuzz test, checked where its values come from, and saw it go red on the
bug.

## The prompt

You started `claude` in this step's `problem/` folder. Claude Code read `CLAUDE.md`. Then you typed:

```text
Write tests/fuzz/orders.spec.ts. Make 150 orders from the OrderIn schema in
../../../../world/openapi.yaml with a seeded random generator, seed 1 by default. Draw slot
ids and skus from GET /api/slots and GET /api/products, and mix in odd values: unknown
slots and skus, quantities out of range, no lines, no partner key. Expect every answer to be
a status the contract lists for POST /api/orders. On a failure, print the seed and the body.
Show me the plan first.
```

## The plan Claude Code showed

```text
1. Reset the shop. Read slot ids and skus from the API.
2. A mulberry32 generator from FUZZ_SEED, default 1.
3. 150 orders: shopper from ana, ben, chloe or "nobody"; a real slot, 2026-04-30T09 or
   "not-a-slot"; 0 to 3 lines with a real sku or NO-SUCH-SKU, qty -1 to 22, grams 0 to
   6000; a voucher now and then; no partner key one time in ten.
4. Keep every answer not in 201, 400, 401, 404, 409, 422, with the seed and body.
5. Expect that list to be empty.
```

## What you checked

- Values come from the shop's real data, so some orders reach the full 18:00 slot.
- The seed is printed with each failure. `FUZZ_SEED=1` replays it.
- With `BUGS=api-status`, it printed a `500` for an order to `2026-03-11T18`, the full slot.

## What you would reject

- `Math.random`: a failure you cannot replay. See `wrong/math-random/`.
- Random text for every slot id: it never finds a full slot, so it misses `api-status`. See
  `wrong/random-text-only/`.
- One order written by hand. That is a Part 4 test, not fuzzing. See `wrong/one-hand-written-order/`.
