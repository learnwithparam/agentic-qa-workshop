// Vitest runs the unit tests next to the domain code: domain/slots.test.ts and the others.
// Run them from this folder: bunx vitest run
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["domain/**/*.test.ts"],
  },
});
