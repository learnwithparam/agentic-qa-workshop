// plan-tests-from-requirements: test plans for slots and basket that cover every written requirement.
// It checks completeness and shape, never the wording: a plan is a judgment.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Rule } from "../scripts/verify";
import { readText, requirementIds, scenarios } from "./lib/markdown";
import { ROOT } from "../scripts/structure";

const REQ = (area: string) => requirementIds(readText(join(ROOT, "world", "requirements", `${area}.md`)));
const ALL = [...REQ("slots"), ...REQ("basket"), ...REQ("substitutions")];
const FILES = ["slots", "basket"];
const plan = (d: string, f: string) => scenarios(readText(join(d, "specs", `${f}.md`)));
const all = (d: string) => FILES.flatMap((f) => plan(d, f));
const covered = (d: string) => new Set(all(d).flatMap((s) => s.covers));

export default [
  {
    says: "specs/slots.md and specs/basket.md exist with scenarios in them",
    test: (d) => FILES.every((f) => existsSync(join(d, "specs", `${f}.md`)) && plan(d, f).length > 0),
    tryNext: "save one plan per area as specs/slots.md and specs/basket.md, each scenario under a heading like #### 1.1 <title>",
  },
  {
    says: "every scenario has a Covers line naming a real requirement ID",
    test: (d) => all(d).length > 0 && all(d).every((s) => s.covers.length > 0 && s.covers.every((id) => ALL.includes(id))),
    tryNext: "add a line like **Covers:** SLOT-2 under each scenario; IDs are in world/requirements",
  },
  {
    says: "every scenario has a Kind: happy, boundary or negative",
    test: (d) => all(d).length > 0 && all(d).every((s) => ["happy", "boundary", "negative"].includes(s.kind)),
    tryNext: "add a line like **Kind:** boundary under each scenario",
  },
  {
    says: "every scenario has numbered steps and an expected result",
    test: (d) => all(d).length > 0 && all(d).every((s) => /^\s*1\.\s+\S/m.test(s.body) && /expect/i.test(s.body)),
    tryNext: "give each scenario numbered steps (1. 2. 3.) and an Expected part that says what the shopper sees",
  },
  {
    says: "every SLOT requirement is covered at least once",
    test: (d) => REQ("slots").every((id) => covered(d).has(id)),
    tryNext: "compare the Covers lines with world/requirements/slots.md and add a scenario for each ID that is missing",
  },
  {
    says: "every BASK requirement is covered at least once",
    test: (d) => REQ("basket").every((id) => covered(d).has(id)),
    tryNext: "compare the Covers lines with world/requirements/basket.md and add a scenario for each ID that is missing",
  },
  {
    says: "each plan has at least one boundary or negative scenario",
    test: (d) => FILES.every((f) => plan(d, f).some((s) => s.kind === "boundary" || s.kind === "negative")),
    tryNext: "ask where each rule flips: the 20th order in a slot, 21:59 against 22:00, $24.99 against $25.00",
  },
] satisfies Rule[];
