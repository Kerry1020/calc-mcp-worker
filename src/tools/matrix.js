import { formatNumber, toolResult } from '../lib/format.js';
import { parseMatrixExpression, matrixOp } from '../lib/matrix.js';

function calcMatrix(args) {
  const op = args.operation;
  const A = parseMatrixExpression(args.matrix);
  if (['add','sub','mul'].includes(op)) {
    if (!args.matrix_b) throw new Error(`Operation ${op} requires matrix_b`);
    const B = parseMatrixExpression(args.matrix_b);
    return toolResult({ operation: op, result: formatNumber(matrixOp(op, A, B)) });
  }
  const result = matrixOp(op, A);
  if (op === 'eigen') return toolResult({ operation: op, largest_eigenvalue: result.largest_eigenvalue, eigenvector: result.eigenvector.map(v => parseFloat(v.toPrecision(8))) });
  return toolResult({ operation: op, result: formatNumber(result) });
}

export { calcMatrix };
