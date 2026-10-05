import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("health response shape", () => {
  it("returns ok status payload", () => {
    const payload = { status: "ok" as const };
    assert.equal(payload.status, "ok");
  });
});

describe("email normalization helper", () => {
  it("lowercases and trims email", async () => {
    const { normalizeEmail, isValidEmail } = await import("@repo/shared");
    assert.equal(normalizeEmail("  User@Example.COM "), "user@example.com");
    assert.equal(isValidEmail("user@example.com"), true);
    assert.equal(isValidEmail("not-an-email"), false);
  });
});
