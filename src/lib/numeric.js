// Numerical calculus. All functions take compiled real-valued functions
// (see compileRealFunction) so an expression is parsed once, not per sample.
import { assertFiniteNumber } from './validate.js';

/** Neumaier compensated summation accumulator. */
export class Sum {
  constructor() { this.s = 0; this.c = 0; }
  add(x) {
    const t = this.s + x;
    if (Math.abs(this.s) >= Math.abs(x)) this.c += (this.s - t) + x;
    else this.c += (x - t) + this.s;
    this.s = t;
    return this;
  }
  get value() { return this.s + this.c; }
}

/**
 * Central-difference derivative with Richardson extrapolation and adaptive step choice.
 *
 * Steps scale with |x| (so large evaluation points do not lose the step to rounding).
 * For each pair of consecutive steps the h^2 error term is eliminated; the pair with
 * the smallest estimated error (truncation estimate + round-off from |f| / h) wins.
 */
export function numericalDerivative(f, x) {
  const scale = Math.max(1, Math.abs(x));
  const steps = [1e-1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8].map(s => s * scale);
  const D = [], noise = [];
  let firstBad = null;
  for (const h of steps) {
    const v1 = f(x + h), v2 = f(x - h);
    if (!Number.isFinite(v1) || !Number.isFinite(v2)) {
      // Large steps may legitimately leave the function's domain.
      firstBad ??= Number.isNaN(v1) || Number.isNaN(v2) ? 'NaN' : 'a non-finite result';
      D.push(NaN); noise.push(Infinity);
      continue;
    }
    D.push((v1 - v2) / (2 * h));
    noise.push(4 * Number.EPSILON * Math.max(Math.abs(v1), Math.abs(v2)) / (2 * h));
  }
  const finiteD = D.filter(Number.isFinite);
  if (finiteD.length < 3) throw new Error(`Derivative sample produced ${firstBad ?? 'NaN'}`);

  // A difference quotient that keeps growing like 1/h^2 as h shrinks indicates a pole at x.
  const tail = finiteD.slice(-3).map(Math.abs);
  if (tail.every((m, i) => i === 0 || (m > 1 && m >= tail[i - 1] * 50))) throw new Error('Derivative is unstable near the evaluation point');

  // Richardson: D(h) = f' + c h^2 + O(h^4); combine consecutive steps (ratio 10).
  const R = [], noiseR = [];
  for (let i = 0; i + 1 < D.length; i++) {
    R.push((100 * D[i + 1] - D[i]) / 99);
    noiseR.push((100 * noise[i + 1] + noise[i]) / 99);
  }
  let best = NaN, bestErr = Infinity;
  for (let i = 0; i < R.length; i++) {
    if (!Number.isFinite(R[i])) continue;
    // Truncation estimate: disagreement with a neighbouring extrapolant, discounted by
    // that neighbour's own round-off level; plus this estimate's round-off.
    const neighbours = [i - 1, i + 1].filter(j => j >= 0 && j < R.length && Number.isFinite(R[j]));
    if (!neighbours.length) continue;
    const err = Math.min(...neighbours.map(j => Math.max(0, Math.abs(R[j] - R[i]) - noiseR[j]))) + noiseR[i];
    if (err < bestErr) { bestErr = err; best = R[i]; }
  }
  if (!Number.isFinite(best)) throw new Error('Derivative is unstable near the evaluation point');
  if (bestErr > 1e-3 * Math.max(1, Math.abs(best))) throw new Error('Derivative is unstable near the evaluation point');
  return best;
}

/** Composite Simpson's rule; n is rounded up to an even number. */
export function numericalIntegral(f, a, b, n = 10000) {
  if (n % 2) n += 1;
  const h = (b - a) / n;
  const sum = new Sum();
  sum.add(assertFiniteNumber(f(a), 'Integral endpoint'));
  sum.add(assertFiniteNumber(f(b), 'Integral endpoint'));
  for (let i = 1; i < n; i++) {
    sum.add((i % 2 === 0 ? 2 : 4) * assertFiniteNumber(f(a + i * h), 'Integral sample'));
  }
  return { value: assertFiniteNumber(sum.value * h / 3, 'Integral'), n };
}

export function numericalIntegral2D(f, xa, xb, ya, yb, n = 50) {
  if (n % 2) n += 1;
  const hx = (xb - xa) / n, hy = (yb - ya) / n;
  const weight = (i) => (i === 0 || i === n) ? 1 : (i % 2 === 0 ? 2 : 4);
  const total = new Sum();
  for (let i = 0; i <= n; i++) {
    const xi = xa + i * hx;
    const inner = new Sum();
    for (let j = 0; j <= n; j++) {
      inner.add(weight(j) * assertFiniteNumber(f(xi, ya + j * hy), 'Double integral sample'));
    }
    total.add(weight(i) * inner.value);
  }
  return { value: assertFiniteNumber(total.value * hx * hy / 9, 'Double integral'), n };
}

const MAX_REPORTED_ITERATIONS = 100;

export function newtonMethod(f, x0, tol = 1e-12, maxIter = 100) {
  let x = x0;
  const iterations = [];
  for (let i = 0; i < maxIter; i++) {
    const fx = assertFiniteNumber(f(x), 'Newton function value');
    if (fx === 0) return { root: x, iterations, converged: true, iterations_count: i };
    const fpx = numericalDerivative(f, x);
    if (Math.abs(fpx) < 1e-15) return { root: null, iterations, converged: false, error: 'Zero derivative' };
    const xNew = assertFiniteNumber(x - fx / fpx, 'Newton iterate');
    if (iterations.length < MAX_REPORTED_ITERATIONS) iterations.push({ i: i + 1, x, fx, fpx, dx: xNew - x });
    if (Math.abs(xNew - x) <= tol * Math.max(1, Math.abs(xNew))) return { root: xNew, iterations, converged: true, iterations_count: i + 1 };
    x = xNew;
  }
  return { root: x, iterations, converged: false, error: 'Did not converge' };
}

export function bisectionMethod(f, a, b, tol = 1e-12, maxIter = 100) {
  if (a > b) [a, b] = [b, a];
  let fa = assertFiniteNumber(f(a), 'Bisection endpoint');
  const fb = assertFiniteNumber(f(b), 'Bisection endpoint');
  if (fa === 0) return { root: a, converged: true, iterations_count: 0 };
  if (fb === 0) return { root: b, converged: true, iterations_count: 0 };
  if (Math.sign(fa) === Math.sign(fb)) return { root: null, converged: false, error: 'f(a) and f(b) have same sign' };
  for (let i = 0; i < maxIter; i++) {
    const c = (a + b) / 2;
    const fc = assertFiniteNumber(f(c), 'Bisection sample');
    if (fc === 0 || Math.abs(fc) < tol || (b - a) / 2 <= tol * Math.max(1, Math.abs(c))) return { root: c, converged: true, iterations_count: i + 1 };
    if (Math.sign(fa) !== Math.sign(fc)) { b = c; } else { a = c; fa = fc; }
  }
  return { root: (a + b) / 2, converged: false, error: 'Did not converge' };
}

export function seriesSum(f, nStart, nEnd) {
  const sum = new Sum();
  const terms = [];
  for (let n = nStart; n <= nEnd; n++) {
    const val = f(n);
    if (!Number.isFinite(val)) throw new Error(`Series term at n=${n} is ${Number.isNaN(val) ? 'NaN' : 'non-finite'}`);
    sum.add(val);
    if (n - nStart < 20) terms.push({ n, value: val, partial_sum: sum.value });
  }
  return { sum: sum.value, nStart, nEnd, terms, term_count: Math.max(0, nEnd - nStart + 1) };
}

function classifyDirectionalLimit(samples) {
  const finite = samples.filter(v => typeof v === 'number' && Number.isFinite(v));
  if (!finite.length) return { classification: 'undefined' };
  const allPositive = finite.every(v => v > 0);
  const allNegative = finite.every(v => v < 0);
  const magnitudes = finite.map(v => Math.abs(v));
  const growingFast = magnitudes.length >= 2 && magnitudes.every((m, i, arr) => i === 0 || m >= arr[i - 1] * 5);
  if (growingFast && allPositive) return { classification: 'infinite', value: Infinity };
  if (growingFast && allNegative) return { classification: 'infinite', value: -Infinity };
  const tail = finite.slice(-3);
  const spread = Math.max(...tail) - Math.min(...tail);
  const scale = Math.max(1, ...tail.map(v => Math.abs(v)));
  if (spread <= scale * 1e-6) return { classification: 'finite', value: tail.reduce((a, b) => a + b, 0) / tail.length };
  return { classification: 'unstable', samples: finite };
}

export function limitExpr(f, approach, fromDir = 'both') {
  const steps = [1e-3, 1e-5, 1e-7, 1e-9].map(h => h * Math.max(1, Math.abs(approach)));
  const result = { approach, direction: fromDir, method: 'multi-point numerical sampling' };
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    if (fromDir !== side && fromDir !== 'both') continue;
    const samples = steps.map(h => f(approach + sign * h));
    const classification = classifyDirectionalLimit(samples);
    result[`from_${side}`] = classification.value !== undefined ? classification.value : null;
    result[`from_${side}_samples`] = samples;
    result[`from_${side}_classification`] = classification.classification;
  }
  if (fromDir === 'both') {
    if (result.from_left_classification === 'finite' && result.from_right_classification === 'finite') {
      const left = result.from_left, right = result.from_right;
      if (Math.abs(left - right) <= Math.max(1, Math.abs(left), Math.abs(right)) * 1e-6) result.limit = (left + right) / 2;
    } else if (result.from_left_classification === 'infinite' && result.from_right_classification === 'infinite' && result.from_left === result.from_right) {
      result.limit = result.from_left;
    }
  }
  return result;
}

export function eulerMethod(f, x0, y0, xEnd, steps) {
  const h = (xEnd - x0) / steps;
  const points = [{ x: x0, y: y0 }];
  let x = x0, y = y0;
  for (let i = 0; i < steps; i++) {
    y = y + h * f(x, y);
    x = x0 + (i + 1) * h;
    points.push({ x, y });
  }
  return { method: 'euler', x0, y0, xEnd, steps, h, points };
}

export function rungeKutta4(f, x0, y0, xEnd, steps) {
  const h = (xEnd - x0) / steps;
  const points = [{ x: x0, y: y0 }];
  let x = x0, y = y0;
  for (let i = 0; i < steps; i++) {
    const k1 = f(x, y);
    const k2 = f(x + h / 2, y + h * k1 / 2);
    const k3 = f(x + h / 2, y + h * k2 / 2);
    const k4 = f(x + h, y + h * k3);
    y = y + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    x = x0 + (i + 1) * h;
    points.push({ x, y });
  }
  return { method: 'rk4', x0, y0, xEnd, steps, h, points };
}
