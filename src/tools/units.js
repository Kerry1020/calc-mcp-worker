import { CONSTANTS } from '../lib/constants.js';
import { toolResult } from '../lib/format.js';

function calcConstants(args) {
  const query = (args.query || "").toLowerCase();
  const entries = Object.entries(CONSTANTS).filter(([k]) => !query || k.toLowerCase().includes(query));
  return toolResult({ constants: entries.map(([name, value]) => ({ name, value })), count: entries.length });
}

function calcConvert(args) {
  const fromVal = args.value;
  const from = args.from.toLowerCase();
  const to = args.to.toLowerCase();

  // Temperature special case
  if (['c','f','k'].includes(from) && ['c','f','k'].includes(to)) {
    let celsius;
    if (from === 'c') celsius = fromVal;
    else if (from === 'f') celsius = (fromVal - 32) * 5/9;
    else celsius = fromVal - 273.15;
    if (to === 'c') return toolResult({ value: fromVal, from, to, result: celsius });
    if (to === 'f') return toolResult({ value: fromVal, from, to, result: celsius * 9/5 + 32 });
    return toolResult({ value: fromVal, from, to, result: celsius + 273.15 });
  }

  if (CONSTANTS[from] && CONSTANTS[to]) {
    const result = fromVal * CONSTANTS[from] / CONSTANTS[to];
    return toolResult({ value: fromVal, from, to, result });
  }
  throw new Error(`Unknown unit conversion: ${from} -> ${to}. Check calc_constants for available units.`);
}

function calcBaseConvert(args) {
  const fromBase = args.from_base || 10;
  const toBase = args.to_base || 10;
  const decimal = parseInt(args.value, fromBase);
  if (isNaN(decimal)) throw new Error(`Invalid number "${args.value}" in base ${fromBase}`);
  const result = decimal.toString(toBase).toUpperCase();
  return toolResult({ value: args.value, from_base: fromBase, to_base: toBase, result, decimal });
}

export { calcConstants, calcConvert, calcBaseConvert };
