import { MATRIX_EPSILON } from './constants.js';
import { evaluateExpr } from './expression.js';

function parseMatrixExpression(expr) {
  const value = evaluateExpr(expr, {});
  if (!Array.isArray(value) || !Array.isArray(value[0])) throw new Error("Input must be a matrix [[a,b],[c,d]]");
  return value;
}

function matrixOp(op, ...matrices) {
  const A = matrices[0], B = matrices[1];
  switch (op) {
    case 'add': return A.map((row,i) => row.map((v,j) => v + B[i][j]));
    case 'sub': return A.map((row,i) => row.map((v,j) => v - B[i][j]));
    case 'mul': {
      const m=A.length, n=A[0].length, p=B[0].length;
      const C = Array.from({length:m}, ()=>Array(p).fill(0));
      for(let i=0;i<m;i++) for(let j=0;j<p;j++) for(let k=0;k<n;k++) C[i][j]+=A[i][k]*B[k][j];
      return C;
    }
    case 'det': return matrixDet(A);
    case 'inv': return matrixInv(A);
    case 'transpose': return A[0].map((_,j) => A.map(row => row[j]));
    case 'trace': return A.reduce((s,row,i) => s + row[i], 0);
    case 'eigen': return eigenValues(A);
    default: throw new Error(`Unknown matrix operation: ${op}`);
  }
}

function matrixDet(m) {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0]*m[1][1] - m[0][1]*m[1][0];
  let det = 0;
  for (let j = 0; j < n; j++) {
    const minor = m.slice(1).map(row => [...row.slice(0,j), ...row.slice(j+1)]);
    det += (j%2===0?1:-1) * m[0][j] * matrixDet(minor);
  }
  return det;
}

function matrixInv(m) {
  const n = m.length;
  const aug = m.map((row,i) => [...row, ...Array(n).fill(0).map((_,j)=>i===j?1:0)]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i+1; k < n; k++) if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    const pivot = aug[i][i];
    if (!Number.isFinite(pivot) || Math.abs(pivot) < MATRIX_EPSILON) throw new Error("Matrix is singular and cannot be inverted");
    for (let j = 0; j < 2*n; j++) aug[i][j] /= pivot;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = aug[k][i];
      for (let j = 0; j < 2*n; j++) aug[k][j] -= factor * aug[i][j];
    }
  }
  return aug.map(row => row.slice(n));
}

function eigenValues(m) {
  // Power iteration for largest eigenvalue
  const n = m.length;
  let v = Array(n).fill(1);
  let lambda = 0;
  for (let iter = 0; iter < 100; iter++) {
    const mv = m.map(row => row.reduce((s,val,j) => s + val*v[j], 0));
    lambda = mv.reduce((s,x) => s + Math.abs(x), 0) / v.reduce((s,x) => s + Math.abs(x), 0);
    const norm = Math.sqrt(mv.reduce((s,x) => s + x*x, 0));
    v = mv.map(x => x/norm);
  }
  return { largest_eigenvalue: lambda, eigenvector: v };
}

function solveLinearSystem(A, b) {
  const n = A.length;
  const aug = A.map((row,i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i+1; k < n; k++) if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    const pivot = aug[i][i];
    if (!Number.isFinite(pivot) || Math.abs(pivot) < MATRIX_EPSILON) throw new Error("Linear system is singular or ill-conditioned");
    for (let j = i; j <= n; j++) aug[i][j] /= pivot;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = aug[k][i];
      for (let j = i; j <= n; j++) aug[k][j] -= factor * aug[i][j];
    }
  }
  return aug.map(row => row[n]);
}

export { parseMatrixExpression, matrixOp, matrixDet, matrixInv, eigenValues, solveLinearSystem };
