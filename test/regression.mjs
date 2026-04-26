import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadCalcModule() {
  let source = await fs.readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  source = source.replace(/export default\s*\{[\s\S]*$/, '');
  source += `\nthis.__calc_exports = { calcBatch, calcSingle, calcDerivative, calcIntegral, calcSolve, calcMatrix, calcSimplify, calcProbability, calcHypothesisTest, calcLimit, handleJsonRpc };`;
  const context = { console, Math, JSON, Array, Number, String, Object, Infinity, NaN, Response: class {} };
  vm.createContext(context);
  new vm.Script(source, { filename: 'calc-index.js' }).runInContext(context);
  return context.__calc_exports;
}

function parseToolText(result) {
  return JSON.parse(result.content[0].text);
}

const calc = await loadCalcModule();

{
  const single = parseToolText(calc.calcSingle({ expression: 'sin(pi/2)+2^5+3!' }));
  assert.equal(single.result, '39');

  const batch = parseToolText(calc.calcBatch({ expressions: ['5!/(3!*2!)', 'ln(e)', 'log(e)'] }));
  assert.equal(batch.batch[0].result, '10');
  assert.equal(batch.batch[1].result, '1');
  assert.equal(batch.batch[2].result, '0.4342944819');
}

{
  const invalidFactorial = parseToolText(calc.calcBatch({ expressions: ['(-1)!', '1.5!'] }));
  assert.match(invalidFactorial.batch[0].error ?? '', /non-negative integer/i);
  assert.match(invalidFactorial.batch[1].error ?? '', /non-negative integer/i);
}

{
  assert.throws(() => calc.calcSingle({ expression: '1/0' }), /non-finite result/i);
}

{
  const derivative = parseToolText(calc.calcDerivative({ expression: '1/x', point: 0 }));
  assert.match(derivative.error ?? '', /unstable|non-finite|NaN/i);
}

{
  assert.throws(() => calc.calcIntegral({ expression: '1/x', a: -1, b: 1 }), /non-finite|NaN/i);
}

{
  const solve = parseToolText(calc.calcSolve({ expression: '1/x', method: 'newton', initial_guess: 1 }));
  assert.equal(solve.converged, false);
}

{
  assert.throws(() => calc.calcMatrix({ operation: 'inv', matrix: '[[1,2],[2,4]]' }), /singular/i);
}

{
  const simplify = parseToolText(calc.calcSimplify({ expression: '(x+1)^2', operation: 'expand' }));
  assert.match(simplify.error ?? '', /not supported/i);
}

{
  assert.throws(() => calc.calcProbability({ distribution: 'normal', operation: 'cdf', params: {} }), /requires x/);
  assert.throws(() => calc.calcProbability({ distribution: 'poisson', operation: 'sample', params: { lambda: 1, n: 0 } }), /positive integer/);
  const ok = calc.calcProbability({ distribution: 'normal', operation: 'cdf', params: { x: 0 } });
  assert.equal(ok.distribution, 'normal');
  const poissonSample = calc.calcProbability({ distribution: 'poisson', operation: 'sample', params: { lambda: 2, n: 3 } });
  assert.equal(poissonSample.distribution, 'poisson');
  assert.equal(poissonSample.sample.length, 3);
}

{
  assert.throws(() => calc.calcHypothesisTest({ test: 'z_test', params: {} }), /sample_mean/);
  const ok = calc.calcHypothesisTest({ test: 'z_test', params: { sample_mean: 5, mu0: 4, sigma: 2, n: 16 } });
  assert.equal(ok.test, 'z_test');
}

{
  const left = parseToolText(calc.calcLimit({ expression: '1/x', approach: 0, direction: 'left' }));
  const right = parseToolText(calc.calcLimit({ expression: '1/x', approach: 0, direction: 'right' }));
  assert.equal(left.from_left_classification, 'infinite');
  assert.equal(left.from_left, '-Infinity');
  assert.equal(right.from_right_classification, 'infinite');
  assert.equal(right.from_right, 'Infinity');
}

{
  const batch = parseToolText(calc.calcBatch({ expressions: ['foo(2)'] }));
  assert.equal(batch.batch[0].result, null);
  assert.match(batch.batch[0].error ?? '', /Unknown function/);
}

{
  const batch = parseToolText(calc.calcBatch({ expressions: ['1/0'] }));
  assert.equal(batch.batch[0].result, null);
  assert.match(batch.batch[0].error ?? '', /non-finite/i);
}

{
  const rpc = await calc.handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'calc_matrix', arguments: { operation: 'inv', matrix: '[[1,2],[2,4]]' } } });
  assert.equal(rpc.error.code, -32000);
  assert.match(rpc.error.message, /singular/i);
}

console.log('calc regression tests passed');
