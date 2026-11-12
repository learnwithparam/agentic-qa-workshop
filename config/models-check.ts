// bun run models: one tiny call per role on the chosen provider. Prints role, provider, pass or fail and tokens.
// It never prints a key or a model name.
import { complete } from "./llm";
import { provider, type Role } from "./models";

import { PING } from "./ping";
const roles: Role[] = ["fast", "smart", "judge"];
let p: string;
try { p = provider(); } catch (e) { console.log((e as Error).message); process.exit(2); }
console.log(`Provider: ${p}`);
let failed = 0;
for (const role of roles) {
  try {
    const r = await complete(role, PING);
    const ok = /ready/i.test(r.text);
    if (!ok) failed++;
    const cost = p === "replay" ? "cost: none, recorded reply" : `tokens: ${r.inputTokens} in, ${r.outputTokens} out`;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${role.padEnd(5)}  ${cost}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${role.padEnd(5)}  ${(e as Error).message}`);
  }
}
console.log(failed ? `${failed} role(s) failed. See 00-orientation/troubleshooting.md.` : "Every role answers.");
process.exit(failed ? 1 : 0);
