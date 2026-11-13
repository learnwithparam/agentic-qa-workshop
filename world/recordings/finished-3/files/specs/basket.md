# Basket test plan

Source: `requirements/basket.md` (BASK-1 to BASK-9). Seed: `tests/seed.spec.ts` (reset, sign in as Ana, open the
empty basket). Every scenario starts from the seed.

## Notes from exploring the shop

- Products are added from the shop page `/`: one article per product with an "Add" button. Loose produce has a
  "Weight of <name>" select (default 500 g). The shop page reloads after each Add and the select goes back to
  500 g, so pick the weight before every loose Add.
- Basket rows have test id `basket-line`, with `line-total` and, for loose produce, `line-weight`. Totals use the
  test ids `subtotal`, `offers`, `voucher`, `delivery` and `total`. `checkout-blocked` holds the checkout message.
  The header link reads "Basket (N)".
- Each line has a minus button "Remove one <name>", a "Quantity of <name>" box with "Update <name>" (discrete items
  only), and "Remove <name>".
- Prices: Bananas $1.39/kg, Gala apples $2.99/kg, Carrots $0.99/kg, Vine tomatoes $4.49/kg, Avocados pack of 2
  $3.49, Natural yoghurt 500 g $1.49 (3 for 2), Greek yoghurt 500 g $2.29 (3 for 2), Extra mature farmhouse cheddar
  400 g $4.25, Sourdough loaf $3.25, Ground coffee 227 g $4.49, Penne 500 g $0.95.
- Checkout also needs a booked slot (SLOT-6). Scenarios that expect Checkout enabled book
  "Thu, Mar 12 08:00 to 09:00, $2.99" on `/slots` first.
- An invalid voucher shows "That voucher code is not valid." Update with 0 or -1 leaves the line unchanged. The
  requirements do not cover either case.
- No discrepancy with BASK-1 to BASK-9 was seen while exploring.

## Scenarios

### 1. Basket

#### 1.1 Add puts a product in the basket

**Covers:** BASK-1
**Kind:** happy

1. Open `/` and click Add on "Sourdough loaf".
2. Open `/basket`.

**Expected**

- The header reads "Basket (1)" and the empty-basket message is gone.
- One line "Sourdough loaf" with quantity 1 and line total $3.25.
- Subtotal $3.25 and Total $3.25.

#### 1.2 Adding the same product again raises its quantity

**Covers:** BASK-1
**Kind:** happy

1. On `/`, click Add on "Avocados, pack of 2" twice.
2. Open `/basket`.

**Expected**

- There is still one line, and the header reads "Basket (1)".
- The quantity is 2, the line total is $6.98 and Total is $6.98.

#### 1.3 Adding loose produce again raises its weight

**Covers:** BASK-1, BASK-4
**Kind:** boundary

1. On `/`, select 250 g for "Bananas, loose" and click Add.
2. Select 250 g again and click Add.
3. Open `/basket`.

**Expected**

- One "Bananas, loose" line weighing 500 g.
- The line total is $0.70 (0.5 kg × $1.39 = $0.695, rounded once).

#### 1.4 Update changes a line's quantity

**Covers:** BASK-2
**Kind:** happy

1. Add "Avocados, pack of 2" once and open `/basket`.
2. Set "Quantity of Avocados, pack of 2" to 5 and click Update.
3. Set it to 2 and click Update.

**Expected**

- After step 2: quantity 5, line total $17.45, Total $17.45, header still "Basket (1)".
- After step 3: quantity 2, line total $6.98, Total $6.98.

#### 1.5 Update with zero or a negative quantity does not corrupt the basket

**Covers:** BASK-2
**Kind:** negative

1. Add "Sourdough loaf" twice and open `/basket`.
2. Set the quantity to -1 and click Update.
3. Set the quantity to 0 and click Update.

**Expected**

- No negative quantity, line total or Total is ever shown.
- As observed, the line stays at 2 with a line total of $6.50, and Total is $6.50.

#### 1.6 Minus lowers a line by one and removing the last unit removes the line

**Covers:** BASK-3, BASK-9
**Kind:** boundary

1. Add "Natural yoghurt 500 g" twice and "Sourdough loaf" once, then open `/basket`.
2. Click "Remove one Natural yoghurt 500 g".
3. Click it again.

**Expected**

- After step 2: yoghurt quantity 1, line total $1.49, header "Basket (2)".
- After step 3: the yoghurt line is gone, the header reads "Basket (1)" and Subtotal is $3.25.

#### 1.7 Minus on loose produce removes 250 g and removes the line at zero

**Covers:** BASK-3, BASK-4, BASK-9
**Kind:** boundary

1. Add "Bananas, loose" at 500 g and open `/basket`.
2. Click "Remove one Bananas, loose".
3. Click it again.

**Expected**

- At the start: 500 g, $0.70.
- After step 2: 250 g, $0.35, Total $0.35.
- After step 3: the basket is empty, the header reads "Basket (0)" and Total is $0.00.

#### 1.8 Loose line totals round to the cent once

**Covers:** BASK-4
**Kind:** boundary

1. Add "Carrots, loose" 250 g, "Gala apples, loose" 250 g and "Vine tomatoes, loose" 750 g, then open `/basket`.
2. Back on `/`, add "Carrots, loose" 250 g twice more and open `/basket`.

**Expected**

- Carrots 250 g: $0.25 (from $0.2475). Gala apples 250 g: $0.75 (from $0.7475). Vine tomatoes 750 g: $3.37 (from
  $3.3675).
- After step 1: Subtotal $4.37.
- After step 2: the carrot line weighs 750 g and costs $0.74 (0.75 × $0.99 = $0.7425, rounded once). Adding three
  rounded 250 g amounts would give $0.75.

#### 1.9 Every third unit of a 3 for 2 product is free

**Covers:** BASK-6, BASK-5
**Kind:** boundary

1. Add "Natural yoghurt 500 g" twice and open `/basket`.
2. Set the quantity to 3, then 4, then 6, clicking Update each time.

**Expected**

- Qty 2: Subtotal $2.98, Offers $0.00, Total $2.98.
- Qty 3: Subtotal $4.47, Offers -$1.49, Total $2.98.
- Qty 4: Subtotal $5.96, Offers -$1.49, Total $4.47.
- Qty 6: Subtotal $8.94, Offers -$2.98, Total $5.96.

#### 1.10 Total is subtotal minus offers minus voucher plus delivery

**Covers:** BASK-5, BASK-7
**Kind:** happy

1. Book "Thu, Mar 12 08:00 to 09:00, $2.99" on `/slots`.
2. Add "Ground coffee 227 g" ×2, "Extra mature farmhouse cheddar 400 g" ×2, "Sourdough loaf" ×2 and "Penne 500 g" ×4.
3. On `/basket`, apply voucher SAVE10.

**Expected**

- Subtotal $27.78, Offers $0.00, Voucher -$2.78, Delivery $2.99.
- Total $27.99.

#### 1.11 SAVE10 takes 10% off lines without a multi-buy offer

**Covers:** BASK-7
**Kind:** happy

1. Add "Sourdough loaf" ×2 and "Extra mature farmhouse cheddar 400 g" ×2.
2. On `/basket`, apply SAVE10.

**Expected**

- Subtotal $15.00, Voucher -$1.50, Total $13.50.

#### 1.12 SAVE10 never applies to a 3 for 2 line

**Covers:** BASK-7, BASK-6, BASK-5
**Kind:** boundary

1. Add "Extra mature farmhouse cheddar 400 g" ×4, "Sourdough loaf" ×1 and "Greek yoghurt 500 g" ×3.
2. On `/basket`, apply SAVE10.
3. Remove the cheddar and sourdough lines.

**Expected**

- After step 2: Subtotal $27.12, Offers -$2.29, Voucher -$2.03 (10% of $20.25, not of the yoghurt), Total $22.80.
- After step 3, with only the 3 for 2 line left: Voucher $0.00, Offers -$2.29, Total $4.58.

#### 1.13 An invalid voucher code is rejected

**Covers:** BASK-7
**Kind:** negative

1. Add "Sourdough loaf" ×2.
2. On `/basket`, apply the code BOGUS.

**Expected**

- The page shows "That voucher code is not valid."
- Voucher stays $0.00 and Total stays $6.50.

#### 1.14 Checkout is blocked at $24.99 and allowed at exactly $25.00

**Covers:** BASK-8, BASK-5
**Kind:** boundary

1. Book "Thu, Mar 12 08:00 to 09:00, $2.99".
2. Add "Extra mature farmhouse cheddar 400 g" ×4, "Sourdough loaf" ×2 and "Natural yoghurt 500 g" ×1, then open `/basket`.
3. Click "Remove one Natural yoghurt 500 g", add "Gala apples, loose" at 500 g ($1.50) and open `/basket`.

**Expected**

- After step 2: Subtotal $24.99 and Checkout is disabled. The page says "Spend $0.01 more to check out. The minimum
  order is $25.00.", even though Total with delivery is $27.98.
- After step 3: Subtotal $25.00, no minimum message, Checkout enabled.

#### 1.15 The minimum counts offers and the voucher but not delivery

**Covers:** BASK-8, BASK-6, BASK-7
**Kind:** boundary

1. Book "Thu, Mar 12 08:00 to 09:00, $2.99".
2. Add "Ground coffee 227 g" ×2, "Extra mature farmhouse cheddar 400 g" ×2, "Sourdough loaf" ×2 and "Penne 500 g" ×4.
3. On `/basket`, apply SAVE10.
4. Set the Penne quantity to 3 and click Update.
5. Add "Greek yoghurt 500 g" ×3.

**Expected**

- After step 3: Subtotal $27.78, Voucher -$2.78, which leaves exactly $25.00. Checkout is enabled.
- After step 4: Subtotal $26.83, Voucher -$2.68, Total $27.14. Checkout is disabled and the page says "Spend $0.85
  more to check out. The minimum order is $25.00."
- After step 5: Subtotal $33.70, Offers -$2.29, Voucher still -$2.68 (the yoghurt is not discounted). That leaves
  $28.73, so Checkout is enabled.

#### 1.16 Empty basket disables checkout

**Covers:** BASK-8, BASK-9
**Kind:** negative

1. From the seed, look at `/basket`.

**Expected**

- The header reads "Basket (0)" and the basket is empty. Total is $0.00.
- Checkout is disabled and the page says "Add something to your basket to check out."

#### 1.17 Header counts lines, not units

**Covers:** BASK-9, BASK-1
**Kind:** boundary

1. Add "Natural yoghurt 500 g" ×3, "Vine tomatoes, loose" 750 g and "Sourdough loaf" ×1.
2. On `/basket`, click "Remove Sourdough loaf".
3. Set the yoghurt quantity to 5 and click Update.

**Expected**

- After step 1: "Basket (3)", even though more units than that are held.
- After step 2: "Basket (2)".
- After step 3: still "Basket (2)".
