// Regression tests for matrix, unit, base-conversion and prime tools.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calcMatrix } from '../src/tools/matrix.js';
import { calcConvert, calcBaseConvert } from '../src/tools/units.js';
import { calcPrime } from '../src/tools/primes.js';

const out = (r) => JSON.parse(r.content[0].text);

test('eigen: sign of the dominant eigenvalue is preserved', () => {
  const r = out(calcMatrix({ operation: 'eigen', matrix: '[[-3,0],[0,1]]' }));
  assert.ok(Math.abs(r.largest_eigenvalue + 3) < 1e-9, String(r.largest_eigenvalue));
  assert.equal(r.converged, true);
});

test('eigen: start vector orthogonal to all-ones still finds the dominant eigenvalue', () => {
  // eigenvalues 4 (eigvec [1,-1]) and -2 (eigvec [1,1])
  const r = out(calcMatrix({ operation: 'eigen', matrix: '[[1,-3],[-3,1]]' }));
  assert.ok(Math.abs(r.largest_eigenvalue - 4) < 1e-9, String(r.largest_eigenvalue));
});

test('eigen: rotation matrix reports non-convergence', () => {
  const r = out(calcMatrix({ operation: 'eigen', matrix: '[[0,-1],[1,0]]' }));
  assert.equal(r.converged, false);
  assert.match(r.warning, /did not converge/);
});

test('det of large matrices is O(n^3) (cofactor expansion was O(n!))', () => {
  const n = 40;
  const m = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 2 : 0)));
  const t = Date.now();
  const r = out(calcMatrix({ operation: 'det', matrix: JSON.stringify(m) }));
  assert.equal(r.result, String(2 ** 40));
  assert.ok(Date.now() - t < 500);
  assert.equal(out(calcMatrix({ operation: 'det', matrix: '[[1,2,3,4],[5,6,7,8],[2,6,4,8],[3,1,1,2]]' })).result, '72');
});

test('matrix input is validated (ragged, non-square, dimension mismatch, size)', () => {
  assert.throws(() => calcMatrix({ operation: 'det', matrix: '[[1,2],[3]]' }), /rectangular/);
  assert.throws(() => calcMatrix({ operation: 'det', matrix: '[[1,2,3],[4,5,6]]' }), /square/);
  assert.throws(() => calcMatrix({ operation: 'add', matrix: '[[1,2]]', matrix_b: '[[1,2],[3,4]]' }), /same size/);
  assert.throws(() => calcMatrix({ operation: 'mul', matrix: '[[1,2]]', matrix_b: '[[1,2]]' }), /columns of A/);
  assert.throws(() => calcMatrix({ operation: 'det', matrix: '[[1,i],[0,1]]' }), /finite real/);
  const huge = JSON.stringify([Array(101).fill(1)]);
  assert.throws(() => calcMatrix({ operation: 'transpose', matrix: huge }), /too large/);
});

test('matrix accepts JSON arrays and [a,b;c,d] syntax', () => {
  assert.deepEqual(out(calcMatrix({ operation: 'transpose', matrix: [[1, 2], [3, 4]] })).result, [['1', '3'], ['2', '4']]);
  assert.equal(out(calcMatrix({ operation: 'det', matrix: '[1,2;3,4]' })).result, '-2');
});

test('inverse uses a scale-relative singularity test', () => {
  const r = out(calcMatrix({ operation: 'inv', matrix: '[[1e-13,0],[0,1e-13]]' }));
  assert.deepEqual(r.result, [['10000000000000', '0'], ['0', '10000000000000']]);
  assert.throws(() => calcMatrix({ operation: 'inv', matrix: '[[1,2],[2,4]]' }), /singular/);
});

test('convert: units with capital letters work (were lowercased and never found)', () => {
  assert.equal(out(calcConvert({ value: 1, from: 'kWh', to: 'J' })).result, 3.6e6);
  assert.equal(out(calcConvert({ value: 1, from: 'MPa', to: 'kPa' })).result, 1000);
  assert.equal(out(calcConvert({ value: 1, from: 'kwh', to: 'kj' })).result, 3600);
  assert.equal(out(calcConvert({ value: 500, from: 'mL', to: 'L' })).result, 0.5);
});

test('convert: incompatible dimensions are rejected (km -> kg returned 1000)', () => {
  assert.throws(() => calcConvert({ value: 1, from: 'km', to: 'kg' }), /Cannot convert km \(length\) to kg \(mass\)/);
  assert.throws(() => calcConvert({ value: 1, from: 'C', to: 'm' }), /Cannot convert/);
  assert.throws(() => calcConvert({ value: 1, from: 'furlong', to: 'm' }), /Unknown unit/);
});

test('convert: temperature and exact speed factors', () => {
  assert.equal(out(calcConvert({ value: 100, from: 'C', to: 'F' })).result, 212);
  assert.equal(out(calcConvert({ value: 0, from: 'celsius', to: 'K' })).result, 273.15);
  assert.equal(out(calcConvert({ value: 36, from: 'kph', to: 'm/s' })).result, 10);
  assert.throws(() => calcConvert({ value: 'x', from: 'm', to: 'km' }), /finite number/);
});

test('base convert: strict parsing (parseInt silently accepted "12z")', () => {
  assert.throws(() => calcBaseConvert({ value: '12z', from_base: 10 }), /Invalid number/);
  assert.throws(() => calcBaseConvert({ value: '1.5' }), /Invalid number/);
  assert.equal(out(calcBaseConvert({ value: '255', to_base: 16 })).result, 'FF');
  assert.equal(out(calcBaseConvert({ value: '0xff', from_base: 16 })).decimal, 255);
  assert.equal(out(calcBaseConvert({ value: '-101', from_base: 2 })).decimal, -5);
});

test('base convert: exact beyond 2^53 and validates bases', () => {
  const r = out(calcBaseConvert({ value: 'ffffffffffffffffff', from_base: 16 }));
  assert.equal(r.result, '4722366482869645213695');
  assert.throws(() => calcBaseConvert({ value: '1', to_base: 37 }), /between 2 and 36/);
  assert.throws(() => calcBaseConvert({ value: '1'.repeat(2000), from_base: 2 }), /too long/);
});

test('primes: correct and fast for large safe integers', () => {
  const t = Date.now();
  assert.equal(out(calcPrime({ operation: 'is_prime', n: 9007199254740881 })).is_prime, true);
  assert.equal(out(calcPrime({ operation: 'is_prime', n: 9007199254740991 })).is_prime, false);
  assert.deepEqual(out(calcPrime({ operation: 'factorize', n: 9007199254740991 })).factors, [6361, 69431, 20394401]);
  // semiprime with two ~9.5e7 prime factors (plain trial division needs ~3e7 steps)
  assert.deepEqual(out(calcPrime({ operation: 'factorize', n: 94906213 * 94906219 })).factors, [94906213, 94906219]);
  assert.deepEqual(out(calcPrime({ operation: 'factorize', n: 84 })).factors, [2, 2, 3, 7]);
  assert.ok(Date.now() - t < 2000);
});

test('primes: bounded operations (DoS)', () => {
  assert.throws(() => calcPrime({ operation: 'nth_prime', n: 1e9 }), /between/);
  assert.throws(() => calcPrime({ operation: 'prime_count', n: 1e12 }), /up to/);
  assert.throws(() => calcPrime({ operation: 'primes_in_range', n: 0, b: 1e9 }), /width/);
  assert.throws(() => calcPrime({ operation: 'is_prime', n: 1.5 }), /integer/);
  assert.throws(() => calcPrime({ operation: 'is_prime', n: 2 ** 60 }), /between/);
});

test('primes: sieve-based results', () => {
  assert.equal(out(calcPrime({ operation: 'nth_prime', n: 1000000 })).prime, 15485863);
  assert.equal(out(calcPrime({ operation: 'prime_count', n: 1000000 })).pi_n, 78498);
  assert.deepEqual(out(calcPrime({ operation: 'primes_in_range', n: 10, b: 30 })).primes, [11, 13, 17, 19, 23, 29]);
  assert.equal(out(calcPrime({ operation: 'primes_in_range', n: 1e12 - 100, b: 1e12 })).count, 4);
  assert.equal(out(calcPrime({ operation: 'next_prime', n: 13 })).next_prime, 17);
  assert.equal(out(calcPrime({ operation: 'prev_prime', n: 2 })).prev_prime, null);
});
