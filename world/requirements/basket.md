# Basket

Prices are in US dollars. Loose produce is sold by weight.

| ID | Requirement |
|---|---|
| BASK-1 | Add puts the item in the basket. Adding the same item again raises its quantity (or weight). |
| BASK-2 | The shopper changes a line's quantity with the quantity box and Update. |
| BASK-3 | The minus button lowers a line by one unit (250 g for loose produce). Removing the last unit removes the line. |
| BASK-4 | Loose produce is sold in 250 g steps. The line total is the weight in kg times the price per kg, rounded once to the cent. |
| BASK-5 | The total is the subtotal, minus offers, minus the voucher, plus the delivery fee. |
| BASK-6 | Products marked "3 for 2": every third unit of the same product is free. |
| BASK-7 | Voucher SAVE10 takes 10% off every line that has no multi-buy offer. It never applies to a "3 for 2" line. |
| BASK-8 | Checkout needs at least $25.00 after offers and voucher, before delivery. Below that, Checkout is disabled and the page says how much more to spend. |
| BASK-9 | The header shows how many lines are in the basket. |
