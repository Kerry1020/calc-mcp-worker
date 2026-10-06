// Original regression suite, ported to node:test with direct module imports.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calcBatch, calcSingle, calcSimplify } from '../src/tools/expression.js';
import { calcDerivative, calcIntegral, calcSolve, calcLimit } from '../src/tools/calculus.js';
import { calcMatrix } from '../src/tools/matrix.js';
import { calcProbability, calcHypothesisTest } from '../src/tools/probability.js';
import { handleJsonRpc } from '../src/protocol.js';

const parseToolText = (result) => JSON.parse(result.content[0].text);

test('basic expressions', () => {
  const single = parseToolText(calcSingle({ expression: 'sin(pi/2)+2^5+3!' }));
  assert.equal(single.result, '39');

  const batch = parseToolText(calcBatch({ expressions: ['5!/(3!*2!)', 'ln(e)', 'log(e)'] }));
  assert.equal(batch.batch[0].result, '10');
  assert.equal(batch.batch[1].result, '1');
  assert.equal(batch.batch[2].result, '0.4342944819');
});

test('factorial rejects negative and non-integer input', () => {
  const invalid = parseToolText(calcBatch({ expressions: ['(-1)!', '1.5!'] }));
  assert.match(invalid.batch[0].error ?? '', /non-negative integer/i);
  assert.match(invalid.batch[1].error ?? '', /non-negative integer/i);
});

test('division by zero is a non-finite error', () => {
  assert.throws(() => calcSingle({ expression: '1/0' }), /non-finite result/i);
});

test('derivative at a pole is reported as unstable', () => {
  const derivative = parseToolText(calcDerivative({ expression: '1/x', point: 0 }));
  assert.match(derivative.error ?? '', /unstable|non-finite|NaN/i);
});

test('integral across a pole fails', () => {
  assert.throws(() => calcIntegral({ expression: '1/x', a: -1, b: 1 }), /non-finite|NaN/i);
});

test('newton on 1/x does not converge', () => {
  const solve = parseToolText(calcSolve({ expression: '1/x', method: 'newton', initial_guess: 1 }));
  assert.equal(solve.converged, false);
});

test('singular matrix inversion fails', () => {
  assert.throws(() => calcMatrix({ operation: 'inv', matrix: '[[1,2],[2,4]]' }), /singular/i);
});

test('symbolic simplify operations are unsupported', () => {
  const simplify = parseToolText(calcSimplify({ expression: '(x+1)^2', operation: 'expand' }));
  assert.match(simplify.error ?? '', /not supported/i);
});

test('probability parameter validation', () => {
  assert.throws(() => calcProbability({ distribution: 'normal', operation: 'cdf', params: {} }), /requires x/);
  assert.throws(() => calcProbability({ distribution: 'poisson', operation: 'sample', params: { lambda: 1, n: 0 } }), /positive integer/);
  const ok = calcProbability({ distribution: 'normal', operation: 'cdf', params: { x: 0 } });
  assert.equal(ok.distribution, 'normal');
  const poissonSample = calcProbability({ distribution: 'poisson', operation: 'sample', params: { lambda: 2, n: 3 } });
  assert.equal(poissonSample.distribution, 'poisson');
  assert.equal(poissonSample.sample.length, 3);
});

test('hypothesis test parameter validation', () => {
  assert.throws(() => calcHypothesisTest({ test: 'z_test', params: {} }), /sample_mean/);
  const ok = calcHypothesisTest({ test: 'z_test', params: { sample_mean: 5, mu0: 4, sigma: 2, n: 16 } });
  assert.equal(ok.test, 'z_test');
});

test('one-sided limits of 1/x at 0 are infinite', () => {
  const left = parseToolText(calcLimit({ expression: '1/x', approach: 0, direction: 'left' }));
  const right = parseToolText(calcLimit({ expression: '1/x', approach: 0, direction: 'right' }));
  assert.equal(left.from_left_classification, 'infinite');
  assert.equal(left.from_left, '-Infinity');
  assert.equal(right.from_right_classification, 'infinite');
  assert.equal(right.from_right, 'Infinity');
});

test('unknown function is reported per-expression in a batch', () => {
  const batch = parseToolText(calcBatch({ expressions: ['foo(2)'] }));
  assert.equal(batch.batch[0].result, null);
  assert.match(batch.batch[0].error ?? '', /Unknown function/);
});

test('non-finite batch result is reported per-expression', () => {
  const batch = parseToolText(calcBatch({ expressions: ['1/0'] }));
  assert.equal(batch.batch[0].result, null);
  assert.match(batch.batch[0].error ?? '', /non-finite/i);
});

test('tool errors surface through JSON-RPC', async () => {
  const rpc = await handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'calc_matrix', arguments: { operation: 'inv', matrix: '[[1,2],[2,4]]' } } });
  assert.equal(rpc.error.code, -32000);
  assert.match(rpc.error.message, /singular/i);
});
