# Book a delivery slot: test plan

**Seed:** `tests/seed.spec.ts` (fresh data, Ana signed in, an empty basket)
**Source:** `world/requirements/slots.md`

### 1. Booking a slot

#### 1.1 A full slot shows Full and cannot be booked

**Covers:** SLOT-2
**Kind:** boundary

**Steps:**

1. Open Delivery slots.

**Expected:**

- The Mar 11 18:00 slot shows "Full" and is disabled.
- The Mar 12 08:00 slot can be chosen.

#### 1.2 The basket shows the booked slot and its fee

**Covers:** SLOT-4, SLOT-5
**Kind:** happy

**Steps:**

1. Open Delivery slots.
2. Choose Mar 12 09:00 to 10:00.
3. Select Book slot.

**Expected:**

- The basket page opens.
- Under Delivery it shows "Thu, Mar 12, 09:00 to 10:00 ($2.99)".

#### 1.3 Checkout needs a booked slot

**Covers:** SLOT-6
**Kind:** negative

**Steps:**

1. Add Ground coffee 227 g to the basket and set the quantity to 6.

**Expected:**

- Checkout is disabled.
- The page says "Book a delivery slot to check out."
