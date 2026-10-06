# calc-mcp-worker

English | [简体中文](README.zh-CN.md)

[![CI](https://gh.qdp.qzz.io/Kerry1020/calc-mcp-worker/actions/workflows/ci.yml/badge.svg)](https://gh.qdp.qzz.io/Kerry1020/calc-mcp-worker/actions/workflows/ci.yml)

A math-focused [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for Cloudflare Workers.
It has **25 tools**, **zero runtime dependencies** and needs **no API keys**.

Use it for expression evaluation, calculus, equation solving, matrices, descriptive statistics, probability distributions, hypothesis tests, regression, correlation, unit conversion, number theory and plot data.

- Expressions go through a hand-written tokenizer and parser. User input never reaches `eval` or `Function`.
- Every input is validated, and every loop and allocation is bounded (see [Limits](#limits)).
- Special functions (erf, gamma, incomplete gamma/beta, t/χ²/F distributions) are accurate to about 1e-14.
- Taylor coefficients come from automatic differentiation, so they are exact to machine precision.

## Endpoint and transport

The worker speaks JSON-RPC 2.0 over HTTP `POST`. This is MCP Streamable HTTP with JSON responses only.

| Request | Response |
| --- | --- |
| `POST` (any path), JSON-RPC request or batch | `200` with JSON-RPC response(s) |
| `POST` notification / client response only | `202`, empty body |
| `POST` with invalid JSON | `400`, JSON-RPC error `-32700` |
| `POST` with an invalid JSON-RPC message | `400`, JSON-RPC error `-32600` |
| `POST` with a body over 1 MiB | `413` |
| `GET` (browser / JSON) | `200` server info `{name, version, tools, mcp}` |
| `GET` with `Accept: text/event-stream` | `405` (no SSE stream offered) |
| `OPTIONS` | `204` CORS preflight |
| other methods | `405` |

Supported protocol versions are `2025-06-18`, `2025-03-26` and `2024-11-05`. If the client asks for one of them, the server echoes it. Otherwise it answers with the latest.

Methods: `initialize`, `ping`, `tools/list`, `tools/call`. Notifications are accepted and never answered.

### Client configuration

Clients that support remote HTTP servers can connect directly:

```json
{
  "mcpServers": {
    "calc": { "url": "https://calc-mcp-worker.<your-subdomain>.workers.dev/mcp" }
  }
}
```

For stdio-only clients, use a bridge such as [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "calc": { "command": "npx", "args": ["mcp-remote", "https://calc-mcp-worker.<your-subdomain>.workers.dev/mcp"] }
  }
}
```

### Errors

- **Tool failures** come back as a normal tool result with `isError: true`. Examples are a singular matrix, an invalid argument or a non-finite result. The text content is `{"error": "..."}`, which lets the model read the message and retry.
- **Protocol errors** use JSON-RPC error codes:
  - `-32700` parse error
  - `-32600` invalid request
  - `-32601` unknown method
  - `-32602` unknown tool or malformed `tools/call` params
  - `-32603` internal error

## Expression syntax

```text
2+3*4              -> 14
5!/(3!*2!)         -> 10
sin(pi/6)          -> 0.5
ln(e)              -> 1
log(e)             -> 0.4342944819      (log is base 10)
log(8, 2)          -> 3                 (explicit base)
sqrt(2)            -> 1.414213562
abs(-5+3i)         -> 5.830951895
e^(i*pi)+1         -> 0
2pi                -> 6.283185307
2x^2  (x=3)        -> 18                (implicit multiplication binds looser than ^)
1/2pi              -> 0.1591549431      (= 1/(2*pi): binds tighter than * and /)
[[1,2],[3,4]]      -> matrix literal; [1,2;3,4] is equivalent
h                  -> 6.62607015e-34
```

- **Operators:** `+ - * / % ^` (`**` is an alias for `^`), postfix `!`, and `|x|` for absolute value.
- **Precedence:** `+ -` < `* / %` < implicit multiplication < `^` < `!`. Unary minus applies after `^`, so `-x^2 = -(x^2)`.
- **Functions:**
  - Trigonometric: `sin cos tan sec csc cot asin acos atan atan2`
  - Hyperbolic: `sinh cosh tanh asinh acosh atanh`
  - Roots, powers and logs: `sqrt cbrt exp ln log log2 log10 pow`
  - Rounding and sign: `abs ceil floor round sign`
  - Aggregates: `max min`
  - Special and integer functions: `factorial gamma erf mod gcd lcm binom rad deg`
  - Statistics: `mean median stdev variance`. These take numbers or arrays, e.g. `mean(1,2,3)` or `mean([1,2,3])`.
  - Complex: `re im conj arg csin ccos ctan csqrt cexp cln`
- **Constants:** call `calc_constants` for the full list. It covers math constants such as `pi`, `e`, `phi` and `euler_gamma`, physics constants (CODATA 2018) such as `c`, `h`, `hbar`, `k`, `G`, `Na` and `R`, astronomy constants, and unit factors. `i` is the imaginary unit.
- **Rejected input:** unknown characters, unbalanced brackets and trailing tokens are errors. They are never silently ignored.

## Tools

| # | Tool | Purpose | Example arguments | Example result |
| --- | --- | --- | --- | --- |
| 1 | `calc_batch` | Evaluate up to 100 expressions | `{"expressions": ["2+3*4", "5!/(3!*2!)", "ln(e)"]}` | `14`, `10`, `1` |
| 2 | `calc_single` | Evaluate one expression | `{"expression": "sin(pi/6)+sqrt(9)"}` | `3.5` |
| 3 | `calc_derivative` | Numerical derivative (Richardson extrapolation) | `{"expression": "x^3", "point": 2}` | `12` |
| 4 | `calc_integral` | Definite integral, composite Simpson | `{"expression": "x^2", "a": 0, "b": 1}` | `0.3333333333` |
| 5 | `calc_double_integral` | Double integral over a rectangle | `{"expression": "x+y", "xa": 0, "xb": 1, "ya": 0, "yb": 1}` | `1` |
| 6 | `calc_solve` | Root of f(x)=0, Newton or bisection | `{"expression": "x^2-2", "method": "bisection", "a": 1, "b": 2}` | root `1.41421356237…` |
| 7 | `calc_series` | Finite series sum (compensated) | `{"expression": "1/n^2", "n_start": 1, "n_end": 5}` | `1.4636111111111112` |
| 8 | `calc_limit` | Numerical limit classification | `{"expression": "sin(x)/x", "approach": 0}` | limit `1` |
| 9 | `calc_taylor` | Taylor coefficients (automatic differentiation) | `{"expression": "exp(x)", "order": 4}` | `[1, 1, 0.5, 0.1666…, 0.04166…]` |
| 10 | `calc_ode` | dy/dx = f(x,y), Euler or RK4 | `{"expression": "x+y", "x0": 0, "y0": 1, "x_end": 1, "steps": 5}` | y(1) ≈ `3.4365` |
| 11 | `calc_matrix` | det, inv, transpose, trace, eigen, add, sub, mul | `{"operation": "inv", "matrix": "[[4,7],[2,6]]"}` | `[["0.6","-0.7"],["-0.2","0.4"]]` |
| 12 | `calc_simplify` | Numeric evaluation with substitutions (not a CAS) | `{"expression": "2*x+3", "substitutions": {"x": 4}}` | `11` |
| 13 | `calc_constants` | List/search constants | `{"query": "hbar"}` | `1.054571817e-34` |
| 14 | `calc_convert` | Unit conversion within a dimension | `{"value": 100, "from": "C", "to": "F"}` | `212` |
| 15 | `calc_stats` | Descriptive statistics | `{"data": [1, 2, 2, 3, 4]}` | mean `2.4`, q1 `2`, q3 `3`, … |
| 16 | `calc_base_convert` | Integer base conversion 2–36 (arbitrary size) | `{"value": "255", "to_base": 16}` | `FF` |
| 17 | `calc_prime` | is_prime, factorize, nth_prime, primes_in_range, prime_count, next/prev | `{"operation": "factorize", "n": 84}` | `[2, 2, 3, 7]` |
| 18 | `calc_plot_data` | x/y arrays for charting | `{"expression": "x^2", "x_min": -2, "x_max": 2, "points": 5}` | `y=[4,1,0,1,4]` |
| 19 | `calc_least_squares` | Linear or polynomial (degree ≤ 10) least squares | `{"x": [1,2,3,4], "y": [2,4.1,5.9,8.2]}` | slope `2.04`, R² `0.99799` |
| 20 | `calc_probability` | normal, binomial, poisson, exponential, uniform, chi2, t | `{"distribution": "normal", "operation": "cdf", "params": {"x": 1.96}}` | `0.9750021048517795` |
| 21 | `calc_hypothesis_test` | z-test, one-sample t, Welch two-sample t, χ² GOF | `{"test": "z_test", "params": {"sample_mean": 5.2, "mu0": 5, "sigma": 1.5, "n": 36}}` | p `0.4237` |
| 22 | `calc_confidence_interval` | mean (z / t), proportion, variance | `{"type": "mean_t", "data": [10,12,9,11,13]}` | `[9.0368, 12.9632]` |
| 23 | `calc_anova` | One-way ANOVA (F distribution p-value) | `{"groups": [[4,5,6],[5,6,7],[8,9,10]]}` | F `13`, p `0.00659` |
| 24 | `calc_correlation` | Pearson (with p-value), Spearman, Kendall τ-b, covariance | `{"x": [1,2,3,4], "y": [2,4,6,8]}` | r `1` |
| 25 | `health` | Health check | `{}` | `{"status": "ok", "version": "1.1.0", "tools": 25}` |

The optional `variables` argument (an object mapping names to numbers) is accepted by:

- `calc_batch` and `calc_single`
- `calc_derivative`, `calc_integral` and `calc_double_integral`
- `calc_solve`, `calc_series`, `calc_limit` and `calc_taylor`
- `calc_ode` and `calc_plot_data`

### Notes on specific tools

- **`precision`** (`calc_batch`, `calc_single`) is the number of *significant digits*, between 1 and 17. The default is 10.
- **`calc_probability`:**
  - `pdf` and `cdf` work for every distribution.
  - `quantile` works for normal, exponential, uniform, chi2 and t.
  - `sample` works for normal and poisson, with at most 10,000 draws.
  - Moments that do not exist, such as the mean of t with df = 1, are returned as `null`.
- **`calc_hypothesis_test`:** all tests are two-sided. t-tests use the exact Student t distribution, and the two-sample test is Welch's.
- **`calc_confidence_interval`:** pass either `data` or summary statistics (`sample_mean`, `sample_std`, `n`).
- **`calc_stats`:**
  - Quartiles use linear interpolation (same as NumPy's default and Excel `QUARTILE.INC`).
  - Skewness and excess kurtosis use population moments. They are `null` for constant data.
- **`calc_convert`:**
  - Supported dimensions: length, mass, pressure, energy, power, frequency, speed, volume, time and temperature (`C`/`F`/`K`).
  - Unit names are case-sensitive, with an unambiguous case-insensitive fallback (`kwh` → `kWh`).
  - Converting between different dimensions is an error.
  - `nm` means **nautical mile** (kept for compatibility). Use `nmi` to be explicit.
- **`calc_matrix`:**
  - `eigen` returns the dominant eigenvalue (largest |λ|) by power iteration, together with a `converged` flag.
  - It does not converge for complex or equal-magnitude dominant eigenvalues.
  - Matrices may be given as expression strings or as JSON arrays.
- **`calc_taylor`:**
  - Supports the elementary functions, powers, `abs`, rounding functions, `atan2`, `erf`, and `max`/`min` of two arguments.
  - `gamma`, `factorial` and the statistical functions of an x-dependent argument return an error.
- **`calc_limit` and `calc_simplify`** are numerical tools. They do not do symbolic manipulation.

## Limits

Every bound below prevents unbounded CPU or memory use from untrusted input.

| Limit | Value |
| --- | --- |
| HTTP request body | 1 MiB |
| JSON-RPC batch | 50 messages |
| Expression length / nesting depth | 20,000 chars / 1,000 |
| `calc_batch` expressions | 100 |
| Work budget for numerical tools | 5·10⁷ expression-node evaluations per call |
| Integral subdivisions | 10⁶ (1-D), 2,000 per axis (2-D) |
| Series terms / ODE steps / plot points | 10⁶ / 10⁵ / 10⁴ |
| Solver iterations | 10,000 |
| Taylor order | 50 |
| Data arrays | 100,000 values (Kendall: 5,000) |
| Matrix size | 100 × 100 |
| `nth_prime` / `prime_count` / `primes_in_range` width | 10⁶ / 10⁷ / 10⁵ |
| Integers for `calc_prime` | safe integers (≤ 2⁵³ − 1) |

## Project layout

```text
src/index.js            Worker entry: HTTP, CORS, body limits
src/protocol.js         JSON-RPC / MCP message handling
src/tools/definitions.js  Tool names and input schemas (tools/list)
src/tools/index.js      Tool dispatch
src/tools/*.js          Tool handlers by area (expression, calculus, matrix, units, primes, statistics, probability)
src/lib/expression.js   Tokenizer, parser, evaluator, builtins
src/lib/special.js      Special functions and distributions
src/lib/numeric.js      Numerical calculus
src/lib/taylor.js       Taylor-mode automatic differentiation
src/lib/matrix.js       Matrix algorithms
src/lib/validate.js     Input validation and limits
test/*.test.js          node:test suites
```

## Development

You need Node.js 20 or newer. There are no runtime dependencies to install.

```bash
npm test                          # run the test suite (node:test)
npx wrangler dev                  # local dev server on http://localhost:8787
```

Smoke test against a local server:

```bash
curl -s localhost:8787/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"calc_single","arguments":{"expression":"2x^2","variables":{"x":3}}}}'
```

CI (GitHub Actions) runs the tests on Node 20 and 22 for pushes to `main` and for pull requests.

## Deployment

```bash
npx wrangler login
npx wrangler deploy
```

The server is public and unauthenticated, and CORS allows any origin. If you need access control, put it behind Cloudflare Access or add an auth check in `src/index.js`.

## Compatibility notes (1.1.0)

Tool names, their order and their input schemas are unchanged. The only schema changes are new optional properties. Some outputs changed because the old behavior was wrong:

- **Tool errors:** these are now `isError` tool results instead of JSON-RPC error `-32000`.
- **Implicit multiplication:** `2x^2` now means `2*(x^2)`. It used to mean `(2x)^2`.
- **Malformed input:**
  - Trailing tokens, unknown characters and unbalanced brackets are now errors. They used to be silently ignored.
  - `2e` now means `2*e`. It used to be `2`.
- **Small values:** nonzero values below 1e-15 are no longer displayed as `0`.
- **`precision`:** this now means significant digits throughout, including exponential output.
- **Statistics:**
  - p-values for t-tests, χ² GOF, ANOVA and Pearson are now correct. The old ones came from normal or ad-hoc approximations.
  - Quartiles, skewness, kurtosis, Spearman with ties and Kendall with ties now follow the standard definitions.
- **`calc_convert`:**
  - Output reports the canonical unit names.
  - Mismatched dimensions are rejected.
- **`calc_limit`:** non-finite samples are now reported as strings such as `"NaN"` or `"Infinity"`. They used to be `null`.

## License

[GPL-3.0](LICENSE)
