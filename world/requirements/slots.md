# Delivery slots

Shoppers pick a one-hour slot for delivery. Times are Larkford store time (US Central).

| ID     | Requirement                                                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| SLOT-1 | The slot picker shows one-hour slots from 08:00 to 20:00 (the last slot starts 19:00) for the next three delivery dates.         |
| SLOT-2 | A slot takes at most 20 orders. A full slot shows "Full" and cannot be booked.                                                   |
| SLOT-3 | Slots on the next delivery date close at 22:00 store time the evening before. A closed slot shows "Closed" and cannot be booked. |
| SLOT-4 | After booking, the basket page shows the slot's date, time and fee under Delivery.                                               |
| SLOT-5 | Slots starting 17:00 or 18:00 cost $4.99. Every other slot costs $2.99.                                                          |
| SLOT-6 | An order cannot be placed without a booked slot. Checkout says "Book a delivery slot to check out."                              |
| SLOT-7 | Every time on the site is store time, whatever the shopper's own time zone.                                                      |
| SLOT-8 | A slot with 3 or fewer places left shows "N left".                                                                               |
