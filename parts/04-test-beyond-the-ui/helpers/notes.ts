// Reads the learner's notes on the suggester and compares them with the real answers.
// The notes are read on the release candidate, BUGS=release, where the suggester has a bug.
import { join } from "node:path";
import { readText } from "../../../checks/lib/markdown";
import { once } from "../../../checks/lib/memo";
import { withShop } from "../../../checks/lib/world";

export type NoteRow = {
  sku: string;
  shopper: string;
  seed: number;
  verdict: string;
  breaks: string[];
};
type Product = {
  sku: string;
  category: string;
  priceCents: number;
  allergens: string[];
  stock: number;
};
type Answer = { allergens: string[]; suggestions: Product[] };

const RULE_ID = /SUB-[3-7]/g;
const notesPath = (folder: string) => join(folder, "qa", "ai-notes.md");

const cellsOf = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

function rowFrom(cells: string[], columns: string[]): NoteRow | null {
  const cell = (name: string) => cells[columns.indexOf(name)] ?? "";
  const seed = Number(cell("seed"));
  if (!cell("sku") || !Number.isInteger(seed)) return null;
  return {
    sku: cell("sku").replace(/`/g, ""),
    shopper: cell("shopper").toLowerCase(),
    seed,
    verdict: cell("verdict").toLowerCase(),
    breaks: cell("breaks").match(RULE_ID) ?? [],
  };
}

// The table whose header names sku, shopper, seed, verdict and breaks.
export function readNotes(folder: string): { rows: NoteRow[] } {
  const lines = readText(notesPath(folder)).split("\n");
  const rows: NoteRow[] = [];
  let columns: string[] = [];
  for (const line of lines) {
    if (!line.trim().startsWith("|")) {
      columns = [];
      continue;
    }
    const cells = cellsOf(line);
    const lowerCells = cells.map((cell) => cell.toLowerCase());
    if (["sku", "shopper", "seed", "verdict"].every((name) => lowerCells.includes(name))) {
      columns = lowerCells;
      continue;
    }
    const row = columns.length > 0 ? rowFrom(cells, columns) : null;
    if (row) rows.push(row);
  }
  return { rows };
}

// The rules from SUB-3 to SUB-6 that one suggested product breaks.
function rulesBrokenBy(product: Product, missing: Product, declared: string[]): string[] {
  const highestPrice = Math.floor(missing.priceCents * 1.15);
  const broken: string[] = [];
  if (product.category !== missing.category) broken.push("SUB-3");
  if (product.allergens.some((allergen) => declared.includes(allergen))) broken.push("SUB-4");
  if (product.priceCents > highestPrice) broken.push("SUB-5");
  if (product.stock <= 0) broken.push("SUB-6");
  return broken;
}

// The rules from SUB-3 to SUB-7 that one answer breaks.
function rulesBroken(answer: Answer, missing: Product): string[] {
  const broken = new Set<string>();
  const count = answer.suggestions.length;
  if (count < 1 || count > 3) broken.add("SUB-7");
  for (const product of answer.suggestions) {
    for (const rule of rulesBrokenBy(product, missing, answer.allergens)) broken.add(rule);
  }
  return [...broken];
}

type Truth = Map<string, string[] | null>;
const rowKey = (row: NoteRow) => `${row.sku}|${row.shopper}|${row.seed}`;

async function askEveryRow(shopUrl: string, rows: NoteRow[]): Promise<Truth> {
  const products: Product[] = await (await fetch(`${shopUrl}/api/products`)).json();
  const truth: Truth = new Map();
  for (const row of rows) {
    const address = `${shopUrl}/api/suggest?sku=${row.sku}&shopper=${row.shopper}&seed=${row.seed}`;
    const response = await fetch(address);
    const missing = products.find((product) => product.sku === row.sku);
    if (!response.ok || !missing) {
      truth.set(rowKey(row), null);
      continue;
    }
    truth.set(rowKey(row), rulesBroken(await response.json(), missing));
  }
  return truth;
}

function realAnswers(folder: string): Promise<Truth> {
  const { rows } = readNotes(folder);
  return once("suggester-notes", folder, () =>
    withShop({ bugs: "release" }, (shop) => askEveryRow(shop.url, rows)),
  );
}

function rowIsRight(row: NoteRow, broken: string[] | null | undefined): boolean {
  if (!broken) return false;
  const reallyFails = broken.length > 0;
  if (row.verdict !== (reallyFails ? "fail" : "pass")) return false;
  return broken.every((rule) => row.breaks.includes(rule));
}

export async function checkNotes(folder: string): Promise<boolean> {
  const { rows } = readNotes(folder);
  const truth = await realAnswers(folder);
  const wrongRows = rows.filter((row) => !rowIsRight(row, truth.get(rowKey(row))));
  for (const row of wrongRows.slice(0, 5)) {
    const real = truth.get(rowKey(row));
    const realText = real === null ? "no answer" : (real ?? []).join(", ") || "pass";
    console.log(
      `        Wrong row: ${row.sku} ${row.shopper} seed ${row.seed}: really ${realText}`,
    );
  }
  return rows.length > 0 && wrongRows.length === 0;
}

export async function failureKindsAreShown(markdown: string, folder: string): Promise<boolean> {
  const kindsSection = markdown.split(/^##\s+Failure kinds\s*$/im)[1]?.split(/^##\s/m)[0] ?? "";
  const namedKinds = new Set(kindsSection.match(RULE_ID) ?? []);
  const truth = await realAnswers(folder);
  const shownKinds = new Set([...truth.values()].flatMap((broken) => broken ?? []));
  const shown = [...namedKinds].filter((kind) => shownKinds.has(kind));
  return shown.length >= 2;
}
