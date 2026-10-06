import { SERVER_VERSION } from '../lib/constants.js';
import { toolResult } from '../lib/format.js';
import { TOOLS } from './definitions.js';
import { calcBatch, calcSingle, calcSimplify } from './expression.js';
import { calcDerivative, calcIntegral, calcDoubleIntegral, calcSolve, calcSeries, calcLimit, calcTaylor, calcOde, calcPlotData } from './calculus.js';
import { calcMatrix } from './matrix.js';
import { calcConstants, calcConvert, calcBaseConvert } from './units.js';
import { calcPrime } from './primes.js';
import { calcStats, calcLeastSquares, calcAnova, calcCorrelation } from './statistics.js';
import { calcProbability, calcHypothesisTest, calcConfidenceInterval } from './probability.js';

export { TOOLS };

export async function callTool(params) {
  const { name, arguments: args } = params;
  switch (name) {
    case "calc_batch": return calcBatch(args);
    case "calc_single": return calcSingle(args);
    case "calc_derivative": return calcDerivative(args);
    case "calc_integral": return calcIntegral(args);
    case "calc_double_integral": return calcDoubleIntegral(args);
    case "calc_solve": return calcSolve(args);
    case "calc_series": return calcSeries(args);
    case "calc_limit": return calcLimit(args);
    case "calc_taylor": return calcTaylor(args);
    case "calc_ode": return calcOde(args);
    case "calc_matrix": return calcMatrix(args);
    case "calc_simplify": return calcSimplify(args);
    case "calc_constants": return calcConstants(args);
    case "calc_convert": return calcConvert(args);
    case "calc_stats": return calcStats(args);
    case "calc_base_convert": return calcBaseConvert(args);
    case "calc_prime": return calcPrime(args);
    case "calc_plot_data": return calcPlotData(args);
    case "calc_least_squares":
      return toolResult(await calcLeastSquares(args));
    case "calc_probability":
      return toolResult(calcProbability(args));
    case "calc_hypothesis_test":
      return toolResult(calcHypothesisTest(args));
    case "calc_confidence_interval":
      return toolResult(calcConfidenceInterval(args));
    case "calc_anova":
      return toolResult(calcAnova(args));
    case "calc_correlation":
      return toolResult(calcCorrelation(args));
    case "health": return toolResult({ status: "ok", version: SERVER_VERSION, tools: TOOLS.length });
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
