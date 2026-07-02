import { test } from "node:test";
import assert from "node:assert/strict";
import { encode, decode } from "./solution.mjs";

test("encode empty string", () => assert.equal(encode(""), ""));
test("encode single characters only", () => assert.equal(encode("XYZ"), "XYZ"));
test("encode string with no single characters", () => assert.equal(encode("AABBBCCCC"), "2A3B4C"));
test("encode string with single and repeated characters", () =>
  assert.equal(encode("WWWWWWWWWWWWBWWWWWWWWWWWWBBBWWWWWWWWWWWWWWWWWWWWWWWWB"), "12WB12W3B24WB"));
test("encode string with whitespace", () => assert.equal(encode("  hsqq qww  "), "2 hs2q q2w2 "));
test("encode lowercase characters", () => assert.equal(encode("aabbbcccc"), "2a3b4c"));

test("decode empty string", () => assert.equal(decode(""), ""));
test("decode single characters only", () => assert.equal(decode("XYZ"), "XYZ"));
test("decode string with no single characters", () => assert.equal(decode("2A3B4C"), "AABBBCCCC"));
test("decode string with single and repeated characters", () =>
  assert.equal(decode("12WB12W3B24WB"), "WWWWWWWWWWWWBWWWWWWWWWWWWBBBWWWWWWWWWWWWWWWWWWWWWWWWB"));
test("decode string with whitespace", () => assert.equal(decode("2 hs2q q2w2 "), "  hsqq qww  "));
test("roundtrip", () => {
  const s = "zzz ZZ  zZ";
  assert.equal(decode(encode(s)), s);
});
