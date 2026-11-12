# Substitutions

Stock is checked when the order is packed. A store picker replaces an out-of-stock item unless the shopper said no.
The order page shows each line as Packed, Substituted with <item>, or Not available.

| ID | Requirement |
|---|---|
| SUB-1 | Every new basket line starts with "Allow substitutes" switched on. |
| SUB-2 | If the shopper switches "Allow substitutes" off, the line is never substituted, chilled items included. It shows "Not available". |
| SUB-3 | A substitute is from the same category as the item it replaces. |
| SUB-4 | A substitute never contains an allergen the shopper declared. |
| SUB-5 | A substitute costs at most 15% more than the item it replaces. |
| SUB-6 | A substitute is in stock. |
| SUB-7 | "Suggest replacements" on an out-of-stock line shows at most 3 suggestions, and each one follows SUB-3 to SUB-6. |
