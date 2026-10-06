// calc_batch, calc_single, calc_simplify
import { Complex } from '../lib/complex.js';
import { evaluateExpr, freeIdentifiers } from '../lib/expression.js';
import { LIMITS, assertFiniteComputation, requireString, requireVariables } from '../lib/validate.js';
import { formatNumber, resolvePrecision, toolResult } from '../lib/format.js';

function valueType(val) {
  if (val instanceof Complex) return 'complex';
  if (Array.isArray(val)) return Array.isArray(val[0]) ? 'matrix' : 'array';
  return typeof val;
}

export function calcBatch(args) {
  const exprs = args.expressions;
  if (!Array.isArray(exprs)) throw new Error('expressions must be an array of strings');
  if (exprs.length > LIMITS.MAX_BATCH) throw new Error(`Max ${LIMITS.MAX_BATCH} expressions per batch`);
  const precision = resolvePrecision(args.precision);
  const vars = requireVariables(args.variables);
  const results = exprs.map(expr => {
    try {
      requireString(expr, 'expression');
      const val = assertFiniteComputation(evaluateExpr(expr, vars), `Expression ${expr}`);
      return { expression: expr, result: formatNumber(val, precision), error: null };
    } catch (e) {
      return { expression: expr, result: null, error: e.message };
    }
  });
  return toolResult({ batch: results, count: results.length });
}

export function calcSingle(args) {
  const expression = requireString(args.expression, 'expression');
  const precision = resolvePrecision(args.precision);
  const vars = requireVariables(args.variables);
  const val = assertFiniteComputation(evaluateExpr(expression, vars), `Expression ${expression}`);
  return toolResult({ expression, result: formatNumber(val, precision), type: valueType(val) });
}

export function calcSimplify(args) {
  const expression = requireString(args.expression, 'expression');
  const vars = requireVariables(args.substitutions, 'substitutions');
  const operation = args.operation ?? 'evaluate';
  if (!['evaluate', 'expand', 'substitute'].includes(operation)) throw new Error(`Unknown operation: ${operation}`);
  if (operation !== 'evaluate') {
    return toolResult({ expression, operation, error: `Operation ${operation} is not supported without a symbolic algebra engine` });
  }
  try {
    const free = freeIdentifiers(expression, vars);
    if (free.length) {
      return toolResult({ expression, operation, error: `Free-symbol simplification is not supported (free symbols: ${free.join(', ')}); provide substitutions or use evaluate-only inputs` });
    }
    const val = assertFiniteComputation(evaluateExpr(expression, vars), `Expression ${expression}`);
    return toolResult({ expression, operation, simplified: formatNumber(val), substitutions: vars });
  } catch (e) {
    return toolResult({ expression, operation, error: e.message });
  }
}
