import { test } from "node:test";
import assert from "node:assert/strict";
import { clamp } from "./solution.mjs";

test("within range returns n", () => assert.equal(clamp(5, 0, 10), 5));
test("below range returns lo", () => assert.equal(clamp(-3, 0, 10), 0));
test("above range returns hi", () => assert.equal(clamp(42, 0, 10), 10));
test("at lower bound", () => assert.equal(clamp(0, 0, 10), 0));
test("at upper bound", () => assert.equal(clamp(10, 0, 10), 10));
