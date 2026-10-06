import { assertFiniteNumber } from '../lib/validate.js';
import { safeNullableEval } from '../lib/expression.js';
import { formatNumber, toolResult } from '../lib/format.js';
import { numericalDerivative, numericalIntegral, numericalIntegral2D, newtonMethod, bisectionMethod, seriesSum, limitExpr, taylorSeries, eulerMethod, rungeKutta4 } from '../lib/numeric.js';

function calcDerivative(args) {
  const vars = args.variables || {};
  try {
    const result = numericalDerivative(args.expression, args.point, vars);
    return toolResult({ expression: `d/dx [${args.expression}]`, at: `x = ${args.point}`, derivative: formatNumber(result) });
  } catch (e) {
    return toolResult({ expression: `d/dx [${args.expression}]`, at: `x = ${args.point}`, error: e.message });
  }
}

function calcIntegral(args) {
  const vars = args.variables || {};
  const n = args.n || 10000;
  const result = numericalIntegral(args.expression, args.a, args.b, vars, n);
  return toolResult({ expression: `∫[${args.a},${args.b}] ${args.expression} dx`, result: formatNumber(result), method: "Simpson's rule", subdivisions: n });
}

function calcDoubleIntegral(args) {
  const n = args.n || 50;
  const result = numericalIntegral2D(args.expression, args.xa, args.xb, args.ya, args.yb, {}, n);
  return toolResult({ expression: `∬[${args.xa},${args.xb}]×[${args.ya},${args.yb}] ${args.expression} dxdy`, result: formatNumber(result), subdivisions_per_axis: n });
}

function calcSolve(args) {
  const vars = args.variables || {};
  const method = args.method || "newton";
  let result;
  try {
    if (method === "bisection") {
      if (args.a === undefined || args.b === undefined) throw new Error("Bisection requires a and b bounds");
      result = bisectionMethod(args.expression, args.a, args.b, vars, args.tol);
    } else {
      const x0 = args.initial_guess !== undefined ? args.initial_guess : 1;
      result = newtonMethod(args.expression, x0, vars, args.tol, args.max_iter);
    }
  } catch (e) {
    result = { root: null, converged: false, error: e.message };
  }
  return toolResult({ expression: `${args.expression} = 0`, method, ...result });
}

function calcSeries(args) {
  const nStart = args.n_start || 1;
  const variable = args.variable || "n";
  const result = seriesSum(args.expression, nStart, args.n_end, variable);
  return toolResult({ expression: `∑(${variable}=${nStart} to ${args.n_end}) ${args.expression}`, ...result });
}

function calcLimit(args) {
  const result = limitExpr(args.expression, args.approach, args.direction || "both");
  if (result.from_left !== undefined && result.from_left !== null) result.from_left = formatNumber(result.from_left);
  if (result.from_right !== undefined && result.from_right !== null) result.from_right = formatNumber(result.from_right);
  if (result.limit !== undefined && result.limit !== null) result.limit = formatNumber(result.limit);
  return toolResult({ expression: `lim(x→${args.approach}) ${args.expression}`, ...result });
}

function calcTaylor(args) {
  const x0 = args.x0 || 0;
  const order = args.order || 5;
  const result = taylorSeries(args.expression, x0, order);
  return toolResult({ expression: `Taylor expansion of ${args.expression}`, ...result });
}

function calcOde(args) {
  const method = args.method || "rk4";
  const steps = args.steps || 100;
  let result;
  if (method === "euler") {
    result = eulerMethod(args.expression, args.x0, args.y0, args.x_end, steps);
  } else {
    result = rungeKutta4(args.expression, args.x0, args.y0, args.x_end, steps);
  }
  result.points.forEach(point => {
    assertFiniteNumber(point.x, "ODE x");
    assertFiniteNumber(point.y, "ODE y");
  });
  const stride = Math.max(1, Math.floor(result.points.length / 50));
  result.points = result.points.filter((_, i) => i % stride === 0 || i === result.points.length - 1);
  return toolResult({ expression: `dy/dx = ${args.expression}`, ...result });
}

function calcPlotData(args) {
  const nPoints = args.points || 100;
  const vars = args.variables || {};
  const dx = (args.x_max - args.x_min) / (nPoints - 1);
  const xVals = [], yVals = [];
  for (let i = 0; i < nPoints; i++) {
    const x = args.x_min + i * dx;
    try {
      const y = safeNullableEval(args.expression, { ...vars, x });
      xVals.push(parseFloat(x.toPrecision(6)));
      yVals.push(typeof y === 'number' && isFinite(y) ? parseFloat(y.toPrecision(8)) : null);
    } catch {
      yVals.push(null);
    }
  }
  return toolResult({ expression: args.expression, x_range: [args.x_min, args.x_max], points: nPoints, x: xVals, y: yVals });
}

export { calcDerivative, calcIntegral, calcDoubleIntegral, calcSolve, calcSeries, calcLimit, calcTaylor, calcOde, calcPlotData };
