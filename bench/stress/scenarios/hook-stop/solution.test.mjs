import { test } from "node:test";
import assert from "node:assert/strict";
import { add } from "./solution.mjs";

test("adds positives", () => assert.equal(add(2, 3), 5));
test("adds negatives", () => assert.equal(add(-2, -3), -5));
test("adds zero", () => assert.equal(add(7, 0), 7));
