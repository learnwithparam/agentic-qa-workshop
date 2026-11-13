// bun run world            show the world: shoppers, out-of-stock items, the bug switches
// bun run world reset      put the shop's data back to the seed
// bun run world bugs       list every planted bug and the requirement it breaks
// bun run shop             start the shop (BUGS=<id> bun run shop to switch a bug on)
import { BUGS, parseBugs } from "./bugs";

const command = process.argv[2] ?? "status";

async function startShop() {
  // Check the switch first, so a typo gives a clear message and not a stack trace.
  try {
    parseBugs(process.env.BUGS);
  } catch (error) {
    console.log((error as Error).message);
    process.exit(2);
  }
  await import("./server");
}

async function resetWorld() {
  const store = await import("./store");
  store.reset();
  const productCount = store.products().length;
  const shopperCount = store.shoppers().length;
  console.log(`World reset: ${productCount} products, ${shopperCount} shoppers, 0 orders.`);
  process.exit(0);
}

function listBugs() {
  console.log("Planted bugs (switch one on with BUGS=<id> bun run shop):");
  for (const bug of BUGS) {
    console.log(`  ${bug.id.padEnd(20)} ${bug.breaks.padEnd(14)} ${bug.what}`);
  }
  console.log(
    `${BUGS.length} bugs. BUGS=none is the fixed build. BUGS=release turns every bug on.`,
  );
  process.exit(0);
}

async function showStatus() {
  const store = await import("./store");
  store.ensureSeeded();
  const { city, timeZone } = store.seed.store;
  const clock = store.now().toISOString();
  console.log(`Pantry Run, ${city}. Store clock: ${clock} (${timeZone}).`);
  const shopperTexts = store.shoppers().map((shopper) => {
    const allergens = shopper.allergens.join(", ") || "none";
    return `${shopper.email} (allergens: ${allergens})`;
  });
  console.log(`Shoppers: ${shopperTexts.join("; ")}. Password: pantry.`);
  const products = store.products();
  const outOfStock = products.filter((product) => product.stock <= 0);
  const outOfStockSkus = outOfStock.map((product) => product.sku).join(", ");
  console.log(`Products: ${products.length}, out of stock: ${outOfStockSkus}.`);
  console.log(
    `Orders: ${store.orders().length}. Planted bugs: ${BUGS.length} (bun run world bugs).`,
  );
  process.exit(0);
}

if (command === "shop") {
  await startShop();
} else if (command === "reset") {
  await resetWorld();
} else if (command === "bugs") {
  listBugs();
} else if (command === "status") {
  await showStatus();
} else {
  const usage = "bun run world, bun run world reset, bun run world bugs, bun run shop";
  console.log(`Unknown command "${command}". Use: ${usage}.`);
  process.exit(1);
}
