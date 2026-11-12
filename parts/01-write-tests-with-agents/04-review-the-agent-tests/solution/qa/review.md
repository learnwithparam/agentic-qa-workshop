# Review of the agent's tests

One line per test in `tests/slots.spec.ts` and `tests/basket.spec.ts`:

    - <test title>: keep | fix | drop: <why, in a few words>

- Shows one-hour slots from 08:00 to 20:00 for three dates: keep: checks the rule it names
- Peak slots cost $4.99 and others $2.99: keep: checks the rule it names
- A slot with three or fewer places shows how many are left: keep: checks the rule it names
- A full slot shows Full and cannot be booked: keep: checks the rule it names
- Next-date slots close at 22:00 store time: keep: checks the rule it names
- The basket shows the booked slot and its fee: keep: checks the rule it names
- Checkout needs a booked slot: keep: checks the rule it names
- Adding the same item twice raises its quantity: keep: checks the rule it names
- The quantity box changes a line: keep: checks the rule it names
- Removing the last unit removes the line: fix: toBeTruthy on a locator always passes; now checks no line is left and the header shows 0
- 750 g of bananas at $1.39 per kg costs $1.04: fix: only checked the toast; now checks the weight and the $1.04 line total
- The third yoghurt in a 3 for 2 is free: keep: checks the rule it names
- The SAVE10 voucher skips 3 for 2 lines: fix: only checked the voucher row is visible; now checks it is -$0.33
- The total adds delivery and takes off offers and voucher: keep: checks the rule it names
- Checkout closes again when the basket drops below $25.00: keep: checks the rule it names
