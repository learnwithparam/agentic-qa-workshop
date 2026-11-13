# Pantry Run - Basket test plan

## Application Overview

Plan for requirements/basket.md (BASK-1 to BASK-9). Every scenario starts from tests/seed.spec.ts: POST /__test/reset, sign in as ana@pantryrun.test / pantry at /signin, open /basket (empty basket, getByTestId('empty-basket') visible).

Exploration notes for the generator:
- Shop page (/) lists products as role=article named by product. Each has a button 'Add'. Loose produce (price per kg) shows '$X / kg' and a combobox labelled 'Weight of <name>' with options 250 g, 500 g (default), 750 g, 1 kg, 1500 g, 2 kg: Bananas, loose $1.39/kg; Gala apples, loose $2.99/kg; Carrots, loose $0.99/kg; Vine tomatoes, loose $4.49/kg. Choose the weight BEFORE clicking Add. Adding refreshes the page; the header link 'Basket (N)' updates. Reload / between adds if the Add button is not re-clickable.
- 3 for 2 products (article shows text '3 for 2'): Natural yoghurt 500 g $1.49 and Greek yoghurt 500 g $2.29. No other product has the offer.
- Other prices: Sourdough loaf $3.25, Penne 500 g $0.95, Salted butter 250 g $2.35, Basmati rice 1 kg $2.99. Avoid items marked 'Out of stock: we will substitute unless you say no' (Whole milk 2 L, Oat granola 500 g, Smooth peanut butter 340 g, Orange juice 1 L, Free range eggs, 6).
- Basket page /basket: table rows are data-testid="basket-line"; line price getByTestId('line-total'); a '3 for 2: -$X' badge appears on offer lines; loose lines show getByTestId('line-weight') (e.g. '500 g') and have no quantity box. Per-line controls: button 'Remove one <name>' (the minus), spinbutton 'Quantity of <name>' with button 'Update <name>', button 'Remove <name>'. Voucher: getByLabel('Voucher code') and button 'Apply'. Totals: getByTestId('subtotal'), 'offers' (shown as -$1.49), 'voucher' (-$0.65), 'delivery', 'total'. Button 'Checkout' (disabled when blocked); reason in getByTestId('checkout-blocked'). Delivery section: getByTestId('held-slots').
- Slot for scenarios that need Checkout enabled: open /slots, select radio 'Thu, Mar 12 08:00 to 09:00, $2.99' and click 'Book slot' ($2.99 delivery). 'Thu, Mar 12 17:00 to 18:00, $4.99' gives $4.99.
- Blocked messages: below minimum -> 'Spend $N more to check out. The minimum order is $25.00.'; empty -> 'Add something to your basket to check out.'; at or above $25.00 with no slot -> 'Book a delivery slot to check out.'. Invalid voucher shows 'That voucher code is not valid.'.
- Verified values: Vine tomatoes 250 g $1.12 (1.1225), 500 g $2.25 (2.245 rounded once; rounding each 250 g first would give $2.24); Bananas 750 g $1.04, 1500 g $2.09; Gala apples 250 g $0.75; Carrots 250 g + 500 g = 750 g $0.74. 7 x Sourdough loaf = $22.75; plus Vine tomatoes 500 g = $25.00 exactly. 3 x Salted butter + 6 x Basmati rice = $24.99 (Add each once, then Update quantity to 3 and 6): Checkout blocked with 'Spend $0.01 more to check out. The minimum order is $25.00.' SAVE10 on Sourdough x2 + Vine tomatoes 500 g (subtotal $8.75) gives Voucher -$0.88, Total $7.87. Greek yoghurt: 2 units no offer, 3 units -$2.29, 5 units -$2.29, 6 units -$4.58.
- Observed deviations from requirements in this area: none found. Notes: setting quantity 0 with Update leaves the line unchanged (requirement is silent).

## Test Scenarios

### 1. Basket

**Seed:** `tests/seed.spec.ts`

#### 1.1 Adding the same item twice raises its quantity on one line

**Covers:** BASK-1, BASK-9
**Kind:** happy

**File:** `tests/basket.spec.ts`

**Steps:**
  1. On / click 'Add' in the 'Sourdough loaf' article twice, then open /basket.
    - expect: One basket-line 'Sourdough loaf' with quantity box value 2 and line total $6.50
    - expect: Header link reads 'Basket (1)'; Subtotal $6.50

#### 1.2 Adding the same loose produce again raises its weight

**Covers:** BASK-1, BASK-4
**Kind:** happy

**File:** `tests/basket.spec.ts`

**Steps:**
  1. On / choose '250 g' in 'Weight of Carrots, loose', click Add, then choose '500 g' and Add again.
    - expect: One Carrots, loose line with line-weight '750 g'
    - expect: Line total $0.74 (0.75 kg x 0.99 = 0.7425)

#### 1.3 Quantity box and Update set a new quantity

**Covers:** BASK-2
**Kind:** happy

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Add 'Sourdough loaf' once, open /basket, fill 'Quantity of Sourdough loaf' with 8 and click 'Update Sourdough loaf'.
    - expect: Line total $26.00, Subtotal $26.00, Total $26.00
    - expect: Header still 'Basket (1)'
  2. Fill the quantity box with 2 and click Update.
    - expect: Line total $6.50

#### 1.4 Minus button lowers a unit line by one

**Covers:** BASK-3
**Kind:** happy

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Add 'Sourdough loaf', set quantity 3 with Update ($9.75), then click 'Remove one Sourdough loaf'.
    - expect: Quantity 2, line total $6.50, Subtotal $6.50

#### 1.5 Minus on the last unit removes the line

**Covers:** BASK-3, BASK-9
**Kind:** boundary

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Add 'Penne 500 g' once; open /basket; click 'Remove one Penne 500 g'.
    - expect: The line disappears; 'Your basket is empty.' shows
    - expect: Header reads 'Basket (0)'; totals all $0.00; Checkout disabled with 'Add something to your basket to check out.'

#### 1.6 Minus on loose produce removes 250 g and removes the line at 250 g

**Covers:** BASK-3, BASK-4
**Kind:** boundary

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Add 'Vine tomatoes, loose' with the default 500 g, open /basket, click 'Remove one Vine tomatoes, loose'.
    - expect: line-weight '250 g', line total $1.12, Subtotal $1.12
  2. Click 'Remove one Vine tomatoes, loose' again.
    - expect: Line removed, 'Basket (0)', Subtotal $0.00

#### 1.7 Loose produce line total rounds once at 250 g steps

**Covers:** BASK-4
**Kind:** boundary

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Add 'Vine tomatoes, loose' with 250 g. Check line total.
    - expect: $1.12 (0.25 x 4.49 = 1.1225)
  2. Add 250 g of tomatoes again (weight becomes 500 g).
    - expect: line-weight '500 g'; line total $2.25 (2.245 rounded once), not $2.24
  3. In fresh baskets add Bananas, loose 750 g, Bananas, loose 1500 g, and Gala apples, loose 250 g.
    - expect: Bananas 750 g $1.04; Bananas 1500 g $2.09; Gala apples 250 g $0.75

#### 1.8 Total is subtotal minus offers minus voucher plus delivery fee

**Covers:** BASK-5
**Kind:** happy

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Book 'Thu, Mar 12 17:00 to 18:00, $4.99'. Add 'Natural yoghurt 500 g' with quantity 3 and 'Sourdough loaf' quantity 2 (Update in the basket). Enter SAVE10 and click 'Apply'.
    - expect: Subtotal $10.97; Offers -$1.49; Voucher -$0.65; Delivery $4.99
    - expect: Total $13.82 (10.97 - 1.49 - 0.65 + 4.99)

#### 1.9 Total with no offer, no voucher and no slot equals the subtotal

**Covers:** BASK-5
**Kind:** negative

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Add 'Sourdough loaf' twice; do not book a slot or apply a voucher.
    - expect: Subtotal $6.50, Offers $0.00, Voucher $0.00, Delivery $0.00, Total $6.50

#### 1.10 Third unit of a 3 for 2 product is free

**Covers:** BASK-6
**Kind:** boundary

**File:** `tests/basket.spec.ts`

**Steps:**
  1. On / confirm the 'Greek yoghurt 500 g' article shows '3 for 2'. Add it, open /basket and Update quantity to 2.
    - expect: Line total $4.58; Offers $0.00; no '3 for 2' badge
  2. Update quantity to 3.
    - expect: Badge '3 for 2: -$2.29'; Offers -$2.29; Total $4.58
  3. Update quantity to 5, then 6.
    - expect: 5 units: Offers -$2.29, Total $9.16
    - expect: 6 units: Offers -$4.58 (two free), Total $9.16

#### 1.11 Different 3 for 2 products do not combine into a free unit

**Covers:** BASK-6
**Kind:** negative

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Add 'Greek yoghurt 500 g' with quantity 2 and 'Natural yoghurt 500 g' with quantity 1.
    - expect: Offers $0.00; Subtotal $6.07; Total $6.07; no '3 for 2' badge on either line

#### 1.12 SAVE10 takes 10 percent off lines without an offer

**Covers:** BASK-7
**Kind:** happy

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Add 'Sourdough loaf' quantity 2 ($6.50). Enter SAVE10 in 'Voucher code' and click 'Apply'.
    - expect: Voucher -$0.65; Total $5.85
  2. In a fresh basket add Sourdough loaf x2 and 'Vine tomatoes, loose' 500 g (subtotal $8.75), apply SAVE10.
    - expect: Voucher -$0.88 (loose produce also gets the discount); Total $7.87

#### 1.13 SAVE10 never applies to a 3 for 2 line

**Covers:** BASK-7
**Kind:** negative

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Add 'Natural yoghurt 500 g' quantity 3 only. Apply SAVE10.
    - expect: Voucher $0.00; Offers -$1.49; Total $2.98
  2. Add 'Sourdough loaf' quantity 2.
    - expect: Voucher -$0.65 (sourdough only, not yoghurt); Subtotal $10.97; Total $8.83

#### 1.14 Invalid voucher code is rejected

**Covers:** BASK-7
**Kind:** negative

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Add 'Sourdough loaf' once. Enter BOGUS and click 'Apply'.
    - expect: Message 'That voucher code is not valid.'; Voucher $0.00; Total $3.25

#### 1.15 Checkout is enabled at exactly 25.00 and disabled at 24.99

**Covers:** BASK-8
**Kind:** boundary

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Book 'Thu, Mar 12 08:00 to 09:00, $2.99'. Add 'Salted butter 250 g' and Update quantity to 3; add 'Basmati rice 1 kg' and Update quantity to 6.
    - expect: Subtotal $24.99; 'Checkout' disabled; checkout-blocked reads 'Spend $0.01 more to check out. The minimum order is $25.00.' (delivery is not counted)
  2. Reset, sign in, add 'Sourdough loaf' quantity 7 plus 'Vine tomatoes, loose' 500 g, book the same slot.
    - expect: Subtotal $25.00; Delivery $2.99; Total $27.99; 'Checkout' is enabled and no 'Spend' message shows

#### 1.16 Checkout is disabled below 25.00 and shows how much more to spend

**Covers:** BASK-8
**Kind:** negative

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Book a slot. Add 'Sourdough loaf' quantity 7 ($22.75).
    - expect: Checkout disabled; text 'Spend $2.25 more to check out. The minimum order is $25.00.'
  2. Add 'Vine tomatoes, loose' (500 g).
    - expect: Checkout becomes enabled

#### 1.17 Voucher can push the basket under the 25.00 minimum

**Covers:** BASK-8, BASK-7
**Kind:** boundary

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Book a slot; build the $25.00 basket (7 Sourdough loaf + Vine tomatoes 500 g); confirm Checkout is enabled. Apply SAVE10.
    - expect: Voucher -$2.50; Total before delivery $22.50; Checkout disabled; text 'Spend $2.50 more to check out. The minimum order is $25.00.'

#### 1.18 Minimum spend is measured after offers not before

**Covers:** BASK-8, BASK-6
**Kind:** boundary

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Book a slot. Add 'Sourdough loaf' quantity 5 and 'Greek yoghurt 500 g' quantity 6.
    - expect: Subtotal $29.99; Offers -$4.58; Checkout enabled (25.41 after offers)
  2. Update Greek yoghurt quantity to 3.
    - expect: Subtotal $23.12; Offers -$2.29; amount after offers $20.83; Checkout disabled; text 'Spend $4.17 more to check out. The minimum order is $25.00.'
  3. Update Sourdough loaf to 6 with Greek yoghurt at 3.
    - expect: Subtotal $26.37 (at or above 25.00) but Offers -$2.29 leave $24.08, so Checkout is disabled with 'Spend $0.92 more to check out. The minimum order is $25.00.' (computed, not yet observed)

#### 1.19 Header shows the number of lines not units

**Covers:** BASK-9
**Kind:** happy

**File:** `tests/basket.spec.ts`

**Steps:**
  1. Check the header link on the seed basket.
    - expect: 'Basket (0)'
  2. Add 'Sourdough loaf' three times, then 'Penne 500 g', then 'Carrots, loose' 500 g.
    - expect: Header reads 'Basket (3)' (3 lines, not 5 units)
  3. Click 'Remove Penne 500 g'.
    - expect: Header reads 'Basket (2)'
