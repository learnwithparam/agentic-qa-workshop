// The substitution suggester answers differently per seed, so it is judged by properties
// over 20 seeds. Allergens are a hard fail: one is too many. The other properties need
// a 95% pass rate.
import { type APIRequestContext, expect, test } from "@playwright/test";

const OUT_OF_STOCK = ["MLK-WH2", "GRN-OAT", "PB-SMOOTH", "JUI-ORA", "EGG-6"];
const SHOPPERS = ["ana", "ben", "chloe"];
const SEEDS = 20;

type Product = {
  sku: string;
  category: string;
  priceCents: number;
  allergens: string[];
  stock: number;
};

// One answer from /api/suggest: the suggested products and the shopper's declared allergens.
type Suggestion = { suggestions: Product[]; allergens: string[] };

function findProduct(products: Product[], sku: string) {
  const product = products.find((candidate) => candidate.sku === sku);
  if (!product) throw new Error(`the shop has no product ${sku}`);
  return product;
}

async function askForSuggestions(
  request: APIRequestContext,
  { sku, shopper, seed }: Question,
): Promise<Suggestion> {
  const response = await request.get(`/api/suggest?sku=${sku}&shopper=${shopper}&seed=${seed}`);
  expect(response.status()).toBe(200);
  return response.json();
}

// The suggested products that contain an allergen the shopper declared.
function productsWithAllergens(answer: Suggestion) {
  return answer.suggestions.filter((product) =>
    product.allergens.some((allergen) => answer.allergens.includes(allergen)),
  );
}

// SUB-3 to SUB-7: one to three suggestions, each in the same category,
// in stock, and at most 15% dearer than the missing product.
function followsTheRules(suggestions: Product[], missing: Product) {
  const highestPrice = Math.floor(missing.priceCents * 1.15);
  const goodSubstitute = (product: Product) =>
    product.category === missing.category &&
    product.stock > 0 &&
    product.priceCents <= highestPrice;
  return suggestions.length >= 1 && suggestions.length <= 3 && suggestions.every(goodSubstitute);
}

// One question to the suggester: this missing product, for this shopper, with this seed.
type Question = { sku: string; shopper: string; seed: number };

function everyQuestion() {
  const questions: Question[] = [];
  for (const sku of OUT_OF_STOCK) {
    for (const shopper of SHOPPERS) {
      for (let seed = 1; seed <= SEEDS; seed++) questions.push({ sku, shopper, seed });
    }
  }
  return questions;
}

test("suggestions follow SUB-3 to SUB-7 over 20 seeds", async ({ request }) => {
  const products: Product[] = await (await request.get("/api/products")).json();
  const questions = everyQuestion();
  let cleanRuns = 0;
  const allergenHits: string[] = [];
  for (const { sku, shopper, seed } of questions) {
    const missing = findProduct(products, sku);
    const answer = await askForSuggestions(request, { sku, shopper, seed });
    for (const product of productsWithAllergens(answer)) {
      allergenHits.push(`${shopper} ${sku} seed ${seed}: ${product.sku}`);
    }
    if (followsTheRules(answer.suggestions, missing)) cleanRuns++;
  }
  expect(allergenHits, "a suggestion contains a declared allergen").toEqual([]);
  expect(cleanRuns / questions.length).toBeGreaterThanOrEqual(0.95);
});
