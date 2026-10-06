import { assertFiniteNumber } from './validate.js';
import { safeNullableEval } from './expression.js';

function ensureStableNumericEstimate(samples, context) {
  const finite = samples.map(value => assertFiniteNumber(value, context));
  const magnitudes = finite.map(v => Math.abs(v));
  const explosive = magnitudes.length >= 2 && magnitudes.every((m, i, arr) => i === 0 || m >= arr[i - 1] * 100);
  if (explosive) throw new Error(`${context} is unstable near the evaluation point`);

  const tail = finite.slice(-2);
  const spread = Math.abs(tail[0] - tail[1]);
  const scale = Math.max(1, ...tail.map(v => Math.abs(v)));
  if (spread > scale * 1e-3) throw new Error(`${context} is unstable near the evaluation point`);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

function numericalDerivative(expr, x, vars = {}, h = 1e-8) {
  const steps = [h * 10000, h * 100, h];
  const samples = steps.map(step => {
    const v1 = assertFiniteNumber(safeNullableEval(expr, { ...vars, x: x + step }), "Derivative sample");
    const v2 = assertFiniteNumber(safeNullableEval(expr, { ...vars, x: x - step }), "Derivative sample");
    return (v1 - v2) / (2 * step);
  });
  return assertFiniteNumber(ensureStableNumericEstimate(samples, "Derivative"), "Derivative");
}

function numericalIntegral(expr, a, b, vars = {}, n = 10000) {
  const h = (b - a) / n;
  let sum = assertFiniteNumber(safeNullableEval(expr, { ...vars, x: a }), "Integral endpoint") + assertFiniteNumber(safeNullableEval(expr, { ...vars, x: b }), "Integral endpoint");
  for (let i = 1; i < n; i++) {
    const xi = a + i * h;
    sum += (i % 2 === 0 ? 2 : 4) * assertFiniteNumber(safeNullableEval(expr, { ...vars, x: xi }), "Integral sample");
  }
  return assertFiniteNumber(sum * h / 3, "Integral");
}

function numericalIntegral2D(expr, xa, xb, ya, yb, vars = {}, n = 50) {
  const hx = (xb - xa) / n;
  let total = 0;
  for (let i = 0; i <= n; i++) {
    const xi = xa + i * hx;
    const cx = (i === 0 || i === n) ? 1 : (i % 2 === 0 ? 2 : 4);
    const hy = (yb - ya) / n;
    let innerSum = 0;
    for (let j = 0; j <= n; j++) {
      const yj = ya + j * hy;
      const cy = (j === 0 || j === n) ? 1 : (j % 2 === 0 ? 2 : 4);
      innerSum += cy * assertFiniteNumber(safeNullableEval(expr, { ...vars, x: xi, y: yj }), "Double integral sample");
    }
    total += cx * innerSum * hy / 3;
  }
  return assertFiniteNumber(total * hx / 3, "Double integral");
}

function newtonMethod(expr, x0, vars = {}, tol = 1e-12, maxIter = 100) {
  let x = x0;
  const iterations = [];
  for (let i = 0; i < maxIter; i++) {
    const fx = assertFiniteNumber(safeNullableEval(expr, { ...vars, x }), "Newton function value");
    const fpx = numericalDerivative(expr, x, vars);
    if (Math.abs(fpx) < 1e-15) return { root: null, iterations, converged: false, error: "Zero derivative" };
    const xNew = assertFiniteNumber(x - fx / fpx, "Newton iterate");
    iterations.push({ i: i + 1, x, fx, fpx, dx: xNew - x });
    if (Math.abs(xNew - x) < tol) return { root: xNew, iterations, converged: true, iterations_count: i + 1 };
    x = xNew;
  }
  return { root: x, iterations, converged: false, error: "Did not converge" };
}

function bisectionMethod(expr, a, b, vars = {}, tol = 1e-12, maxIter = 100) {
  let fa = assertFiniteNumber(safeNullableEval(expr, { ...vars, x: a }), "Bisection endpoint");
  let fb = assertFiniteNumber(safeNullableEval(expr, { ...vars, x: b }), "Bisection endpoint");
  if (fa * fb > 0) return { root: null, converged: false, error: "f(a) and f(b) have same sign" };
  for (let i = 0; i < maxIter; i++) {
    const c = (a + b) / 2;
    const fc = assertFiniteNumber(safeNullableEval(expr, { ...vars, x: c }), "Bisection sample");
    if (Math.abs(fc) < tol || (b - a) / 2 < tol) return { root: c, converged: true, iterations_count: i + 1 };
    if (fa * fc < 0) { b = c; fb = fc; } else { a = c; fa = fc; }
  }
  return { root: (a + b) / 2, converged: false, error: "Did not converge" };
}

function seriesSum(expr, nStart, nEnd, varName = 'n', vars = {}) {
  let sum = 0;
  const terms = [];
  for (let n = nStart; n <= nEnd; n++) {
    const val = safeNullableEval(expr, { ...vars, [varName]: n });
    sum += val;
    if (n - nStart < 20) terms.push({ n, value: val, partial_sum: sum });
  }
  return { sum, nStart, nEnd, terms, term_count: nEnd - nStart + 1 };
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
  if (spread <= scale * 1e-6) {
    return { classification: 'finite', value: tail.reduce((a, b) => a + b, 0) / tail.length };
  }

  return { classification: 'unstable', samples: finite };
}

function limitExpr(expr, approach, fromDir = 'both', vars = {}) {
  const steps = [1e-3, 1e-5, 1e-7, 1e-9];
  const result = { approach, direction: fromDir, method: 'multi-point numerical sampling' };

  if (fromDir === 'left' || fromDir === 'both') {
    const samples = steps.map(h => safeNullableEval(expr, { ...vars, x: approach - h }));
    const classification = classifyDirectionalLimit(samples);
    result.from_left = classification.value !== undefined ? classification.value : null;
    result.from_left_samples = samples;
    result.from_left_classification = classification.classification;
  }

  if (fromDir === 'right' || fromDir === 'both') {
    const samples = steps.map(h => safeNullableEval(expr, { ...vars, x: approach + h }));
    const classification = classifyDirectionalLimit(samples);
    result.from_right = classification.value !== undefined ? classification.value : null;
    result.from_right_samples = samples;
    result.from_right_classification = classification.classification;
  }

  if (fromDir === 'both') {
    if (result.from_left_classification === 'finite' && result.from_right_classification === 'finite') {
      const left = result.from_left;
      const right = result.from_right;
      if (Math.abs(left - right) <= Math.max(1, Math.abs(left), Math.abs(right)) * 1e-6) {
        result.limit = (left + right) / 2;
      }
    } else if (result.from_left_classification === 'infinite' && result.from_right_classification === 'infinite' && result.from_left === result.from_right) {
      result.limit = result.from_left;
    }
  }

  return result;
}

function taylorSeries(expr, x0, order, vars = {}) {
  // Numerical Taylor expansion
  const coeffs = [];
  let factorial = 1;
  for (let n = 0; n <= order; n++) {
    if (n > 0) factorial *= n;
    // nth derivative via finite differences
    const dn = nthDerivative(expr, x0, n, vars);
    coeffs.push({ n, coeff: dn / factorial });
  }
  // Build polynomial string
  const terms = coeffs.map(c => {
    const coeff = c.n === 0 ? c.coeff : c.coeff;
    return `${coeff}*(x-${x0})^${c.n}`;
  });
  return { x0, order, coefficients: coeffs.map(c => c.coeff), polynomial: terms.join(' + ').replace(/\+ -/g, '- ') };
}

function nthDerivative(expr, x0, n, vars = {}, h = 1e-4) {
  if (n === 0) return safeNullableEval(expr, { ...vars, x: x0 });
  // Use finite difference coefficients
  if (n === 1) return numericalDerivative(expr, x0, vars, h);
  // Recursive: d^n/dx^n f(x) ≈ (f^(n-1)(x+h) - f^(n-1)(x-h)) / (2h)
  const deriv = (x) => nthDerivative(expr, x, n - 1, vars, h * 1.5);
  return (deriv(x0 + h) - deriv(x0 - h)) / (2 * h);
}

function eulerMethod(dydx, x0, y0, xEnd, steps, vars = {}) {
  const h = (xEnd - x0) / steps;
  const points = [{ x: x0, y: y0 }];
  let x = x0, y = y0;
  for (let i = 0; i < steps; i++) {
    const slope = safeNullableEval(dydx, { ...vars, x, y });
    y = y + h * slope;
    x = x0 + (i + 1) * h;
    points.push({ x, y });
  }
  return { method: "euler", x0, y0, xEnd, steps, h, points };
}

function rungeKutta4(dydx, x0, y0, xEnd, steps, vars = {}) {
  const h = (xEnd - x0) / steps;
  const points = [{ x: x0, y: y0 }];
  let x = x0, y = y0;
  for (let i = 0; i < steps; i++) {
    const k1 = safeNullableEval(dydx, { ...vars, x, y });
    const k2 = safeNullableEval(dydx, { ...vars, x: x+h/2, y: y+h*k1/2 });
    const k3 = safeNullableEval(dydx, { ...vars, x: x+h/2, y: y+h*k2/2 });
    const k4 = safeNullableEval(dydx, { ...vars, x: x+h, y: y+h*k3 });
    y = y + h*(k1 + 2*k2 + 2*k3 + k4)/6;
    x = x0 + (i+1)*h;
    points.push({ x, y });
  }
  return { method: "rk4", x0, y0, xEnd, steps, h, points };
}

export { numericalDerivative, numericalIntegral, numericalIntegral2D, newtonMethod, bisectionMethod, seriesSum, limitExpr, taylorSeries, eulerMethod, rungeKutta4 };
