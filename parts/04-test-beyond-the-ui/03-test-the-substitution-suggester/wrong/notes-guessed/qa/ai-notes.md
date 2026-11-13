# Suggester notes

Answers read on the release candidate, `BUGS=release`. Ana declares tree nuts.

| sku     | shopper | seed | suggestions                 | verdict | breaks |
| ------- | ------- | ---- | --------------------------- | ------- | ------ |
| MLK-WH2 | ana     | 1    | MLK-SS2, MLK-ALM1, MLK-OAT1 | pass    | -      |
| MLK-WH2 | ana     | 2    | MLK-SS2, MLK-OAT1           | pass    | -      |
| MLK-WH2 | ana     | 3    | MLK-SS2, MLK-OAT1           | pass    | -      |
| MLK-WH2 | ana     | 4    | MLK-SS2, MLK-ALM1, MLK-OAT1 | pass    | -      |
| MLK-WH2 | ana     | 5    | MLK-SS2, MLK-OAT1           | pass    | -      |
| MLK-WH2 | ana     | 6    | MLK-SS2, MLK-OAT1           | pass    | -      |
| MLK-WH2 | ana     | 7    | MLK-SS2, MLK-OAT1           | pass    | -      |
| MLK-WH2 | ana     | 8    | MLK-SS2, MLK-ALM1, MLK-OAT1 | pass    | -      |
| MLK-WH2 | ana     | 9    | MLK-SS2, MLK-ALM1, MLK-OAT1 | pass    | -      |
| MLK-WH2 | ana     | 10   | MLK-SS2, MLK-ALM1, MLK-OAT1 | pass    | -      |
| JUI-ORA | ana     | 1    | JUI-PIN, JUI-APL            | pass    | -      |
| JUI-ORA | ana     | 2    | JUI-PIN, JUI-APL            | pass    | -      |
| JUI-ORA | ana     | 3    | JUI-PIN, JUI-APL            | pass    | -      |
| JUI-ORA | ana     | 4    | JUI-PIN, JUI-APL            | pass    | -      |
| JUI-ORA | ana     | 5    | JUI-PIN, JUI-APL            | pass    | -      |
| JUI-ORA | ana     | 6    | JUI-PIN, JUI-APL            | pass    | -      |
| JUI-ORA | ana     | 7    | JUI-FRS, JUI-PIN, JUI-APL   | fail    | SUB-5  |
| JUI-ORA | ana     | 8    | JUI-PIN, JUI-APL            | pass    | -      |
| JUI-ORA | ana     | 9    | JUI-PIN, JUI-APL            | pass    | -      |
| JUI-ORA | ana     | 10   | JUI-PIN, JUI-APL            | pass    | -      |

## Failure kinds

- SUB-4, allergen: the almond drink MLK-ALM1 (tree nuts) is offered to Ana in 5 of 10 milk answers. One is too
  many, so this is a hard fail.
- SUB-5, price: seed 7 for orange juice offers fresh juice JUI-FRS, more than 15% dearer than the .25 juice.
