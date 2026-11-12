# Delivery slots: test plan

**Seed:** `tests/seed.spec.ts` (fresh data, Ana signed in, an empty basket)
**Source:** `world/requirements/slots.md`

### 1. Seeing slots

#### 1.1 Shows one-hour slots from 08:00 to 20:00 for three dates
**Covers:** SLOT-1, SLOT-7
**Kind:** happy

**Steps:**
1. Open Delivery slots.

**Expected:**
- Three date groups and 36 slots.
- The first slot is Mar 11 08:00 to 09:00 and the last is Mar 13 19:00 to 20:00, in store time.

#### 1.2 Peak slots cost $4.99 and others $2.99
**Covers:** SLOT-5
**Kind:** happy

**Steps:**
1. Open Delivery slots.

**Expected:**
- Mar 12 17:00 shows $4.99.
- Mar 12 16:00 and 19:00, the slots either side of peak, show $2.99.

#### 1.3 A slot with three or fewer places shows how many are left
**Covers:** SLOT-8
**Kind:** happy

**Steps:**
1. Open Delivery slots.

**Expected:**
- Mar 11 17:00 shows "1 left" and can be chosen.
- Mar 11 10:00 shows "3 left".

### 2. Booking rules

#### 2.1 A full slot shows Full and cannot be booked
**Covers:** SLOT-2
**Kind:** happy

**Steps:**
1. Open Delivery slots.

**Expected:**
- Mar 11 18:00 (20 of 20 booked) shows "Full" and its radio button is disabled.

#### 2.2 Next-date slots close at 22:00 store time
**Covers:** SLOT-3, SLOT-7
**Kind:** happy

**Steps:**
1. Set the store clock to 21:59 the evening before and open Delivery slots.
2. Set the store clock to 22:00 and open Delivery slots again.

**Expected:**
- At 21:59, Mar 11 08:00 can be chosen.
- At 22:00, Mar 11 slots show "Closed" and are disabled. Mar 12 slots stay open.

#### 2.3 The basket shows the booked slot and its fee
**Covers:** SLOT-4
**Kind:** happy

**Steps:**
1. Choose Mar 12 09:00 and press Book slot.

**Expected:**
- The basket page lists "Thu, Mar 12, 09:00 to 10:00 ($2.99)" under Delivery.

#### 2.4 Checkout needs a booked slot
**Covers:** SLOT-6
**Kind:** happy

**Steps:**
1. Add six Ground coffee 227 g, so the basket clears the minimum.
2. Open the basket without booking a slot.

**Expected:**
- Checkout is disabled and the page says "Book a delivery slot to check out."
