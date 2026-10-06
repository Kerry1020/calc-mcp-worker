// Tool registry: maps MCP tool names to handlers.
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

// Handlers that return plain objects are wrapped with toolResult().
const wrap = (fn) => (args) => toolResult(fn(args));

const HANDLERS = new Map([
  ['calc_batch', calcBatch],
  ['calc_single', calcSingle],
  ['calc_derivative', calcDerivative],
  ['calc_integral', calcIntegral],
  ['calc_double_integral', calcDoubleIntegral],
  ['calc_solve', calcSolve],
  ['calc_series', calcSeries],
  ['calc_limit', calcLimit],
  ['calc_taylor', calcTaylor],
  ['calc_ode', calcOde],
  ['calc_matrix', calcMatrix],
  ['calc_simplify', calcSimplify],
  ['calc_constants', calcConstants],
  ['calc_convert', calcConvert],
  ['calc_stats', calcStats],
  ['calc_base_convert', calcBaseConvert],
  ['calc_prime', calcPrime],
  ['calc_plot_data', calcPlotData],
  ['calc_least_squares', wrap(calcLeastSquares)],
  ['calc_probability', wrap(calcProbability)],
  ['calc_hypothesis_test', wrap(calcHypothesisTest)],
  ['calc_confidence_interval', wrap(calcConfidenceInterval)],
  ['calc_anova', wrap(calcAnova)],
  ['calc_correlation', wrap(calcCorrelation)],
  ['health', () => toolResult({ status: 'ok', version: SERVER_VERSION, tools: TOOLS.length })],
]);

export class UnknownToolError extends Error {}

export function hasTool(name) { return HANDLERS.has(name); }

/** Run a tool. Throws UnknownToolError for unknown names; other errors are tool execution failures. */
export async function callTool(params) {
  const { name } = params;
  const handler = HANDLERS.get(name);
  if (!handler) throw new UnknownToolError(`Unknown tool: ${name}`);
  return handler(params.arguments ?? {});
}
