import { describe, expect, it } from "vitest";

// Smoke test (roadmap task 0.5): proves the Vitest setup runs end-to-end.
describe("smoke", () => {
  it("executes the test runner", () => {
    expect(1 + 1).toBe(2);
  });
});
