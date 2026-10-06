// Regression tests for the expression engine (parser, evaluator, formatting, safety limits).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calcBatch, calcSingle, calcSimplify } from '../src/tools/expression.js';
import { evaluateExpr } from '../src/lib/expression.js';

const single = (expression, extra = {}) => JSON.parse(calcSingle({ expression, ...extra }).content[0].text).result;

test('implicit multiplication binds looser than ^ (2x^2 = 2*(x^2))', () => {
  assert.equal(single('2x^2', { variables: { x: 3 } }), '18');
  assert.equal(single('2(3)^2'), '18');
  assert.equal(single('2^3(4)'), '32');
});

test('implicit multiplication still binds tighter than / (1/2pi = 1/(2pi))', () => {
  assert.equal(single('1/2pi'), single('1/(2*pi)'));
  assert.equal(single('2pi'), '6.283185307');
});

test('trailing tokens and unbalanced parentheses are rejected', () => {
  assert.throws(() => calcSingle({ expression: '1+2)*5' }), /Unexpected token/);
  assert.throws(() => calcSingle({ expression: '(1+2' }), /Expected '\)'/);
  assert.throws(() => calcSingle({ expression: 'max(1,2' }), /Expected '\)'/);
  assert.throws(() => calcSingle({ expression: '[1,2' }), /Expected '\]'/);
});

test('unknown characters are rejected instead of silently dropped', () => {
  assert.throws(() => calcSingle({ expression: '2 & 3' }), /Unexpected character '&'/);
  assert.throws(() => calcSingle({ expression: '2 $ 3' }), /Unexpected character/);
});

test('malformed numbers are rejected; "2e" is 2*e not 2', () => {
  assert.throws(() => calcSingle({ expression: '1.2.3' }), /Malformed number/);
  assert.equal(single('2e'), single('2*e'));
  assert.equal(single('2e3'), '2000');
  assert.equal(single('1.5e-3'), '0.0015');
  assert.equal(single('2exp(0)'), '2');
});

test('unary minus works on complex numbers', () => {
  assert.equal(single('-i'), '-1i');
  assert.equal(single('-(1+2i)'), '-1-2i');
});

test('complex results are formatted and noise-snapped', () => {
  assert.equal(single('e^(i*pi)+1'), '0');
  assert.equal(single('i^2'), '-1');
  assert.equal(single('csqrt(-4)'), '2i');
  assert.equal(single('abs(-5+3i)'), '5.830951895');
  assert.equal(single('sin(i)'), '1.175201194i');
});

test('tiny physical constants are not rounded to zero', () => {
  assert.equal(single('h'), '6.62607015e-34');
  assert.equal(single('k'), '1.380649e-23');
  assert.equal(single('1e-20'), '1e-20');
});

test('statistical builtins accept multiple arguments', () => {
  assert.equal(single('mean(1,2,3)'), '2');
  assert.equal(single('mean([1,2,3])'), '2');
  assert.equal(single('median(3,1,2)'), '2');
  assert.equal(single('max([1,5,3])'), '5');
});

test('factorial() function validates its argument like the ! operator', () => {
  assert.throws(() => calcSingle({ expression: 'factorial(-1)' }), /non-negative integer/);
  assert.throws(() => calcSingle({ expression: 'factorial(1.5)' }), /non-negative integer/);
  assert.equal(single('factorial(5)'), '120');
});

test('huge factorials return quickly instead of looping (DoS)', () => {
  const t = Date.now();
  assert.throws(() => calcSingle({ expression: '1e9!' }), /non-finite/);
  assert.throws(() => calcSingle({ expression: 'factorial(1e15)' }), /non-finite/);
  assert.ok(Date.now() - t < 200);
});

test('binom() on huge arguments does not loop (DoS)', () => {
  const t = Date.now();
  assert.throws(() => calcSingle({ expression: 'binom(1e12, 5e11)' }), /non-finite/);
  assert.equal(single('binom(50,25)'), '126410606437752');
  assert.ok(Date.now() - t < 200);
});

test('gamma(): correct near overflow and NaN at poles', () => {
  assert.equal(single('gamma(150)'), '3.808922638e+260');
  assert.equal(single('gamma(5)'), '24');
  assert.throws(() => calcSingle({ expression: 'gamma(-1)' }), /NaN/);
  assert.equal(single('gamma(0.5)^2'), single('pi'));
});

test('log with an explicit base', () => {
  assert.equal(single('log(8, 2)'), '3');
  assert.equal(single('log(100)'), '2');
});

test('matrix literal with ; row separator builds rows', () => {
  assert.deepEqual(evaluateExpr('[1,2;3,4]'), [[1, 2], [3, 4]]);
  assert.deepEqual(single('[[1,2],[3,4]]'), [['1', '2'], ['3', '4']]);
});

test('abs bars after a comma open a new absolute value', () => {
  assert.equal(single('max(1, |-3|)'), '3');
});

test('prototype names cannot reach JavaScript internals', () => {
  for (const expr of ['constructor', 'constructor(1)', '__proto__', 'toString()', 'hasOwnProperty(1)', 'valueOf']) {
    assert.throws(() => calcSingle({ expression: expr }), /Undefined variable|Unknown function/, expr);
  }
  assert.throws(() => calcSingle({ expression: 'x', variables: { __proto__: 1 } }), /Undefined variable|variable/);
});

test('variables are validated', () => {
  assert.throws(() => calcSingle({ expression: 'x+1', variables: { x: 'abc' } }), /finite number/);
  assert.throws(() => calcSingle({ expression: 'x+1', variables: [1] }), /object/);
  assert.equal(single('x+1', { variables: { x: 2 } }), '3');
});

test('non-string expressions are rejected clearly', () => {
  assert.throws(() => calcSingle({ expression: 5 }), /must be a string/);
  assert.throws(() => calcSingle({}), /must be a string/);
  assert.throws(() => calcSingle({ expression: '   ' }), /Empty expression/);
});

test('expression length and nesting depth are limited', () => {
  assert.throws(() => calcSingle({ expression: '1+'.repeat(20000) + '1' }), /too long/);
  assert.throws(() => calcSingle({ expression: '('.repeat(5000) + '1' + ')'.repeat(5000) }), /too deeply nested/);
  assert.throws(() => calcSingle({ expression: '2^'.repeat(3000) + '1' }), /too deeply nested/);
  assert.equal(single('('.repeat(100) + '1' + ')'.repeat(100)), '1');
});

test('precision is validated (significant digits)', () => {
  assert.equal(single('pi', { precision: 3 }), '3.14');
  assert.throws(() => calcSingle({ expression: 'pi', precision: 0 }), /precision/);
  assert.throws(() => calcSingle({ expression: 'pi', precision: -1 }), /precision/);
  assert.throws(() => calcSingle({ expression: 'pi', precision: 1.5 }), /precision/);
  assert.equal(single('pi', { precision: 50 }), String(Math.PI));
});

test('calc_batch validates its expressions argument', () => {
  assert.throws(() => calcBatch({ expressions: '1+1' }), /array/);
  assert.throws(() => calcBatch({ expressions: Array(101).fill('1') }), /Max 100/);
  const r = JSON.parse(calcBatch({ expressions: ['1+1', 42] }).content[0].text);
  assert.equal(r.batch[0].result, '2');
  assert.match(r.batch[1].error, /must be a string/);
});

test('arithmetic on arrays gives a clear error instead of string concatenation', () => {
  assert.throws(() => calcSingle({ expression: '[1,2]+1' }), /not supported on arrays/);
});

test('calc_simplify evaluates expressions that only use functions and constants', () => {
  const r = JSON.parse(calcSimplify({ expression: 'sin(pi/2)+sqrt(4)' }).content[0].text);
  assert.equal(r.simplified, '3');
  const free = JSON.parse(calcSimplify({ expression: '2*x+3' }).content[0].text);
  assert.match(free.error, /free symbols: x/);
  const sub = JSON.parse(calcSimplify({ expression: '2*x+3', substitutions: { x: 4 } }).content[0].text);
  assert.equal(sub.simplified, '11');
});

test('unicode operator aliases and ** are accepted', () => {
  assert.equal(single('2**3'), '8');
  assert.equal(single('6÷2×3'), '9');
  assert.equal(single('2π'), single('2*pi'));
});
