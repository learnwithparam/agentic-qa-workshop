// bun run world            show the world: shoppers, out-of-stock items, the bug switches
// bun run world reset      put the shop's data back to the seed
// bun run world bugs       list every planted bug and the requirement it breaks
// bun run shop             start the shop (BUGS=<id> bun run shop to switch a bug on)
import { BUGS, parseBugs } from "./bugs";

const cmd = process.argv[2] ?? "status";

if (cmd === "shop") {
  try { parseBugs(process.env.BUGS); } catch (e) { console.log((e as Error).message); process.exit(2); }
  await import("./server");
} else if (cmd === "reset") {
  const S = await import("./store");
  S.reset();
  console.log(`World reset: ${S.products().length} products, ${S.shoppers().length} shoppers, 0 orders.`);
  process.exit(0);
} else if (cmd === "bugs") {
  console.log("Planted bugs (switch one on with BUGS=<id> bun run shop):");
  for (const b of BUGS) console.log(`  ${b.id.padEnd(20)} ${b.breaks.padEnd(14)} ${b.what}`);
  console.log(`${BUGS.length} bugs. BUGS=none is the fixed build. BUGS=release turns every bug on.`);
  process.exit(0);
} else if (cmd === "status") {
  const S = await import("./store");
  S.ensureSeeded();
  const out = S.products().filter((p) => p.stock <= 0);
  console.log(`Pantry Run, ${S.seed.store.city}. Store clock: ${S.now().toISOString()} (${S.seed.store.timeZone}).`);
  console.log(`Shoppers: ${S.shoppers().map((s) => `${s.email} (allergens: ${s.allergens.join(", ") || "none"})`).join("; ")}. Password: pantry.`);
  console.log(`Products: ${S.products().length}, out of stock: ${out.map((p) => p.sku).join(", ")}.`);
  console.log(`Orders: ${S.orders().length}. Planted bugs: ${BUGS.length} (bun run world bugs).`);
  process.exit(0);
} else {
  console.log(`Unknown command "${cmd}". Use: bun run world, bun run world reset, bun run world bugs, bun run shop.`);
  process.exit(1);
}
