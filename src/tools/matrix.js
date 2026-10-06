// calc_matrix
import { formatNumber, toolResult } from '../lib/format.js';
import { parseMatrixExpression, matrixOp } from '../lib/matrix.js';

const OPERATIONS = ['det', 'inv', 'transpose', 'trace', 'eigen', 'add', 'sub', 'mul'];

export function calcMatrix(args) {
  const op = args.operation;
  if (!OPERATIONS.includes(op)) throw new Error(`Unknown matrix operation: ${op}`);
  if (args.matrix === undefined || args.matrix === null) throw new Error('matrix is required');
  const A = parseMatrixExpression(args.matrix, 'matrix');
  if (['add', 'sub', 'mul'].includes(op)) {
    if (args.matrix_b === undefined || args.matrix_b === null || args.matrix_b === '') throw new Error(`Operation ${op} requires matrix_b`);
    const B = parseMatrixExpression(args.matrix_b, 'matrix_b');
    return toolResult({ operation: op, result: formatNumber(matrixOp(op, A, B)) });
  }
  const result = matrixOp(op, A);
  if (op === 'eigen') {
    return toolResult({
      operation: op,
      largest_eigenvalue: result.largest_eigenvalue,
      eigenvector: result.eigenvector.map(v => parseFloat(v.toPrecision(8))),
      converged: result.converged,
      iterations: result.iterations,
      ...(result.converged ? {} : { warning: 'Power iteration did not converge; the dominant eigenvalue may be complex or not unique in magnitude' }),
    });
  }
  return toolResult({ operation: op, result: formatNumber(result) });
}
