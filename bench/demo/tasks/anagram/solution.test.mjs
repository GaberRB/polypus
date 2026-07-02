import { test } from "node:test";
import assert from "node:assert/strict";
import { findAnagrams } from "./solution.mjs";

test("no matches", () =>
  assert.deepEqual(findAnagrams("diaper", ["hello", "world", "zombies", "pants"]), []));

test("detects simple anagram", () =>
  assert.deepEqual(findAnagrams("ant", ["tan", "stand", "at"]), ["tan"]));

test("detects multiple anagrams", () =>
  assert.deepEqual(findAnagrams("master", ["stream", "pigeon", "maters"]), ["stream", "maters"]));

test("does not detect a word as its own anagram", () =>
  assert.deepEqual(findAnagrams("banana", ["banana"]), []));

test("case-insensitive matching", () =>
  assert.deepEqual(findAnagrams("Orchestra", ["cashregister", "Carthorse", "radishes"]), ["Carthorse"]));

test("same word in different case is not an anagram", () =>
  assert.deepEqual(findAnagrams("go", ["go", "GO", "Go"]), []));

test("preserves candidate order and casing", () =>
  assert.deepEqual(findAnagrams("listen", ["enlists", "google", "inlets", "banana", "Silent"]), ["inlets", "Silent"]));

test("does not match different-length words", () =>
  assert.deepEqual(findAnagrams("good", ["dog", "goody"]), []));
