# Pantry Run: Basket

Source: `requirements/basket.md` (BASK-1 to BASK-9). Seed: `tests/seed.spec.ts`. Test file: `tests/basket.spec.ts`.

## Notes for the generator

**Shop (`/`)**
- Each product is an `article` named with the product name and has an "Add" button.
- Loose produce has a combobox "Weight of <name>" with options 250 g, 500 g (default), 750 g, 1 kg, 1500 g and 2 kg.

**Basket (`/basket`), per line**
- "Remove one <name>" is the minus button.
- "Quantity of <name>" is the quantity box, with "Update <name>" beside it.
- "Remove <name>" removes the line.
- Loose produce has no quantity box.
- A 3 for 2 line shows "3 for 2: -$X".

**Voucher, totals and checkout**
- Voucher box "Voucher code" with an "Apply" button.
- Totals rows: Subtotal, Offers, Voucher, Delivery and Total.
- Button "Checkout". The header link "Basket (N)" counts lines.
- An out-of-range quantity gives "Quantity must be from 1 to 20."

**Prices**
- Loose per kg: Bananas $1.39, Vine tomatoes $4.49, Carrots $0.99.
- 3 for 2: Natural yoghurt 500 g $1.49, Greek yoghurt 500 g $2.29.
- Others:
  - Semi-skimmed milk 2 L $2.79
  - Oat drink 1 L $1.99
  - Penne 500 g $0.95
  - Basmati rice 1 kg $2.99
  - Extra mature farmhouse cheddar 400 g $4.25
  - Salted butter 250 g $2.35
  - Sourdough loaf $3.25
  - Sparkling water 6 x 500 ml $2.99
- Out of stock: Whole milk 2 L, Oat granola, Smooth peanut butter, Orange juice 1 L, Free range eggs 6.

**Slots used here:** Thu, Mar 12 16:00 to 17:00 ($2.99) and 17:00 to 18:00 ($4.99).

## Scenarios

#### 1.1 Adding the same item again raises its quantity and the header counts lines
**Covers:** BASK-1, BASK-9
**Kind:** happy

1. On `/`, click Add on "Semi-skimmed milk 2 L" twice.
2. Click Add on "Oat drink 1 L" once.
3. Open /basket.

**Expected**
- The basket has two lines: milk with quantity 2 ($5.58) and oat drink with quantity 1 ($1.99).
- Subtotal is $7.57.
- The header reads "Basket (2)", counting lines, not units.

#### 1.2 Adding loose produce again raises its weight
**Covers:** BASK-1, BASK-4
**Kind:** happy

1. On `/`, Add "Bananas, loose" at 500 g.
2. Add it again at 250 g.
3. Open /basket.

**Expected**
- There is one bananas line of 750 g.
- The line total is $1.04 (0.75 × 1.39 = 1.0425).
- The header reads "Basket (1)".

#### 1.3 Update changes a line quantity and rejects 0
**Covers:** BASK-2
**Kind:** negative

1. Add "Penne 500 g" and open /basket.
2. Set the quantity to 4 and click Update.
3. Set it to 0 and click Update.

**Expected**
- After step 2 the quantity is 4 and Subtotal is $3.80.
- After step 3 the page says "Quantity must be from 1 to 20.", and Subtotal stays $3.80.

#### 1.4 Minus lowers by one and removing the last unit removes the line
**Covers:** BASK-3, BASK-9
**Kind:** boundary

1. Add "Sparkling water 6 x 500 ml" and set the quantity to 2 ($5.98).
2. Click "Remove one Sparkling water 6 x 500 ml".
3. Click it again.

**Expected**
- After step 2 the quantity is 1, Subtotal is $2.99 and the header reads "Basket (1)".
- After step 3 the line is gone, "Your basket is empty." shows and the header reads "Basket (0)".

#### 1.5 Minus on loose produce removes 250 g and the last 250 g removes the line
**Covers:** BASK-3, BASK-4
**Kind:** boundary

1. Add "Bananas, loose" at 750 g and open /basket.
2. Click "Remove one Bananas, loose" three times.

**Expected**
- The line goes 750 g at $1.04, then 500 g at $0.70, then 250 g at $0.35.
- After the third click the basket is empty.

#### 1.6 Loose produce is priced per kg and rounded once per line
**Covers:** BASK-4, BASK-9
**Kind:** boundary

1. Add Bananas at 250 g, Vine tomatoes at 750 g and Carrots at 1500 g.
2. Open /basket.

**Expected**
- The lines are:
  - Bananas $0.35 (0.3475)
  - Tomatoes $3.37 (3.3675)
  - Carrots $1.49 (1.485)
- Subtotal and Total are $5.21, and the header reads "Basket (3)".

#### 1.7 Every third unit of a 3 for 2 product is free
**Covers:** BASK-6, BASK-5
**Kind:** boundary

1. Add "Natural yoghurt 500 g", set the quantity to 2 and read the totals.
2. Set it to 3, then 6, reading the totals each time.

**Expected**

| Quantity | Subtotal | Offers | Total | Line |
|---|---|---|---|---|
| 2 | $2.98 | $0.00 | $2.98 | no offer |
| 3 | $4.47 | -$1.49 | $2.98 | "3 for 2: -$1.49" |
| 6 | $8.94 | -$2.98 | $5.96 | |

#### 1.8 SAVE10 takes 10% off lines without a multi-buy offer
**Covers:** BASK-7, BASK-5
**Kind:** happy

1. Add "Basmati rice 1 kg" and set the quantity to 2 ($5.98).
2. Apply voucher SAVE10.

**Expected**
- Voucher is -$0.60.
- Total is $5.38.

#### 1.9 SAVE10 never applies to a 3 for 2 line
**Covers:** BASK-7, BASK-6
**Kind:** negative

1. Add "Greek yoghurt 500 g" and set the quantity to 3.
2. Apply SAVE10.
3. Add "Basmati rice 1 kg" at quantity 2.

**Expected**
- After step 2, Voucher is $0.00 and Total is $4.58.
- After step 3:
  - Subtotal $12.85
  - Offers -$2.29
  - Voucher -$0.60 (rice only)
  - Total $9.96

#### 1.10 Total is subtotal minus offers minus voucher plus delivery
**Covers:** BASK-5, BASK-6, BASK-7
**Kind:** happy

1. Add Greek yoghurt at quantity 3 and Basmati rice at quantity 2.
2. Book "Thu, Mar 12 17:00 to 18:00, $4.99".
3. Apply SAVE10.

**Expected**
- Subtotal $12.85
- Offers -$2.29
- Voucher -$0.60
- Delivery $4.99
- Total $14.95

#### 1.11 Checkout is allowed at exactly $25.00
**Covers:** BASK-8, BASK-5
**Kind:** boundary

1. Add cheddar at quantity 4 ($17.00), Penne at quantity 1 ($0.95) and Salted butter at quantity 3 ($7.05).
2. Book "Thu, Mar 12 16:00 to 17:00, $2.99".
3. Click Checkout.

**Expected**
- Subtotal is $25.00, Checkout is enabled and there is no spend-more message.
- "Order PR-1001 placed" shows with Total $27.99.

#### 1.12 Checkout is disabled one cent below $25.00 and says how much more to spend
**Covers:** BASK-8
**Kind:** boundary

1. Add cheddar at quantity 4, Sourdough loaf at quantity 2 and Carrots at 1500 g.
2. Book "Thu, Mar 12 16:00 to 17:00, $2.99".

**Expected**
- Subtotal is $24.99 and Total is $27.98. Delivery does not count toward the minimum.
- Checkout is disabled, and the page says "Spend $0.01 more to check out. The minimum order is $25.00."

#### 1.13 The minimum is checked after offers and voucher
**Covers:** BASK-8, BASK-7
**Kind:** negative

1. Add cheddar at quantity 6 ($25.50) and book Thu 16:00.
2. Check that Checkout is enabled.
3. Apply SAVE10.

**Expected**
- Voucher is -$2.55.
- Checkout is disabled.
- The page says "Spend $2.05 more to check out. The minimum order is $25.00."
