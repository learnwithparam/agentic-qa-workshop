# Basket: test plan

**Seed:** `tests/seed.spec.ts` (fresh data, Ana signed in, an empty basket)
**Source:** `world/requirements/basket.md`

### 1. Lines and quantities

#### 1.1 Adding the same item twice raises its quantity

**Covers:** BASK-1, BASK-9
**Kind:** happy

**Steps:**

1. Add Penne 500 g twice.

**Expected:**

- The header shows 1 line.
- The basket shows quantity 2 and $1.90.

#### 1.2 The quantity box changes a line

**Covers:** BASK-2
**Kind:** happy

**Steps:**

1. Add Penne 500 g.
2. Type 4 in its quantity box and press Update.

**Expected:**

- The line total is $3.80.

#### 1.3 Removing the last unit removes the line

**Covers:** BASK-3, BASK-9
**Kind:** boundary

**Steps:**

1. Add Penne 500 g.
2. Press the minus button on its line.

**Expected:**

- No line is left, the basket says it is empty, and the header shows 0.

### 2. Offers, voucher and minimum

#### 2.1 The third yoghurt in a 3 for 2 is free

**Covers:** BASK-6
**Kind:** boundary

**Steps:**

1. Add Natural yoghurt 500 g and set the quantity to 3.

**Expected:**

- Subtotal $4.47 and Offers -$1.49.

#### 2.2 The SAVE10 voucher skips 3 for 2 lines

**Covers:** BASK-7
**Kind:** negative

**Steps:**

1. Add three Natural yoghurt 500 g and one Sourdough loaf.
2. Apply voucher SAVE10.

**Expected:**

- Voucher -$0.33: 10% of the sourdough only.

#### 2.3 The total adds delivery and takes off offers and voucher

**Covers:** BASK-5, BASK-7
**Kind:** happy

**Steps:**

1. Add three Greek yoghurt 500 g and five Ground coffee 227 g.
2. Book Mar 12 17:00 ($4.99) and apply save10 in lower case.

**Expected:**

- Total $29.77: 29.32 subtotal, -2.29 offer, -2.25 voucher, +4.99 delivery.

#### 2.4 Checkout closes again when the basket drops below $25.00

**Covers:** BASK-8
**Kind:** boundary

**Steps:**

1. Book a slot. Add six Ground coffee 227 g ($26.94).
2. Press the minus button once ($22.45).

**Expected:**

- Checkout is enabled at $26.94, then disabled, with "Spend $2.55 more to check out".
