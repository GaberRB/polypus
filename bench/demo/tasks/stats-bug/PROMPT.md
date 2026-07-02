A small module is BROKEN — some tests in `solution.test.mjs` fail. Fix the code so that every test passes.

The project has two source files:
- `math.mjs` — basic helpers (`sum`, `mean`).
- `stats.mjs` — exports `variance(arr)` and `stddev(arr)`, built on the helpers.

`variance` must compute the population variance (average of squared deviations from the mean), and `stddev` must be its square root. Find where the bug actually is and fix it.

Do NOT modify `solution.test.mjs`. Run the tests with `node --test` to find the failures and verify your fix.
