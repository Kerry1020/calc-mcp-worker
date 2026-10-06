// Regression tests for statistics, probability and inference tools.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calcStats, calcLeastSquares, calcAnova, calcCorrelation } from '../src/tools/statistics.js';
import { calcProbability, calcHypothesisTest, calcConfidenceInterval } from '../src/tools/probability.js';
import { erfFn, erfinv, normalQuantile, tQuantile, chi2Quantile, gammaFn } from '../src/lib/special.js';

const out = (r) => JSON.parse(r.content[0].text);
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test('special functions match reference values', () => {
  close(erfFn(0.5), 0.5204998778130465, 1e-14);
  close(erfFn(2), 0.9953222650189527, 1e-14);
  close(normalQuantile(0.975), 1.959963984540054, 1e-14);
  close(normalQuantile(1e-10), -6.361340902404056, 1e-13);
  close(tQuantile(0.975, 4), 2.7764451051977987, 1e-12);
  close(chi2Quantile(0.975, 4), 11.143286781877796, 1e-12);
  close(gammaFn(0.5), Math.sqrt(Math.PI), 1e-14);
});

test('erfinv is accurate in the tails (old approximation returned 6.29 for 0.999)', () => {
  close(erfinv(0.95), 1.3859038243496777, 1e-13);
  close(erfinv(0.999), 2.326753765513525, 1e-13);
  close(erfFn(erfinv(0.9999999)), 0.9999999, 1e-14);
});

test('normal CDF is accurate (old erf approximation had ~1e-7 error)', () => {
  close(calcProbability({ distribution: 'normal', operation: 'cdf', params: { x: 1.96 } }).cdf, 0.9750021048517795, 1e-14);
  close(calcProbability({ distribution: 'normal', operation: 'quantile', params: { p: 0.999 } }).quantile, 3.090232306167813, 1e-13);
});

test('one-sample t-test uses the t distribution, not the normal', () => {
  const r = calcHypothesisTest({ test: 't_test_one_sample', params: { data: [5.1, 4.9, 5.3, 5.6], mu0: 5 } });
  close(r.p_value, 0.22891198551023073, 1e-9); // t(3) two-sided, independent numerical integration
  close(r.critical_value, 3.182446305284263, 1e-12);
});

test('Welch two-sample t-test p-value', () => {
  const r = calcHypothesisTest({ test: 't_test_two_sample', params: { data1: [1, 2, 3, 4, 5], data2: [3, 4, 5, 6, 7.5] } });
  close(r.p_value, 0.08171612781973266, 1e-9); // independent numerical integration of the t pdf (df=7.922)
});

test('chi-square goodness of fit uses the chi2 distribution with df', () => {
  const r = calcHypothesisTest({ test: 'chi2_gof', params: { observed: [10, 20, 30], expected: [20, 20, 20] } });
  close(r.p_value, Math.exp(-5), 1e-12); // chi2 sf(10, df=2) = e^-5
  assert.equal(r.df, 2);
});

test('hypothesis tests validate inputs', () => {
  assert.throws(() => calcHypothesisTest({ test: 't_test_one_sample', params: { data: [1], mu0: 0 } }), /at least 2/);
  assert.throws(() => calcHypothesisTest({ test: 't_test_one_sample', params: { data: [1, 1, 1], mu0: 0 } }), /non-zero variance/);
  assert.throws(() => calcHypothesisTest({ test: 'z_test', params: { sample_mean: 1, mu0: 0, sigma: 1, n: 4, alpha: 2 } }), /alpha/);
});

test('mean_t confidence interval uses the t critical value', () => {
  const r = calcConfidenceInterval({ type: 'mean_t', data: [10, 12, 9, 11, 13] });
  close(r.lower, 9.036756838522443, 1e-12);
  close(r.upper, 12.963243161477557, 1e-12);
});

test('mean_t / mean_z accept summary statistics', () => {
  const r = calcConfidenceInterval({ type: 'mean_t', sample_mean: 11, sample_std: Math.sqrt(2.5), n: 5 });
  close(r.lower, 9.036756838522443, 1e-12);
  const z = calcConfidenceInterval({ type: 'mean_z', sample_mean: 0, sigma: 1, n: 1 });
  close(z.upper, 1.959963984540054, 1e-12);
  assert.throws(() => calcConfidenceInterval({ type: 'mean_z', data: [1, 2] }), /sigma/);
});

test('variance confidence interval uses exact chi2 quantiles', () => {
  const r = calcConfidenceInterval({ type: 'variance', data: [10, 12, 9, 11, 13] });
  // df=4, s^2=2.5: [4*2.5/11.1433, 4*2.5/0.48442]
  close(r.lower, 10 / 11.143286781877796, 1e-10);
  close(r.upper, 10 / 0.48441855708793, 1e-10);
});

test('confidence level is validated', () => {
  assert.throws(() => calcConfidenceInterval({ type: 'proportion', p: 0.5, n: 10, confidence: 1.5 }), /confidence/);
});

test('ANOVA p-value from the F distribution', () => {
  const r = calcAnova({ groups: [[4, 5, 6], [5, 6, 7], [8, 9, 10]] });
  close(r.F_statistic, 13);
  close(r.p_value, Math.pow(1 + 13 * 2 / 6, -3), 1e-12); // F(2,6) survival has closed form
  assert.throws(() => calcAnova({ groups: [[1, 2]] }), /at least 2 groups/);
  assert.throws(() => calcAnova({ groups: [[1], [2]] }), /more observations/);
});

test('binomial/poisson: large n and k are exact and fast (no loops, no overflow)', () => {
  const t = Date.now();
  const b = calcProbability({ distribution: 'binomial', operation: 'cdf', params: { n: 5000, p: 0.5, k: 2500 } });
  close(b.cdf, 0.5056416137465, 1e-10);
  const pmf = calcProbability({ distribution: 'binomial', operation: 'pdf', params: { n: 2000, p: 0.5, k: 1000 } });
  close(pmf.pdf, 0.017839, 1e-4);
  const pc = calcProbability({ distribution: 'poisson', operation: 'cdf', params: { lambda: 1000, k: 1e12 } });
  assert.equal(pc.cdf, 1);
  const pp = calcProbability({ distribution: 'poisson', operation: 'pdf', params: { lambda: 200, k: 200 } });
  close(pp.pdf, 0.028197727685917866, 1e-12);
  assert.ok(Date.now() - t < 200);
});

test('discrete pmf is 0 for non-integer k', () => {
  assert.equal(calcProbability({ distribution: 'binomial', operation: 'pdf', params: { n: 10, k: 1.5 } }).pdf, 0);
  assert.equal(calcProbability({ distribution: 'poisson', operation: 'pdf', params: { lambda: 2, k: 1.5 } }).pdf, 0);
});

test('chi2 and t: cdf/quantile supported; large df pdf does not overflow', () => {
  close(calcProbability({ distribution: 'chi2', operation: 'cdf', params: { df: 2, x: 10 } }).cdf, 1 - Math.exp(-5), 1e-12);
  close(calcProbability({ distribution: 't', operation: 'quantile', params: { df: 4, p: 0.975 } }).quantile, 2.7764451051977987, 1e-12);
  const t = calcProbability({ distribution: 't', operation: 'pdf', params: { df: 1000, x: 0 } }).pdf;
  close(t, 0.398842, 1e-5);
  const c = calcProbability({ distribution: 'chi2', operation: 'pdf', params: { df: 2000, x: 2000 } }).pdf;
  assert.ok(Number.isFinite(c) && c > 0);
});

test('t distribution: undefined moments are null rather than missing', () => {
  assert.equal(calcProbability({ distribution: 't', operation: 'mean', params: { df: 1 } }).mean, null);
});

test('sample sizes are bounded and large-lambda poisson sampling terminates', () => {
  assert.throws(() => calcProbability({ distribution: 'normal', operation: 'sample', params: { n: 1e8 } }), /at most/);
  const s = calcProbability({ distribution: 'poisson', operation: 'sample', params: { lambda: 1e6, n: 200 } }).sample;
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  assert.ok(Math.abs(mean - 1e6) < 1e6 * 0.01, `mean ${mean}`);
});

test('stats: quartiles use linear interpolation; shape uses population moments', () => {
  const r = out(calcStats({ data: [1, 2, 3, 4] }));
  assert.equal(r.q1, '1.75');
  assert.equal(r.q3, '3.25');
  assert.equal(r.median, '2.5');
  assert.equal(r.kurtosis, '-1.36');
});

test('stats: constant data has null skewness/kurtosis instead of "NaN"', () => {
  const r = out(calcStats({ data: [5, 5, 5, 5] }));
  assert.equal(r.skewness, null);
  assert.equal(r.kurtosis, null);
});

test('stats: validates input and handles large arrays', () => {
  assert.throws(() => calcStats({ data: [1, 'a'] }), /finite number/);
  assert.throws(() => calcStats({ data: [] }), /at least 1/);
  assert.throws(() => calcStats({ data: 'abc' }), /array/);
  const big = Array.from({ length: 100000 }, (_, i) => i);
  const r = out(calcStats({ data: big })); // Math.max(...spread) would overflow the stack here
  assert.equal(r.n, 100000);
});

test('stats: compensated summation keeps precision', () => {
  const r = out(calcStats({ data: [1e16, 1, -1e16] }));
  assert.equal(r.sum, 1);
});

test('least squares: vertical line rejected, constant y gives R^2 = 1', () => {
  assert.throws(() => calcLeastSquares({ x: [1, 1, 1], y: [1, 2, 3] }), /identical/);
  assert.equal(calcLeastSquares({ x: [1, 2, 3], y: [5, 5, 5] }).r_squared, 1);
  assert.equal(calcLeastSquares({ x: [1, 2, 3], y: [3, 1, -1] }).equation, 'y = -2x + 5');
});

test('least squares: polynomial fit via QR is well conditioned', () => {
  const x = Array.from({ length: 20 }, (_, i) => 1000 + i);
  const y = x.map(v => 2 + 3 * v - 0.5 * v * v + 1e-3 * v ** 3);
  const r = calcLeastSquares({ x, y, degree: 3 });
  r.predictions.forEach((p, i) => close(p, y[i], 1e-6));
  assert.throws(() => calcLeastSquares({ x: [1, 2], y: [1, 2], degree: 2 }), /at least 3/);
});

test('spearman handles ties with average ranks', () => {
  const r = calcCorrelation({ x: [1, 2, 2, 3], y: [1, 2, 3, 4], method: 'spearman' });
  close(r.rho, 0.9486832980505138, 1e-12); // Pearson correlation of average ranks
});

test('kendall is tau-b with ties', () => {
  const r = calcCorrelation({ x: [1, 2, 2, 3], y: [1, 2, 3, 4], method: 'kendall' });
  close(r.tau, 0.9128709291752769, 1e-12); // tau-b = (5-0)/sqrt(5*6)
});

test('pearson p-value uses t(n-2); zero variance and unknown methods error', () => {
  const r = calcCorrelation({ x: [1, 2, 3, 4, 5], y: [2, 4, 5, 4, 5] });
  close(r.p_value, 0.12402706265744953, 1e-9); // t(3) two-sided, independent numerical integration
  assert.throws(() => calcCorrelation({ x: [1, 1, 1], y: [1, 2, 3] }), /zero variance/);
  assert.throws(() => calcCorrelation({ x: [1, 2], y: [1, 2], method: 'foo' }), /Unknown correlation method/);
  assert.throws(() => calcCorrelation({ x: [1, 2], y: [1, 2, 3] }), /same length/);
});
