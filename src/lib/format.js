import { Complex } from './complex.js';

export const DEFAULT_PRECISION = 10;

/** Validate the optional `precision` (significant digits) argument. */
export function resolvePrecision(value) {
  if (value === undefined || value === null) return DEFAULT_PRECISION;
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error('precision must be an integer between 1 and 100');
  return Math.min(value, 17); // doubles carry at most 17 significant digits
}

function formatReal(n, precision) {
  if (Number.isNaN(n)) return 'NaN';
  if (n === Infinity) return 'Infinity';
  if (n === -Infinity) return '-Infinity';
  if (n === 0) return '0';
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  if (Math.abs(n) >= 1e12 || Math.abs(n) < 1e-6) {
    // Trim trailing zeros in the mantissa: 1.0000000000e-20 -> 1e-20
    return n.toExponential(precision - 1).replace(/\.?0+e/, 'e');
  }
  return parseFloat(n.toPrecision(precision)).toString();
}

function formatComplex(z, precision) {
  // Snap rounding noise (e.g. e^(i*pi)+1) relative to the magnitude of the number.
  const scale = Math.max(1, Math.abs(z.re), Math.abs(z.im));
  const re = Math.abs(z.re) < 1e-15 * scale ? 0 : z.re;
  const im = Math.abs(z.im) < 1e-15 * scale ? 0 : z.im;
  if (im === 0) return formatReal(re, precision);
  const imText = formatReal(im, precision);
  if (re === 0) return `${imText}i`;
  return `${formatReal(re, precision)}${im > 0 ? '+' : ''}${imText}i`;
}

/**
 * Format a computation result as a string (or nested arrays of strings).
 * `precision` is the number of significant digits.
 */
export function formatNumber(n, precision = DEFAULT_PRECISION) {
  if (n instanceof Complex) return formatComplex(n, precision);
  if (Array.isArray(n)) return n.map(v => formatNumber(v, precision));
  if (typeof n !== 'number') return String(n);
  return formatReal(n, precision);
}

/** Replace non-finite numbers (which JSON would silently turn into null) with strings. */
function jsonSafe(_key, value) {
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  return value;
}

export function toolResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, jsonSafe, 2) }] };
}

export function toolError(message) {
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }], isError: true };
}
