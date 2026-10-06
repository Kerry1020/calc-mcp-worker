import { Complex } from './complex.js';

function formatNumber(n, precision = 10) {
  if (n instanceof Complex) return n.toString();
  if (Array.isArray(n)) {
    if (Array.isArray(n[0])) return n.map(row => row.map(v => formatNumber(v, precision)));
    return n.map(v => formatNumber(v, precision));
  }
  if (typeof n !== 'number') return String(n);
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  if (Math.abs(n) < 1e-15) return '0';
  if (Math.abs(n) > 1e12 || Math.abs(n) < 1e-6) return n.toExponential(precision);
  return parseFloat(n.toPrecision(precision)).toString();
}

function toolResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export { formatNumber, toolResult };
