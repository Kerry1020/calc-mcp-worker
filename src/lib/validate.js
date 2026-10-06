import { Complex } from './complex.js';

function requireField(obj, field, context) {
  if (obj[field] === undefined || obj[field] === null) throw new Error(`${context} requires ${field}`);
  return obj[field];
}

function requireArrayField(obj, field, context, minLength = 1) {
  const value = requireField(obj, field, context);
  if (!Array.isArray(value) || value.length < minLength) throw new Error(`${context} requires ${field} as an array with at least ${minLength} value${minLength === 1 ? '' : 's'}`);
  return value;
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
  return value;
}

function assertFiniteNumber(value, context) {
  if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`${context} produced NaN`);
  if (!Number.isFinite(value)) throw new Error(`${context} produced a non-finite result`);
  return value;
}

function assertFiniteComputation(value, context) {
  if (value instanceof Complex) {
    assertFiniteNumber(value.re, `${context} real part`);
    assertFiniteNumber(value.im, `${context} imaginary part`);
    return value;
  }
  return assertFiniteNumber(value, context);
}

export { requireField, requireArrayField, requirePositiveInteger, assertFiniteNumber, assertFiniteComputation };
