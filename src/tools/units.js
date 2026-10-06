// calc_constants, calc_convert, calc_base_convert
import { CONSTANTS } from '../lib/constants.js';
import { LIMITS, requireFiniteNumber, requireString } from '../lib/validate.js';
import { toolResult } from '../lib/format.js';

export function calcConstants(args) {
  const query = typeof args.query === 'string' ? args.query.toLowerCase() : '';
  const entries = Object.entries(CONSTANTS).filter(([k]) => !query || k.toLowerCase().includes(query));
  return toolResult({ constants: entries.map(([name, value]) => ({ name, value })), count: entries.length });
}

// Units grouped by dimension; factor converts the unit to the dimension's SI unit.
// Note: "nm" is the nautical mile (kept for backward compatibility), not the nanometre.
const UNIT_TABLE = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, um: 1e-6, inch: 0.0254, in: 0.0254, foot: 0.3048, ft: 0.3048, yard: 0.9144, yd: 0.9144, mile: 1609.344, mi: 1609.344, nm: 1852, nmi: 1852, au: 1.495978707e11, ly: 9.460730473e15, pc: 3.085677581e16, R_earth: 6.371e6 },
  mass: { kg: 1, g: 0.001, mg: 1e-6, ton: 1000, t: 1000, lb: 0.45359237, lbs: 0.45359237, oz: 0.028349523125, u: 1.66053906660e-27, M_sun: 1.98847e30, M_earth: 5.9722e24 },
  pressure: { Pa: 1, kPa: 1000, MPa: 1e6, bar: 1e5, atm: 101325, psi: 6894.757293168, mmHg: 133.322387415, torr: 101325 / 760 },
  energy: { J: 1, kJ: 1000, MJ: 1e6, Wh: 3600, kWh: 3.6e6, cal: 4.184, kcal: 4184, BTU: 1055.06, eV: 1.602176634e-19 },
  power: { W: 1, kW: 1000, MW: 1e6, hp: 745.7 },
  frequency: { Hz: 1, kHz: 1000, MHz: 1e6, GHz: 1e9 },
  speed: { 'm/s': 1, mps: 1, 'km/h': 1000 / 3600, kph: 1000 / 3600, mph: 0.44704, knot: 1852 / 3600 },
  volume: { m3: 1, liter: 0.001, L: 0.001, mL: 1e-6, gallon: 0.003785411784 },
  time: { s: 1, ms: 0.001, min: 60, hour: 3600, hr: 3600, day: 86400, week: 604800 },
};

const UNITS = new Map();
for (const [dimension, table] of Object.entries(UNIT_TABLE)) {
  for (const [name, factor] of Object.entries(table)) UNITS.set(name, { name, dimension, factor });
}
const TEMPERATURE = { c: 'C', celsius: 'C', f: 'F', fahrenheit: 'F', k: 'K', kelvin: 'K' };

function resolveUnit(raw, label) {
  const text = requireString(raw, label, 64).trim();
  const temp = TEMPERATURE[text.toLowerCase()];
  if (temp) return { name: temp, dimension: 'temperature' };
  if (UNITS.has(text)) return UNITS.get(text);
  // Case-insensitive fallback, only when unambiguous (so "kpa" -> kPa, "kwh" -> kWh).
  const matches = [...UNITS.values()].filter(u => u.name.toLowerCase() === text.toLowerCase());
  if (matches.length === 1) return matches[0];
  throw new Error(`Unknown unit: ${text}. Supported units: ${[...UNITS.keys(), 'C', 'F', 'K'].join(', ')}`);
}

function toCelsius(v, unit) { return unit === 'C' ? v : unit === 'F' ? (v - 32) * 5 / 9 : v - 273.15; }
function fromCelsius(c, unit) { return unit === 'C' ? c : unit === 'F' ? c * 9 / 5 + 32 : c + 273.15; }

export function calcConvert(args) {
  const value = requireFiniteNumber(args.value, 'value');
  const from = resolveUnit(args.from, 'from');
  const to = resolveUnit(args.to, 'to');
  if (from.dimension !== to.dimension) {
    throw new Error(`Cannot convert ${from.name} (${from.dimension}) to ${to.name} (${to.dimension})`);
  }
  const result = from.dimension === 'temperature'
    ? fromCelsius(toCelsius(value, from.name), to.name)
    : value * from.factor / to.factor;
  return toolResult({ value, from: from.name, to: to.name, dimension: from.dimension, result });
}

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const PREFIXES = { 16: '0x', 8: '0o', 2: '0b' };

function requireBase(value, label) {
  if (value === undefined || value === null) return 10;
  if (!Number.isInteger(value) || value < 2 || value > 36) throw new Error(`${label} must be an integer between 2 and 36`);
  return value;
}

export function calcBaseConvert(args) {
  const fromBase = requireBase(args.from_base, 'from_base');
  const toBase = requireBase(args.to_base, 'to_base');
  const input = typeof args.value === 'number' ? String(args.value) : requireString(args.value, 'value', LIMITS.MAX_BASE_DIGITS);
  let text = input.trim().toLowerCase().replace(/_/g, '');
  let negative = false;
  if (text.startsWith('-') || text.startsWith('+')) { negative = text[0] === '-'; text = text.slice(1); }
  if (PREFIXES[fromBase] && text.startsWith(PREFIXES[fromBase])) text = text.slice(2);
  if (!text) throw new Error(`Invalid number "${input}" in base ${fromBase}`);
  // Exact arbitrary-precision integer conversion.
  const big = BigInt(fromBase);
  let n = 0n;
  for (const ch of text) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= fromBase) throw new Error(`Invalid number "${input}" in base ${fromBase}`);
    n = n * big + BigInt(d);
  }
  if (negative) n = -n;
  const result = n.toString(toBase).toUpperCase();
  const decimal = n >= BigInt(Number.MIN_SAFE_INTEGER) && n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : n.toString();
  return toolResult({ value: args.value, from_base: fromBase, to_base: toBase, result, decimal });
}
