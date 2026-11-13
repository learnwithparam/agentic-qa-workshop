// The substitution suggester, checked against the answers it gave on the fixed build.
// Each answer was saved once and every run must match it exactly.
import { expect, test } from "@playwright/test";
import thresholds from "../../qa/ai-thresholds.json" with { type: "json" };
import savedAnswers from "./saved-answers.json" with { type: "json" };

const OUT_OF_STOCK = ["MLK-WH2", "GRN-OAT", "PB-SMOOTH", "JUI-ORA", "EGG-6"];
const SHOPPERS = ["ana", "ben", "chloe"];

type Answer = { suggestions: { sku: string }[] };

test("suggestions match the saved answers for every seed", async ({ request }) => {
  for (const sku of OUT_OF_STOCK) {
    for (const shopper of SHOPPERS) {
      for (let seed = 1; seed <= thresholds.seeds; seed++) {
        const response = await request.get(
          `/api/suggest?sku=${sku}&shopper=${shopper}&seed=${seed}`,
        );
        const answer: Answer = await response.json();
        const skus = answer.suggestions.map((product) => product.sku);
        const key = `${sku} ${shopper} ${seed}` as keyof typeof savedAnswers;
        expect(skus).toEqual(savedAnswers[key]);
      }
    }
  }
});
