// Special functions and probability distribution primitives.
//
// Accuracy targets: ~1e-14 relative for gamma/lgamma, erf/erfc and the
// regularized incomplete gamma/beta functions over their normal ranges.

const LANCZOS_G = 7;
const LANCZOS_C = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];
const LOG_SQRT_2PI = 0.5 * Math.log(2 * Math.PI);
const MAX_SERIES_ITERATIONS = 10000;
const EPS = 1e-16;
const TINY = 1e-300;

const FACTORIALS = (() => {
  const f = [1];
  for (let i = 1; i <= 170; i++) f[i] = f[i - 1] * i;
  return f;
})();

export function factorialNumber(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) throw new Error("Factorial requires a finite number");
  if (!Number.isFinite(n)) throw new Error("Factorial requires a finite number");
  if (n < 0 || Math.trunc(n) !== n) throw new Error("Factorial requires a non-negative integer");
  return n <= 170 ? FACTORIALS[n] : Infinity;
}

/** Natural log of |Gamma(x)|. */
export function lgamma(x) {
  if (Number.isNaN(x)) return NaN;
  if (x <= 0 && Number.isInteger(x)) return Infinity;
  if (x < 0.5) {
    // Reflection: Gamma(x) Gamma(1-x) = pi / sin(pi x)
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  }
  if (Number.isInteger(x) && x <= 171) return Math.log(FACTORIALS[x - 1]);
  x -= 1;
  let a = LANCZOS_C[0];
  const t = x + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_G + 2; i++) a += LANCZOS_C[i] / (x + i);
  return LOG_SQRT_2PI + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export function gammaFn(z) {
  if (typeof z !== 'number' || Number.isNaN(z)) return NaN;
  if (z === Infinity) return Infinity;
  if (z <= 0 && Number.isInteger(z)) return NaN; // poles at 0, -1, -2, ...
  if (Number.isInteger(z) && z <= 171) return FACTORIALS[z - 1];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFn(1 - z));
  if (z > 171.62) return Infinity;
  z -= 1;
  let x = LANCZOS_C[0];
  for (let i = 1; i < LANCZOS_G + 2; i++) x += LANCZOS_C[i] / (z + i);
  const t = z + LANCZOS_G + 0.5;
  // Split t^(z+0.5) so the intermediate power does not overflow before exp(-t) scales it back.
  const half = Math.pow(t, (z + 0.5) / 2);
  return Math.sqrt(2 * Math.PI) * half * (half * Math.exp(-t)) * x;
}

/** Regularized lower incomplete gamma P(a, x). */
export function gammaP(a, x) {
  if (Number.isNaN(a) || Number.isNaN(x) || a <= 0) return NaN;
  if (x <= 0) return 0;
  if (x === Infinity) return 1;
  return x < a + 1 ? gammaSeries(a, x) : 1 - gammaContinuedFraction(a, x);
}

/** Regularized upper incomplete gamma Q(a, x) = 1 - P(a, x). */
export function gammaQ(a, x) {
  if (Number.isNaN(a) || Number.isNaN(x) || a <= 0) return NaN;
  if (x <= 0) return 1;
  if (x === Infinity) return 0;
  return x < a + 1 ? 1 - gammaSeries(a, x) : gammaContinuedFraction(a, x);
}

function gammaSeries(a, x) {
  let ap = a, sum = 1 / a, del = sum;
  for (let n = 0; n < MAX_SERIES_ITERATIONS; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
}

function gammaContinuedFraction(a, x) {
  // Modified Lentz's method.
  let b = x + 1 - a, c = 1 / TINY, d = 1 / b, h = d;
  for (let i = 1; i < MAX_SERIES_ITERATIONS; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}

/** Regularized incomplete beta I_x(a, b). */
export function betaInc(x, a, b) {
  if (Number.isNaN(x) || !(a > 0) || !(b > 0)) return NaN;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnFront = lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log1p(-x);
  if (x < (a + 1) / (a + b + 2)) return Math.exp(lnFront) * betaContinuedFraction(x, a, b) / a;
  return 1 - Math.exp(lnFront) * betaContinuedFraction(1 - x, b, a) / b;
}

function betaContinuedFraction(x, a, b) {
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAX_SERIES_ITERATIONS; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

export function erfFn(x) {
  if (typeof x !== 'number' || Number.isNaN(x)) return NaN;
  if (x === 0) return 0;
  const p = gammaP(0.5, x * x);
  return x > 0 ? p : -p;
}

export function erfcFn(x) {
  if (typeof x !== 'number' || Number.isNaN(x)) return NaN;
  return x >= 0 ? gammaQ(0.5, x * x) : 1 + gammaP(0.5, x * x);
}

// ---------------------------------------------------------------
// Normal distribution
// ---------------------------------------------------------------
export function normalCdf(z) { return 0.5 * erfcFn(-z / Math.SQRT2); }
export function normalSf(z) { return 0.5 * erfcFn(z / Math.SQRT2); }

/** Inverse standard normal CDF (Acklam's algorithm + one Halley refinement step). */
export function normalQuantile(p) {
  if (Number.isNaN(p) || p < 0 || p > 1) return NaN;
  if (p === 0) return -Infinity;
  if (p === 1) return Infinity;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pLow = 0.02425;
  let x;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pLow) {
    const q = p - 0.5, r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log1p(-p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  // Halley refinement against the high-precision CDF; use the tail that is not close to 1.
  for (let i = 0; i < 2; i++) {
    const e = p < 0.5 ? normalCdf(x) - p : (1 - p) - normalSf(x);
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    x = x - u / (1 + x * u / 2);
  }
  return x;
}

/** Inverse error function, via the normal quantile. */
export function erfinv(y) {
  if (Number.isNaN(y) || y < -1 || y > 1) return NaN;
  if (y === 0) return 0;
  // erf(x) = 2 Phi(x sqrt2) - 1. Use the tail for |y| near 1 to keep precision.
  const s = Math.sign(y), ay = Math.abs(y);
  return s * -normalQuantile((1 - ay) / 2) / Math.SQRT2;
}

// ---------------------------------------------------------------
// Student t, chi-square, F
// ---------------------------------------------------------------
export function tCdf(t, df) {
  if (Number.isNaN(t)) return NaN;
  if (t === Infinity) return 1;
  if (t === -Infinity) return 0;
  const tail = 0.5 * betaInc(df / (df + t * t), df / 2, 0.5);
  return t > 0 ? 1 - tail : tail;
}

/** Two-sided p-value P(|T| >= |t|). */
export function tTwoSidedP(t, df) {
  if (Number.isNaN(t)) return NaN;
  if (!Number.isFinite(t)) return 0;
  return betaInc(df / (df + t * t), df / 2, 0.5);
}

export function chi2Cdf(x, k) { return gammaP(k / 2, x / 2); }
export function chi2Sf(x, k) { return gammaQ(k / 2, x / 2); }

export function fSf(f, d1, d2) {
  if (Number.isNaN(f)) return NaN;
  if (f <= 0) return 1;
  if (f === Infinity) return 0;
  return betaInc(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);
}

/** Invert a monotone increasing CDF on (lo, hi) by expanding the bracket then bisecting. */
function invertCdf(cdf, p, lo, hi, lowerBound = -Infinity) {
  let guard = 0;
  while (cdf(hi) < p && guard++ < 2000) { lo = hi; hi = hi > 0 ? hi * 2 : hi + 1; }
  guard = 0;
  while (cdf(lo) > p && guard++ < 2000) { hi = lo; lo = lo < 0 ? lo * 2 : (lowerBound === 0 ? lo / 2 : lo - 1); }
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    if (mid === lo || mid === hi) break;
    if (cdf(mid) < p) lo = mid; else hi = mid;
    if (hi - lo <= 1e-15 * Math.max(1e-300, Math.abs(mid))) break;
  }
  return (lo + hi) / 2;
}

export function tQuantile(p, df) {
  if (Number.isNaN(p) || p < 0 || p > 1) return NaN;
  if (p === 0) return -Infinity;
  if (p === 1) return Infinity;
  if (p === 0.5) return 0;
  // Symmetric: solve in the upper half for better precision.
  if (p < 0.5) return -tQuantile(1 - p, df);
  const z = normalQuantile(p);
  return invertCdf(x => tCdf(x, df), p, 0, Math.max(1, 2 * z));
}

export function chi2Quantile(p, k) {
  if (Number.isNaN(p) || p < 0 || p > 1) return NaN;
  if (p === 0) return 0;
  if (p === 1) return Infinity;
  return invertCdf(x => chi2Cdf(x, k), p, 0, Math.max(1, 2 * k), 0);
}

// ---------------------------------------------------------------
// Discrete distributions
// ---------------------------------------------------------------
export function logChoose(n, k) { return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1); }

export function binomialPmf(k, n, p) {
  if (!Number.isInteger(k) || k < 0 || k > n) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  return Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
}

export function binomialCdf(k, n, p) {
  if (Number.isNaN(k)) return NaN;
  k = Math.floor(k);
  if (k < 0) return 0;
  if (k >= n) return 1;
  return betaInc(1 - p, n - k, k + 1);
}

export function poissonPmf(k, lambda) {
  if (!Number.isInteger(k) || k < 0) return 0;
  return Math.exp(k * Math.log(lambda) - lambda - lgamma(k + 1));
}

export function poissonCdf(k, lambda) {
  if (Number.isNaN(k)) return NaN;
  k = Math.floor(k);
  if (k < 0) return 0;
  return gammaQ(k + 1, lambda);
}

// ---------------------------------------------------------------
// Integer helpers used by the expression language
// ---------------------------------------------------------------
export function gcdFn(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

export function lcmFn(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  const g = gcdFn(a, b);
  if (g === 0) return 0;
  return Math.abs(Math.round(a) / g * Math.round(b));
}

export function binomialFn(n, k) {
  if (!Number.isInteger(n) || !Number.isInteger(k)) throw new Error("binom requires integer arguments");
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  if (k > 1000) return Math.round(Math.exp(logChoose(n, k)));
  let r = 1;
  for (let i = 0; i < k; i++) {
    r = r * (n - i) / (i + 1);
    if (!Number.isFinite(r)) return Infinity;
  }
  return Math.round(r);
}

// ---------------------------------------------------------------
// Random sampling
// ---------------------------------------------------------------
export function boxMuller(mu, sigma, n) {
  const samples = [];
  while (samples.length < n) {
    const u1 = 1 - Math.random(); // (0, 1], avoids log(0)
    const u2 = Math.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    samples.push(mu + sigma * r * Math.cos(2 * Math.PI * u2));
    if (samples.length < n) samples.push(mu + sigma * r * Math.sin(2 * Math.PI * u2));
  }
  return samples.map(v => parseFloat(v.toPrecision(6)));
}

/** Poisson variate: Knuth for small lambda, PTRS (Hoermann 1993) otherwise. */
export function poissonSample(lambda) {
  if (lambda < 10) {
    const l = Math.exp(-lambda);
    let k = 0, product = 1;
    do { k++; product *= Math.random(); } while (product > l);
    return k - 1;
  }
  const slam = Math.sqrt(lambda), loglam = Math.log(lambda);
  const b = 0.931 + 2.53 * slam, a = -0.059 + 0.02483 * b;
  const invalpha = 1.1239 + 1.1328 / (b - 3.4), vr = 0.9277 - 3.6224 / (b - 2);
  for (;;) {
    const U = Math.random() - 0.5, V = Math.random();
    const us = 0.5 - Math.abs(U);
    const k = Math.floor((2 * a / us + b) * U + lambda + 0.43);
    if (us >= 0.07 && V <= vr) return k;
    if (k < 0 || (us < 0.013 && V > us)) continue;
    if (Math.log(V) + Math.log(invalpha) - Math.log(a / (us * us) + b) <= -lambda + k * loglam - lgamma(k + 1)) return k;
  }
}
