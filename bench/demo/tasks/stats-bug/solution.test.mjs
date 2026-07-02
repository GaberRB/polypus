import { test } from "node:test";
import assert from "node:assert/strict";
import { variance, stddev } from "./stats.mjs";

test("variance of a simple set", () => assert.equal(variance([1, 2, 3, 4, 5]), 2));
test("variance is zero for constant data", () => assert.equal(variance([2, 2, 2, 2]), 0));
test("variance of [0,0,6,6] is 9", () => assert.equal(variance([0, 0, 6, 6]), 9));
test("variance of a single element is 0", () => assert.equal(variance([10]), 0));
test("stddev is sqrt of variance (9 -> 3)", () => assert.equal(stddev([0, 0, 6, 6]), 3));
test("stddev of [1,3] is 1", () => assert.equal(stddev([1, 3]), 1));
test("stddev is zero for constant data", () => assert.equal(stddev([2, 2, 2, 2]), 0));
