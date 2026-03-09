import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAllowed } from "../src/permission.js";

describe("isAllowed", () => {
  const allowList = [
    "nomachine:*",
    "firewall:*",
    "sunshine:status",
    "docs:status",
    "docs:list",
  ];

  it("allows exact match", () => {
    assert.equal(isAllowed(allowList, "sunshine", "status"), true);
    assert.equal(isAllowed(allowList, "docs", "status"), true);
    assert.equal(isAllowed(allowList, "docs", "list"), true);
  });

  it("allows wildcard match", () => {
    assert.equal(isAllowed(allowList, "nomachine", "status"), true);
    assert.equal(isAllowed(allowList, "nomachine", "restart"), true);
    assert.equal(isAllowed(allowList, "nomachine", "logs"), true);
    assert.equal(isAllowed(allowList, "firewall", "setup"), true);
    assert.equal(isAllowed(allowList, "firewall", "on"), true);
  });

  it("denies commands not in whitelist", () => {
    assert.equal(isAllowed(allowList, "sunshine", "up"), false);
    assert.equal(isAllowed(allowList, "sunshine", "down"), false);
    assert.equal(isAllowed(allowList, "docs", "start"), false);
    assert.equal(isAllowed(allowList, "docs", "stop"), false);
  });

  it("denies unknown apps", () => {
    assert.equal(isAllowed(allowList, "obsidian", "status"), false);
    assert.equal(isAllowed(allowList, "unknown", "anything"), false);
  });

  it("handles empty or null allowList", () => {
    assert.equal(isAllowed([], "nomachine", "status"), false);
    assert.equal(isAllowed(null, "nomachine", "status"), false);
    assert.equal(isAllowed(undefined, "nomachine", "status"), false);
  });

  it("handles entry without colon as app:*", () => {
    assert.equal(isAllowed(["nomachine"], "nomachine", "status"), true);
    assert.equal(isAllowed(["nomachine"], "nomachine", "restart"), true);
  });

  describe("bob permissions", () => {
    const bobList = ["docs:*", "obsidian:*"];

    it("allows docs and obsidian", () => {
      assert.equal(isAllowed(bobList, "docs", "start"), true);
      assert.equal(isAllowed(bobList, "docs", "stop"), true);
      assert.equal(isAllowed(bobList, "obsidian", "status"), true);
      assert.equal(isAllowed(bobList, "obsidian", "config"), true);
    });

    it("denies nomachine and firewall", () => {
      assert.equal(isAllowed(bobList, "nomachine", "status"), false);
      assert.equal(isAllowed(bobList, "firewall", "status"), false);
    });
  });
});
