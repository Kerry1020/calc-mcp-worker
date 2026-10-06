// Input validation helpers and resource limits.
//
// Every tool argument comes from an untrusted client, so all loops and
// allocations are bounded by the limits below.
import { Complex } from './complex.js';

export const LIMITS = Object.freeze({
  MAX_EXPRESSION_LENGTH: 20000,   // characters per expression string
  MAX_AST_DEPTH: 1000,            // nesting depth of a parsed expression
  MAX_BATCH: 100,                 // expressions per calc_batch call
  MAX_VARIABLES: 100,             // entries in a variables/substitutions object
  MAX_WORK: 5e7,                  // AST node evaluations per numerical tool call
  MAX_INTEGRAL_N: 1e6,            // Simpson subdivisions (1-D)
  MAX_DOUBLE_INTEGRAL_N: 2000,    // Simpson subdivisions per axis (2-D)
  MAX_SERIES_TERMS: 1e6,
  MAX_ODE_STEPS: 1e5,
  MAX_PLOT_POINTS: 10000,
  MAX_SOLVER_ITERATIONS: 10000,
  MAX_TAYLOR_ORDER: 50,
  MAX_DATA_POINTS: 100000,        // array arguments (data, x, y, groups...)
  MAX_KENDALL_POINTS: 5000,       // O(n^2) algorithm
  MAX_MATRIX_DIM: 100,
  MAX_SAMPLE_SIZE: 10000,
  MAX_BASE_DIGITS: 1000,
  MAX_PRIME_SIEVE: 1e7,           // prime_count upper bound
  MAX_NTH_PRIME: 1e6,
  MAX_PRIME_RANGE: 1e5,           // width of primes_in_range
});

export function requireField(obj, field, context) {
  if (obj[field] === undefined || obj[field] === null) throw new Error(`${context} requires ${field}`);
  return obj[field];
}

export function requireArrayField(obj, field, context, minLength = 1) {
  const value = requireField(obj, field, context);
  if (!Array.isArray(value) || value.length < minLength) throw new Error(`${context} requires ${field} as an array with at least ${minLength} value${minLength === 1 ? '' : 's'}`);
  return value;
}

export function requirePositiveInteger(value, label, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
  if (value > max) throw new Error(`${label} must be at most ${max}`);
  return value;
}

export function requireInteger(value, label, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer`);
  if (value < min || value > max) throw new Error(`${label} must be between ${min} and ${max}`);
  return value;
}

export function requireFiniteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
  return value;
}

export function requirePositiveNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive finite number`);
  return value;
}

export function requireProbability(value, label, { open = false } = {}) {
  const ok = typeof value === 'number' && (open ? value > 0 && value < 1 : value >= 0 && value <= 1);
  if (!ok) throw new Error(`${label} must be a number in ${open ? '(0, 1)' : '[0, 1]'}`);
  return value;
}

export function requireString(value, label, maxLength = LIMITS.MAX_EXPRESSION_LENGTH) {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  if (value.length > maxLength) throw new Error(`${label} is too long (max ${maxLength} characters)`);
  return value;
}

/** Validate an array of finite numbers. */
export function requireNumberArray(value, label, { min = 1, max = LIMITS.MAX_DATA_POINTS } = {}) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of numbers`);
  if (value.length < min) throw new Error(`${label} requires at least ${min} value${min === 1 ? '' : 's'}`);
  if (value.length > max) throw new Error(`${label} has too many values (max ${max})`);
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'number' || !Number.isFinite(value[i])) throw new Error(`${label}[${i}] must be a finite number`);
  }
  return value;
}

/** Validate a variables / substitutions object: identifier keys, finite numeric values. */
export function requireVariables(value, label = 'variables') {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object mapping names to numbers`);
  const keys = Object.keys(value);
  if (keys.length > LIMITS.MAX_VARIABLES) throw new Error(`${label} has too many entries (max ${LIMITS.MAX_VARIABLES})`);
  const out = Object.create(null);
  for (const key of keys) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`${label}: invalid variable name "${key}"`);
    const v = value[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${label}.${key} must be a finite number`);
    out[key] = v;
  }
  return out;
}

/** Optional integer argument with default and bounds. */
export function optionalInteger(value, label, defaultValue, min, max) {
  if (value === undefined || value === null) return defaultValue;
  return requireInteger(value, label, min, max);
}

/** Optional finite-number argument with default. */
export function optionalNumber(value, label, defaultValue) {
  if (value === undefined || value === null) return defaultValue;
  return requireFiniteNumber(value, label);
}

export function assertFiniteNumber(value, context) {
  if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`${context} produced NaN`);
  if (!Number.isFinite(value)) throw new Error(`${context} produced a non-finite result`);
  return value;
}

export function assertFiniteComputation(value, context) {
  if (value instanceof Complex) {
    assertFiniteNumber(value.re, `${context} real part`);
    assertFiniteNumber(value.im, `${context} imaginary part`);
    return value;
  }
  if (Array.isArray(value)) {
    for (const v of value) assertFiniteComputation(v, context);
    return value;
  }
  return assertFiniteNumber(value, context);
}

/** Reject numerical jobs whose total cost (AST nodes x evaluations) exceeds the work budget. */
export function assertWorkBudget(nodeCount, evaluations, context) {
  if (nodeCount * evaluations > LIMITS.MAX_WORK) {
    throw new Error(`${context} is too expensive (${evaluations} evaluations of a ${nodeCount}-node expression exceeds the work limit); reduce the number of points/steps or simplify the expression`);
  }
}
