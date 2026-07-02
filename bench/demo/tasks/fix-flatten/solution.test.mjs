import { test } from "node:test";
import assert from "node:assert/strict";
import { flatten } from "./solution.mjs";

test("already flat array is unchanged", () =>
  assert.deepEqual(flatten([1, 2, 3]), [1, 2, 3]));

test("empty array", () => assert.deepEqual(flatten([]), []));

test("one level of nesting", () =>
  assert.deepEqual(flatten([1, [2, 3], 4]), [1, 2, 3, 4]));

test("deep nesting is fully flattened", () =>
  assert.deepEqual(flatten([1, [2, [3, [4, [5]]]]]), [1, 2, 3, 4, 5]));

test("nested empty arrays disappear", () =>
  assert.deepEqual(flatten([1, [], [2, []], 3]), [1, 2, 3]));

test("removes null values", () =>
  assert.deepEqual(flatten([1, null, 2, [3, null]]), [1, 2, 3]));

test("removes undefined values", () =>
  assert.deepEqual(flatten([1, undefined, [2, [undefined, 3]]]), [1, 2, 3]));

test("keeps falsy values that are not null/undefined", () =>
  assert.deepEqual(flatten([0, [false, ""], [null, 1]]), [0, false, "", 1]));
