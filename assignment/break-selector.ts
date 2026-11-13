// bun assignment/break-selector.ts <folder>
// Breaks one selector in <folder>/tests/book-a-slot.spec.ts, the way a renamed button would.
// The broken copy is kept in <folder>/qa/healing/broken/, so the check can prove the break.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const folder = resolve(process.argv[2] ?? ".");
const specPath = join(folder, "tests", "book-a-slot.spec.ts");
const goodName = '{ name: "Book slot" }';
const brokenName = '{ name: "Reserve slot" }';

if (!existsSync(specPath)) {
  console.log(`No tests/book-a-slot.spec.ts in ${folder}. Generate it first.`);
  process.exit(2);
}
const source = readFileSync(specPath, "utf8");
if (!source.includes(goodName)) {
  console.log(`The spec has no ${goodName} selector to break. Is it already broken?`);
  process.exit(2);
}
const broken = source.replace(goodName, brokenName);
const keepFolder = join(folder, "qa", "healing", "broken");
mkdirSync(keepFolder, { recursive: true });
writeFileSync(join(keepFolder, "book-a-slot.spec.ts"), broken);
writeFileSync(specPath, broken);
console.log(`Broke one selector: ${goodName} is now ${brokenName}. Ask the healer to fix it.`);
