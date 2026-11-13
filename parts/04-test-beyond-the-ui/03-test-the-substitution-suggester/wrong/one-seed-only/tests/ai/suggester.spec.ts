// The substitution suggester answers differently per seed, so it is judged by rules over many
// seeds. This version asks only seed 1. Allergens are a hard fail: one is too many.
// The other rules need the pass rate in qa/ai-thresholds.json.
import { type APIRequestContext, expect, test } from "@playwright/test";
import thresholds from "../../qa/ai-thresholds.json" with { type: "json" };

const OUT_OF_STOCK = ["MLK-WH2", "GRN-OAT", "PB-SMOOTH", "JUI-ORA", "EGG-6"];
const SHOPPERS = ["ana", "ben", "chloe"];

type Product = {
  sku: string;
  category: string;
  priceCents: number;
  allergens: string[];
  stock: number;
};

// One answer from /api/suggest: the suggested products and the shopper's declared allergens.
type Answer = { suggestions: Product[]; allergens: string[] };

// One question to the suggester: this missing product, for this shopper, with this seed.
type Question = { sku: string; shopper: string; seed: number };

function everyQuestion(): Question[] {
  const questions: Question[] = [];
  for (const sku of OUT_OF_STOCK) {
    for (const shopper of SHOPPERS) {
      questions.push({ sku, shopper, seed: 1 });
    }
  }
  return questions;
}

async function ask(request: APIRequestContext, question: Question): Promise<Answer> {
  const { sku, shopper, seed } = question;
  const response = await request.get(`/api/suggest?sku=${sku}&shopper=${shopper}&seed=${seed}`);
  expect(response.status()).toBe(200);
  return response.json();
}

// SUB-4: the suggested products that contain an allergen the shopper declared.
function withDeclaredAllergen(answer: Answer): Product[] {
  return answer.suggestions.filter((product) =>
    product.allergens.some((allergen) => answer.allergens.includes(allergen)),
  );
}

// SUB-3, SUB-5, SUB-6 and SUB-7: one to three suggestions, each in the same category,
// in stock, and at most 15% dearer than the missing product.
function followsTheOtherRules(answer: Answer, missing: Product): boolean {
  const highestPrice = Math.floor(missing.priceCents * 1.15);
  const isGoodSubstitute = (product: Product) =>
    product.category === missing.category &&
    product.stock > 0 &&
    product.priceCents <= highestPrice;
  const count = answer.suggestions.length;
  return count >= 1 && count <= 3 && answer.suggestions.every(isGoodSubstitute);
}

test("suggestions follow SUB-3 to SUB-7 over every seed", async ({ request }) => {
  const products: Product[] = await (await request.get("/api/products")).json();
  const questions = everyQuestion();
  const allergenHits: string[] = [];
  let cleanAnswers = 0;
  for (const question of questions) {
    const missing = products.find((product) => product.sku === question.sku);
    if (!missing) throw new Error(`the shop has no product ${question.sku}`);
    const answer = await ask(request, question);
    for (const product of withDeclaredAllergen(answer)) {
      allergenHits.push(
        `${question.shopper} ${question.sku} seed ${question.seed}: ${product.sku}`,
      );
    }
    if (followsTheOtherRules(answer, missing)) cleanAnswers++;
  }
  expect(allergenHits, "hard fail: a suggestion has a declared allergen").toEqual([]);
  expect(cleanAnswers / questions.length).toBeGreaterThanOrEqual(thresholds.minPassRate);
});
