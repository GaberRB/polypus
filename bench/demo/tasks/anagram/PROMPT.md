Implement `findAnagrams(subject, candidates)` in `solution.mjs` so that every test in `solution.test.mjs` passes.

Given a `subject` word and an array of `candidates`, return the candidates that are anagrams of the subject.

Rules:
- Comparison is case-insensitive ("Orchestra" and "Carthorse" are anagrams).
- A word is NOT an anagram of itself: exclude any candidate equal to the subject ignoring case (e.g. subject "banana" excludes "banana", "BANANA", "Banana").
- Preserve the original casing of the candidates in the returned array, in their original order.

Do NOT modify `solution.test.mjs`. Run the tests with `node --test` to verify.
