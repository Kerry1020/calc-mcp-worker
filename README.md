# calc-mcp-worker

A high-performance math computation MCP server on Cloudflare Worker. **25 tools**, zero dependencies, no API keys.

Supports batch evaluation (100+ expressions in one call), complex numbers, calculus, matrix operations, ODE solving, and more.

## MCP Tools (25)

### ⚡ Core Computation

| Tool | Description |
|------|-------------|
| `calc_batch` | **Batch evaluate up to 100 expressions in parallel.** Returns all results at once. |
| `calc_single` | Evaluate a single expression. Supports arithmetic, trig, base-10 `log`, natural-log `ln`, constants, complex numbers, and postfix `!` factorial. |
| `calc_simplify` | Numeric simplification/evaluation with substitutions. Not a symbolic CAS. |

### 📐 Calculus

| Tool | Description |
|------|-------------|
| `calc_derivative` | Numerical derivative d/dx at a point. Central difference method. |
| `calc_integral` | Definite integral ∫f(x)dx. Simpson's rule with 10000 subdivisions. |
| `calc_double_integral` | Double integral ∬f(x,y)dxdy over rectangular region. |
| `calc_taylor` | Taylor series expansion to given order. |
| `calc_limit` | Numerical limit classification by multi-point sampling as x approaches a value (left/right/both). |

### 🔢 Equation Solving

| Tool | Description |
|------|-------------|
| `calc_solve` | Solve f(x)=0 via **Newton's method** or **bisection**. Returns iterations and convergence info. |

### 📊 Series & ODE

| Tool | Description |
|------|-------------|
| `calc_series` | Sum a series ∑f(n) with partial sums. |
| `calc_ode` | Solve ODE dy/dx = f(x,y) via **Euler** or **RK4** method. |

### 🔲 Linear Algebra

| Tool | Description |
|------|-------------|
| `calc_matrix` | Matrix ops: det, inv, transpose, trace, eigen, add, sub, mul. Singular inverses return an error instead of `Infinity`. Input: `[[1,2],[3,4]]`. |

### 📈 Statistics

| Tool | Description |
|------|-------------|
| `calc_stats` | Full stats: mean, median, mode, stdev, variance, quartiles, skewness, kurtosis. |

### 🔢 Number Theory

| Tool | Description |
|------|-------------|
| `calc_prime` | Prime operations: test, factorize, nth prime, range, count, next/prev. |
| `calc_base_convert` | Convert between bases (2-36): binary, octal, hex, arbitrary. |

### 📏 Units & Constants

| Tool | Description |
|------|-------------|
| `calc_convert` | Unit conversion: length, mass, pressure, energy, temperature, speed. |
| `calc_constants` | Search/list all 60+ constants (physics, math, chemistry, astronomy). |

### 📊 Plotting

| Tool | Description |
|------|-------------|
| `calc_plot_data` | Generate x,y data points for plotting any function. |

## Expression Syntax

```
# Arithmetic
2+3*4              → 14
x^3 - 2*x - 5     → (with variables)

# Functions
sin(pi/6)          → 0.5
sqrt(2)            → 1.414213562
factorial(10)      → 3628800
5!/(3!*2!)         → 10
ln(e)              → 1
log(e)             → 0.4342944819   # base-10 log
gamma(5)           → 24
erf(1)             → 0.8427007929

# Complex numbers (use 'i')
abs(-5+3i)         → 5.830951895
e^(i*pi)+1         → 0

# Implicit multiplication
2pi                → 6.283185307
3i                 → 3i

# Constants
c                  → 299792458 (speed of light)
h                  → 6.626e-34 (Planck)
Na                 → 6.022e23  (Avogadro)

# Matrices
[[1,2],[3,4]]      → [[1,2],[3,4]]
```

## Available Functions

**Trig**: sin, cos, tan, sec, csc, cot, asin, acos, atan, atan2, sinh, cosh, tanh, asinh, acosh, atanh

**Math**: sqrt, cbrt, abs, `ln` (natural log), `log`/`log10` (base-10), log2, exp, ceil, floor, round, sign, pow, mod

**Special**: factorial, gamma, erf, binom (binomial coefficient), gcd, lcm

**Complex**: csin, ccos, ctan, csqrt, cexp, cln, re, im, conj, arg

**Conversion**: rad (deg→rad), deg (rad→deg)

**Statistics**: mean, median, stdev, variance (on arrays)

## Constants (60+)

| Category | Examples |
|----------|---------|
| **Math** | pi, e, phi (golden ratio), euler_gamma, catalan, apery, ln2, ln10, sqrt2 |
| **Physics** | c (speed of light), h (Planck), hbar, k (Boltzmann), G (gravitational), g0 (gravity), e_charge, sigma (Stefan-Boltzmann) |
| **Particle** | m_e, m_p, m_n (electron/proton/neutron mass), a0 (Bohr radius) |
| **EM** | epsilon0, mu0 (vacuum permittivity/permeability) |
| **Thermo** | R (gas), Na (Avogadro), F (Faraday) |
| **Astro** | au, ly, pc, M_sun, R_earth, M_earth |
| **Chemistry** | u (atomic mass unit) |
| **Units** | inch, foot, mile, km, m, cm, mm, yard, nm, lb, kg, g, oz, atm, bar, Pa, kPa, psi, J, kJ, kWh, BTU, W, kW, Hz, kHz, liter, gallon, mph, kph, knot |

## Batch Example

```json
{
  "expressions": [
    "2+3*4",
    "sin(pi/6)",
    "e^(i*pi)+1",
    "factorial(10)",
    "gamma(5)",
    "abs(-5+3i)",
    "c*1e-9",
    "binom(10,3)"
  ]
}
```

Returns all 8 results in one response.

## Behavior Notes

- `!` postfix factorial is supported and only accepts non-negative integers.
- `ln(x)` is natural log; `log(x)` and `log10(x)` are base-10.
- `calc_simplify` is evaluate-only unless substitutions make the expression fully numeric.
- `calc_probability` and `calc_hypothesis_test` require distribution/test-specific params and now fail explicitly when required inputs are missing.
- `calc_limit` is still numerical, but it now reports directional classifications and can mark divergent one-sided limits as `Infinity`/`-Infinity`.

## Local Development

```bash
npm install
npx wrangler dev --local --port 8791
```

## Deploy

```bash
npx wrangler deploy
```

## License

MIT
