import { Complex } from '../lib/complex.js';
import { evaluateExpr } from '../lib/expression.js';
import { assertFiniteComputation } from '../lib/validate.js';
import { formatNumber, toolResult } from '../lib/format.js';

function calcBatch(args) {
  const exprs = args.expressions || [];
  if (exprs.length > 100) throw new Error("Max 100 expressions per batch");
  const precision = args.precision || 10;
  const vars = args.variables || {};
  const results = exprs.map(expr => {
    try {
      const val = assertFiniteComputation(evaluateExpr(expr, vars), `Expression ${expr}`);
      return { expression: expr, result: formatNumber(val, precision), error: null };
    } catch (e) {
      return { expression: expr, result: null, error: e.message };
    }
  });
  return toolResult({ batch: results, count: results.length });
}

function calcSingle(args) {
  const precision = args.precision || 10;
  const vars = args.variables || {};
  const val = assertFiniteComputation(evaluateExpr(args.expression, vars), `Expression ${args.expression}`);
  return toolResult({ expression: args.expression, result: formatNumber(val, precision), type: typeof val === 'object' && val instanceof Complex ? 'complex' : typeof val });
}

function calcSimplify(args) {
  const vars = args.substitutions || {};
  const operation = args.operation || "evaluate";
  const hasFreeSymbol = /[a-zA-Z_][a-zA-Z0-9_]*/.test(args.expression) && Object.keys(vars).length === 0;
  if (operation !== "evaluate") {
    return toolResult({ expression: args.expression, operation, error: `Operation ${operation} is not supported without a symbolic algebra engine` });
  }
  if (hasFreeSymbol) {
    return toolResult({ expression: args.expression, operation, error: "Free-symbol simplification is not supported; provide substitutions or use evaluate-only inputs" });
  }
  try {
    const val = evaluateExpr(args.expression, vars);
    return toolResult({ expression: args.expression, operation, simplified: formatNumber(val), substitutions: vars });
  } catch (e) {
    return toolResult({ expression: args.expression, operation, error: e.message });
  }
}

export { calcBatch, calcSingle, calcSimplify };
