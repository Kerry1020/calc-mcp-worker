// Regression tests for calculus tools and numerical methods.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcDerivative, calcIntegral, calcDoubleIntegral, calcSolve, calcSeries, calcLimit, calcTaylor, calcOde, calcPlotData,
} from '../src/tools/calculus.js';

const out = (r) => JSON.parse(r.content[0].text);
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test('derivative: accurate (Richardson) and scaled for large x', () => {
  assert.equal(out(calcDerivative({ expression: 'x^3', point: 2 })).derivative, '12');
  assert.equal(out(calcDerivative({ expression: 'x^2', point: 1e10 })).derivative, '20000000000');
  assert.equal(out(calcDerivative({ expression: 'sin(x)', point: 0 })).derivative, '1');
});

test('derivative of a constant is 0, not "unstable"', () => {
  assert.equal(out(calcDerivative({ expression: '5', point: 2 })).derivative, '0');
});

test('derivative reports syntax errors and undefined variables instead of NaN', () => {
  assert.throws(() => calcDerivative({ expression: 'sin(x', point: 0 }), /Expected/);
  assert.throws(() => calcDerivative({ expression: 'x*y', point: 0 }), /Undefined variable: y/);
  assert.throws(() => calcDerivative({ expression: 'x', point: 'a' }), /finite number/);
});

test('integral: odd n is rounded up to even (Simpson needs even n)', () => {
  const r = out(calcIntegral({ expression: 'x^3', a: 0, b: 1, n: 5 }));
  assert.equal(r.subdivisions, 6);
  close(Number(r.result), 0.25);
});

test('integral: n is bounded and validated (DoS)', () => {
  assert.throws(() => calcIntegral({ expression: 'x', a: 0, b: 1, n: 1e9 }), /between/);
  assert.throws(() => calcIntegral({ expression: 'x', a: 0, b: 1, n: 10.5 }), /integer/);
  assert.throws(() => calcIntegral({ expression: 'x', a: 0, b: Infinity }), /finite/);
});

test('integral: work budget rejects huge expression x huge n', () => {
  const big = Array(900).fill('x').join('+');
  assert.throws(() => calcIntegral({ expression: big, a: 0, b: 1, n: 1e6 }), /too expensive/);
});

test('double integral supports variables and validates n', () => {
  const r = out(calcDoubleIntegral({ expression: 'k*x*y', xa: 0, xb: 1, ya: 0, yb: 1, variables: { k: 4 } }));
  close(Number(r.result), 1);
  assert.throws(() => calcDoubleIntegral({ expression: 'x', xa: 0, xb: 1, ya: 0, yb: 1, n: 1e5 }), /between/);
});

test('bisection: root at an endpoint is returned, not skipped', () => {
  const r = out(calcSolve({ expression: 'x-1', method: 'bisection', a: 1, b: 3 }));
  assert.equal(r.root, 1);
  assert.equal(r.converged, true);
});

test('bisection: reversed bounds still converge to the root', () => {
  const r = out(calcSolve({ expression: 'x^2-2', method: 'bisection', a: 2, b: 0 }));
  close(r.root, Math.SQRT2, 1e-11);
});

test('bisection honours max_iter', () => {
  const r = out(calcSolve({ expression: 'x^2-2', method: 'bisection', a: 0, b: 2, max_iter: 3 }));
  assert.equal(r.converged, false);
});

test('newton: relative tolerance allows large roots to converge', () => {
  const r = out(calcSolve({ expression: 'x - 1e10', initial_guess: 1 }));
  assert.equal(r.converged, true);
  close(r.root, 1e10);
});

test('newton: max_iter is bounded (DoS)', () => {
  assert.throws(() => calcSolve({ expression: 'x', max_iter: 1e9 }), /between/);
});

test('series: n_start = 0 is honoured (was treated as 1)', () => {
  const r = out(calcSeries({ expression: '1/2^n', n_start: 0, n_end: 10 }));
  close(r.sum, 2 - 1 / 1024);
  assert.equal(r.term_count, 11);
});

test('series: term count bounded and non-finite terms reported', () => {
  assert.throws(() => calcSeries({ expression: 'n', n_end: 1e12 }), /too many terms/);
  assert.throws(() => calcSeries({ expression: '1/n', n_start: 0, n_end: 5 }), /n=0/);
});

test('series: empty range sums to 0 with term_count 0', () => {
  const r = out(calcSeries({ expression: 'n', n_start: 5, n_end: 1 }));
  assert.equal(r.sum, 0);
  assert.equal(r.term_count, 0);
});

test('limit: sin(x)/x -> 1 and 1/x at 0 is infinite one-sided', () => {
  assert.equal(out(calcLimit({ expression: 'sin(x)/x', approach: 0 })).limit, '1');
  assert.equal(out(calcLimit({ expression: '1/x', approach: 0, direction: 'right' })).from_right, 'Infinity');
});

test('taylor: exact coefficients for exp and sin (finite differences were wrong past order 4)', () => {
  const e = out(calcTaylor({ expression: 'exp(x)', order: 8 })).coefficients;
  let f = 1;
  e.forEach((c, n) => { if (n) f *= n; close(c, 1 / f, 1e-14); });
  const s = out(calcTaylor({ expression: 'sin(x)', order: 7 })).coefficients;
  [0, 1, 0, -1 / 6, 0, 1 / 120, 0, -1 / 5040].forEach((v, i) => close(s[i], v, 1e-14));
});

test('taylor: composite functions and non-zero centre', () => {
  // ln(x) around 1: 0, 1, -1/2, 1/3, -1/4
  const l = out(calcTaylor({ expression: 'ln(x)', x0: 1, order: 4 })).coefficients;
  [0, 1, -0.5, 1 / 3, -0.25].forEach((v, i) => close(l[i], v, 1e-14));
  // atan(x): x - x^3/3 + x^5/5
  const a = out(calcTaylor({ expression: 'atan(x)', order: 5 })).coefficients;
  [0, 1, 0, -1 / 3, 0, 0.2].forEach((v, i) => close(a[i], v, 1e-14));
  // sqrt(1+x)
  const q = out(calcTaylor({ expression: 'sqrt(1+x)', order: 3 })).coefficients;
  [1, 0.5, -0.125, 0.0625].forEach((v, i) => close(q[i], v, 1e-14));
  // x^x = exp(x ln x) around 1: 1, 1, 1, 1/2
  const xx = out(calcTaylor({ expression: 'x^x', x0: 1, order: 3 })).coefficients;
  [1, 1, 1, 0.5].forEach((v, i) => close(xx[i], v, 1e-13));
});

test('taylor: polynomial string handles negative x0', () => {
  const r = out(calcTaylor({ expression: '1/(1-x)', x0: -1, order: 2 }));
  assert.match(r.polynomial, /\(x\+1\)/);
  assert.doesNotMatch(r.polynomial, /x--/);
});

test('taylor: order 0 is honoured and order is bounded', () => {
  assert.deepEqual(out(calcTaylor({ expression: 'exp(x)', order: 0 })).coefficients, [1]);
  assert.throws(() => calcTaylor({ expression: 'x', order: 1000 }), /between/);
});

test('taylor: unsupported functions and singularities give clear errors', () => {
  assert.throws(() => calcTaylor({ expression: 'gamma(x)' }), /does not support gamma/);
  assert.throws(() => calcTaylor({ expression: '1/x' }), /division by zero/);
  assert.throws(() => calcTaylor({ expression: 'ln(x)' }), /positive logarithm/);
});

test('ode: steps bounded and validated', () => {
  assert.throws(() => calcOde({ expression: 'y', x0: 0, y0: 1, x_end: 1, steps: 1e9 }), /between/);
  const r = out(calcOde({ expression: 'y', x0: 0, y0: 1, x_end: 1, steps: 100 }));
  close(r.points[r.points.length - 1].y, Math.E, 1e-8);
});

test('plot: points bounded; a single point works', () => {
  assert.throws(() => calcPlotData({ expression: 'x', x_min: 0, x_max: 1, points: 1e7 }), /between/);
  const r = out(calcPlotData({ expression: 'x^2', x_min: 3, x_max: 5, points: 1 }));
  assert.deepEqual(r.y, [9]);
});
