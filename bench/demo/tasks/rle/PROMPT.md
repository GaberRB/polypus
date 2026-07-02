Implement run-length encoding in `solution.mjs` so that every test in `solution.test.mjs` passes.

Export two functions:
- `encode(input)` — compresses consecutive repeated characters into `<count><char>`; single characters stay as-is (no `1` prefix). Example: `"AABBBCCCC"` → `"2A3B4C"`. Input contains only letters (a-z, A-Z) and spaces.
- `decode(input)` — reverses the encoding. Example: `"2A3B4C"` → `"AABBBCCCC"`.

`decode(encode(x))` must equal `x` for any valid input.

Do NOT modify `solution.test.mjs`. Run the tests with `node --test` to verify.
