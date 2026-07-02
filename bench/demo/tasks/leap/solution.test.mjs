import { test } from "node:test";
import assert from "node:assert/strict";
import { isLeap } from "./solution.mjs";

test("year divisible by 4 is leap", () => assert.equal(isLeap(1996), true));
test("year not divisible by 4 is not leap", () => assert.equal(isLeap(1997), false));
test("year divisible by 100 is not leap", () => assert.equal(isLeap(1900), false));
test("year divisible by 400 is leap", () => assert.equal(isLeap(2000), true));
test("year divisible by 200 but not 400 is not leap", () => assert.equal(isLeap(1800), false));
test("2024 is leap", () => assert.equal(isLeap(2024), true));
test("2023 is not leap", () => assert.equal(isLeap(2023), false));
