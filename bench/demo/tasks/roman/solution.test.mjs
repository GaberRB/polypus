import { test } from "node:test";
import assert from "node:assert/strict";
import { toRoman } from "./solution.mjs";

test("1 is I", () => assert.equal(toRoman(1), "I"));
test("3 is III", () => assert.equal(toRoman(3), "III"));
test("4 is IV (subtractive)", () => assert.equal(toRoman(4), "IV"));
test("9 is IX (subtractive)", () => assert.equal(toRoman(9), "IX"));
test("14 is XIV", () => assert.equal(toRoman(14), "XIV"));
test("40 is XL", () => assert.equal(toRoman(40), "XL"));
test("49 is XLIX", () => assert.equal(toRoman(49), "XLIX"));
test("90 is XC", () => assert.equal(toRoman(90), "XC"));
test("400 is CD", () => assert.equal(toRoman(400), "CD"));
test("900 is CM", () => assert.equal(toRoman(900), "CM"));
test("1000 is M", () => assert.equal(toRoman(1000), "M"));
test("2024 is MMXXIV", () => assert.equal(toRoman(2024), "MMXXIV"));
test("3888 is MMMDCCCLXXXVIII (longest)", () => assert.equal(toRoman(3888), "MMMDCCCLXXXVIII"));
test("3999 is MMMCMXCIX", () => assert.equal(toRoman(3999), "MMMCMXCIX"));
