// calc_derivative, calc_integral, calc_double_integral, calc_solve, calc_series,
// calc_limit, calc_taylor, calc_ode, calc_plot_data
import { compile, compileRealFunction } from '../lib/expression.js';
import { taylorCoefficients } from '../lib/taylor.js';
import {
  LIMITS, assertFiniteNumber, assertWorkBudget, optionalInteger, optionalNumber,
  requireFiniteNumber, requireString, requireVariables,
} from '../lib/validate.js';
import { formatNumber, toolResult } from '../lib/format.js';
import {
  numericalDerivative, numericalIntegral, numericalIntegral2D, newtonMethod, bisectionMethod,
  seriesSum, limitExpr, eulerMethod, rungeKutta4,
} from '../lib/numeric.js';

const fn = (args, argNames, varsKey = 'variables') =>
  compileRealFunction(requireString(args.expression, 'expression'), argNames, requireVariables(args[varsKey]));

export function calcDerivative(args) {
  const point = requireFiniteNumber(args.point, 'point');
  const f = fn(args, ['x']);
  try {
    const result = numericalDerivative(f, point);
    return toolResult({ expression: `d/dx [${args.expression}]`, at: `x = ${point}`, derivative: formatNumber(result) });
  } catch (e) {
    return toolResult({ expression: `d/dx [${args.expression}]`, at: `x = ${point}`, error: e.message });
  }
}

export function calcIntegral(args) {
  const a = requireFiniteNumber(args.a, 'a');
  const b = requireFiniteNumber(args.b, 'b');
  const n = optionalInteger(args.n, 'n', 10000, 2, LIMITS.MAX_INTEGRAL_N);
  const f = fn(args, ['x']);
  assertWorkBudget(f.nodeCount, n + 1, 'Integral');
  const result = numericalIntegral(f, a, b, n);
  return toolResult({ expression: `∫[${a},${b}] ${args.expression} dx`, result: formatNumber(result.value), method: "Simpson's rule", subdivisions: result.n });
}

export function calcDoubleIntegral(args) {
  const xa = requireFiniteNumber(args.xa, 'xa'), xb = requireFiniteNumber(args.xb, 'xb');
  const ya = requireFiniteNumber(args.ya, 'ya'), yb = requireFiniteNumber(args.yb, 'yb');
  const n = optionalInteger(args.n, 'n', 50, 2, LIMITS.MAX_DOUBLE_INTEGRAL_N);
  const f = fn(args, ['x', 'y']);
  assertWorkBudget(f.nodeCount, (n + 1) * (n + 1), 'Double integral');
  const result = numericalIntegral2D(f, xa, xb, ya, yb, n);
  return toolResult({ expression: `∬[${xa},${xb}]×[${ya},${yb}] ${args.expression} dxdy`, result: formatNumber(result.value), subdivisions_per_axis: result.n });
}

export function calcSolve(args) {
  const method = args.method ?? 'newton';
  if (method !== 'newton' && method !== 'bisection') throw new Error(`Unknown method: ${method}`);
  const tol = args.tol === undefined || args.tol === null ? 1e-12 : requireFiniteNumber(args.tol, 'tol');
  if (tol < 0) throw new Error('tol must be non-negative');
  const maxIter = optionalInteger(args.max_iter, 'max_iter', 100, 1, LIMITS.MAX_SOLVER_ITERATIONS);
  const f = fn(args, ['x']);
  // Newton costs ~7 evaluations per iteration (value + derivative).
  assertWorkBudget(f.nodeCount, maxIter * 7, 'Solver');
  let result;
  try {
    if (method === 'bisection') {
      if (args.a === undefined || args.b === undefined) throw new Error('Bisection requires a and b bounds');
      result = bisectionMethod(f, requireFiniteNumber(args.a, 'a'), requireFiniteNumber(args.b, 'b'), tol, maxIter);
    } else {
      result = newtonMethod(f, optionalNumber(args.initial_guess, 'initial_guess', 1), tol, maxIter);
    }
  } catch (e) {
    result = { root: null, converged: false, error: e.message };
  }
  return toolResult({ expression: `${args.expression} = 0`, method, ...result });
}

export function calcSeries(args) {
  const variable = args.variable ?? 'n';
  if (typeof variable !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable)) throw new Error('variable must be an identifier');
  const nStart = optionalInteger(args.n_start, 'n_start', 1);
  const nEnd = optionalInteger(args.n_end, 'n_end', undefined);
  if (nEnd === undefined) throw new Error('n_end is required');
  const terms = nEnd - nStart + 1;
  if (terms > LIMITS.MAX_SERIES_TERMS) throw new Error(`Series has too many terms (max ${LIMITS.MAX_SERIES_TERMS})`);
  const f = fn(args, [variable]);
  assertWorkBudget(f.nodeCount, Math.max(0, terms), 'Series');
  const result = seriesSum(f, nStart, nEnd);
  return toolResult({ expression: `∑(${variable}=${nStart} to ${nEnd}) ${args.expression}`, ...result });
}

export function calcLimit(args) {
  const approach = requireFiniteNumber(args.approach, 'approach');
  const direction = args.direction ?? 'both';
  if (!['both', 'left', 'right'].includes(direction)) throw new Error('direction must be both, left or right');
  const f = fn(args, ['x']);
  const result = limitExpr(f, approach, direction);
  for (const key of ['from_left', 'from_right', 'limit']) {
    if (result[key] !== undefined && result[key] !== null) result[key] = formatNumber(result[key]);
  }
  return toolResult({ expression: `lim(x→${approach}) ${args.expression}`, ...result });
}

function polynomialString(coeffs, x0) {
  const base = x0 === 0 ? '(x-0)' : x0 < 0 ? `(x+${-x0})` : `(x-${x0})`;
  return coeffs.map((c, n) => `${c}*${base}^${n}`).join(' + ').replace(/\+ -/g, '- ');
}

export function calcTaylor(args) {
  const x0 = optionalNumber(args.x0, 'x0', 0);
  const order = optionalInteger(args.order, 'order', 5, 0, LIMITS.MAX_TAYLOR_ORDER);
  const vars = requireVariables(args.variables);
  const { ast } = compile(requireString(args.expression, 'expression'), ['x', ...Object.keys(vars)]);
  const coefficients = taylorCoefficients(ast, x0, order, vars);
  return toolResult({
    expression: `Taylor expansion of ${args.expression}`,
    x0, order, coefficients,
    polynomial: polynomialString(coefficients, x0),
    method: 'automatic differentiation (Taylor mode)',
  });
}

export function calcOde(args) {
  const method = args.method ?? 'rk4';
  if (method !== 'rk4' && method !== 'euler') throw new Error('method must be euler or rk4');
  const x0 = requireFiniteNumber(args.x0, 'x0');
  const y0 = requireFiniteNumber(args.y0, 'y0');
  const xEnd = requireFiniteNumber(args.x_end, 'x_end');
  const steps = optionalInteger(args.steps, 'steps', 100, 1, LIMITS.MAX_ODE_STEPS);
  const f = fn(args, ['x', 'y']);
  assertWorkBudget(f.nodeCount, steps * (method === 'rk4' ? 4 : 1), 'ODE');
  const result = method === 'euler' ? eulerMethod(f, x0, y0, xEnd, steps) : rungeKutta4(f, x0, y0, xEnd, steps);
  result.points.forEach(point => {
    assertFiniteNumber(point.x, 'ODE x');
    assertFiniteNumber(point.y, 'ODE y');
  });
  const stride = Math.max(1, Math.floor(result.points.length / 50));
  result.points = result.points.filter((_, i) => i % stride === 0 || i === result.points.length - 1);
  return toolResult({ expression: `dy/dx = ${args.expression}`, ...result });
}

export function calcPlotData(args) {
  const xMin = requireFiniteNumber(args.x_min, 'x_min');
  const xMax = requireFiniteNumber(args.x_max, 'x_max');
  const nPoints = optionalInteger(args.points, 'points', 100, 1, LIMITS.MAX_PLOT_POINTS);
  const f = fn(args, ['x']);
  assertWorkBudget(f.nodeCount, nPoints, 'Plot');
  const dx = nPoints > 1 ? (xMax - xMin) / (nPoints - 1) : 0;
  const xVals = [], yVals = [];
  for (let i = 0; i < nPoints; i++) {
    const x = xMin + i * dx;
    const y = f(x);
    xVals.push(parseFloat(x.toPrecision(6)));
    yVals.push(Number.isFinite(y) ? parseFloat(y.toPrecision(8)) : null);
  }
  return toolResult({ expression: args.expression, x_range: [xMin, xMax], points: nPoints, x: xVals, y: yVals });
}
