// Dense matrix utilities (real-valued).
import { MATRIX_EPSILON } from './constants.js';
import { evaluateExpr } from './expression.js';
import { LIMITS } from './validate.js';

/** Parse and validate a matrix given as an expression string or a nested JSON array. */
export function parseMatrixExpression(input, label = 'matrix') {
  const value = typeof input === 'string' ? evaluateExpr(input, {}) : input;
  if (!Array.isArray(value) || value.length === 0 || !Array.isArray(value[0])) throw new Error('Input must be a matrix [[a,b],[c,d]]');
  const rows = value.length, cols = value[0].length;
  if (cols === 0) throw new Error(`${label} must not have empty rows`);
  if (rows > LIMITS.MAX_MATRIX_DIM || cols > LIMITS.MAX_MATRIX_DIM) throw new Error(`${label} is too large (max ${LIMITS.MAX_MATRIX_DIM}x${LIMITS.MAX_MATRIX_DIM})`);
  for (let i = 0; i < rows; i++) {
    const row = value[i];
    if (!Array.isArray(row) || row.length !== cols) throw new Error(`${label} must be rectangular (row ${i} has a different length)`);
    for (let j = 0; j < cols; j++) {
      if (typeof row[j] !== 'number' || !Number.isFinite(row[j])) throw new Error(`${label}[${i}][${j}] must be a finite real number`);
    }
  }
  return value;
}

function requireSquare(A, op) {
  if (A.length !== A[0].length) throw new Error(`Operation ${op} requires a square matrix (got ${A.length}x${A[0].length})`);
}

const maxAbs = (A) => A.reduce((m, row) => row.reduce((mm, v) => Math.max(mm, Math.abs(v)), m), 0);

export function matrixOp(op, A, B) {
  switch (op) {
    case 'add':
    case 'sub':
      if (A.length !== B.length || A[0].length !== B[0].length) throw new Error(`Operation ${op} requires matrices of the same size`);
      return A.map((row, i) => row.map((v, j) => (op === 'add' ? v + B[i][j] : v - B[i][j])));
    case 'mul': {
      const m = A.length, n = A[0].length, p = B[0].length;
      if (B.length !== n) throw new Error(`Operation mul requires columns of A (${n}) to equal rows of B (${B.length})`);
      const C = Array.from({ length: m }, () => Array(p).fill(0));
      for (let i = 0; i < m; i++) for (let k = 0; k < n; k++) { const a = A[i][k]; for (let j = 0; j < p; j++) C[i][j] += a * B[k][j]; }
      return C;
    }
    case 'det': requireSquare(A, op); return matrixDet(A);
    case 'inv': requireSquare(A, op); return matrixInv(A);
    case 'transpose': return A[0].map((_, j) => A.map(row => row[j]));
    case 'trace': requireSquare(A, op); return A.reduce((s, row, i) => s + row[i], 0);
    case 'eigen': requireSquare(A, op); return eigenValues(A);
    default: throw new Error(`Unknown matrix operation: ${op}`);
  }
}

/** Determinant: exact cofactor expansion up to 3x3, LU with partial pivoting above (O(n^3)). */
export function matrixDet(m) {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  if (n === 3) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
      - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
      + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }
  const a = m.map(row => [...row]);
  let det = 1;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(a[k][i]) > Math.abs(a[p][i])) p = k;
    if (a[p][i] === 0) return 0;
    if (p !== i) { [a[i], a[p]] = [a[p], a[i]]; det = -det; }
    det *= a[i][i];
    for (let k = i + 1; k < n; k++) {
      const f = a[k][i] / a[i][i];
      for (let j = i; j < n; j++) a[k][j] -= f * a[i][j];
    }
  }
  return det;
}

/** Gauss-Jordan inverse with partial pivoting and a scale-relative singularity test. */
export function matrixInv(m) {
  const n = m.length;
  const tol = MATRIX_EPSILON * Math.max(maxAbs(m), Number.MIN_VALUE);
  const aug = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    const pivot = aug[i][i];
    if (!Number.isFinite(pivot) || Math.abs(pivot) <= tol) throw new Error('Matrix is singular and cannot be inverted');
    for (let j = 0; j < 2 * n; j++) aug[i][j] /= pivot;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = aug[k][i];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) aug[k][j] -= factor * aug[i][j];
    }
  }
  return aug.map(row => row.slice(n));
}

/**
 * Dominant eigenvalue (largest |lambda|) by power iteration with a Rayleigh-quotient
 * estimate, so the sign is preserved. Reports whether the iteration converged
 * (it does not for complex or equal-magnitude dominant eigenvalues).
 */
export function eigenValues(m, maxIter = 1000) {
  const n = m.length;
  const matVec = (v) => m.map(row => row.reduce((s, val, j) => s + val * v[j], 0));
  const norm = (v) => Math.hypot(...v);
  // Deterministic, non-symmetric start vector (an all-ones vector is often orthogonal to the dominant eigenvector).
  let v = Array.from({ length: n }, (_, i) => 1 + (i + 1) / (n + 1) * 0.618);
  let nv = norm(v); v = v.map(x => x / nv);
  let lambda = 0, converged = false, iter = 0;
  for (iter = 1; iter <= maxIter; iter++) {
    const mv = matVec(v);
    lambda = v.reduce((s, x, i) => s + x * mv[i], 0);
    const nmv = norm(mv);
    if (nmv === 0) { lambda = 0; converged = true; break; }
    const residual = Math.hypot(...mv.map((x, i) => x - lambda * v[i]));
    v = mv.map(x => x / nmv);
    if (residual <= 1e-10 * Math.max(1, Math.abs(lambda))) { converged = true; break; }
  }
  // Canonical sign: largest-magnitude component positive.
  let big = 0;
  for (let i = 1; i < n; i++) if (Math.abs(v[i]) > Math.abs(v[big])) big = i;
  if (v[big] < 0) v = v.map(x => -x);
  return { largest_eigenvalue: lambda, eigenvector: v, converged, iterations: Math.min(iter, maxIter) };
}

/** Least-squares solution of A x = b (A is m x n, m >= n) via Householder QR. */
export function leastSquaresQR(A, b) {
  const m = A.length, n = A[0].length;
  const R = A.map(row => [...row]);
  const y = [...b];
  const scaleTol = MATRIX_EPSILON * Math.max(maxAbs(A), Number.MIN_VALUE);
  for (let k = 0; k < n; k++) {
    let normx = 0;
    for (let i = k; i < m; i++) normx = Math.hypot(normx, R[i][k]);
    if (normx <= scaleTol) throw new Error('Linear system is singular or ill-conditioned');
    const alpha = R[k][k] > 0 ? -normx : normx;
    const v = Array(m).fill(0);
    for (let i = k; i < m; i++) v[i] = R[i][k];
    v[k] -= alpha;
    const vnorm2 = v.reduce((s, x) => s + x * x, 0);
    if (vnorm2 === 0) continue;
    for (let j = k; j < n; j++) {
      let s = 0; for (let i = k; i < m; i++) s += v[i] * R[i][j];
      const f = 2 * s / vnorm2;
      for (let i = k; i < m; i++) R[i][j] -= f * v[i];
    }
    let s = 0; for (let i = k; i < m; i++) s += v[i] * y[i];
    const f = 2 * s / vnorm2;
    for (let i = k; i < m; i++) y[i] -= f * v[i];
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let j = i + 1; j < n; j++) s -= R[i][j] * x[j];
    x[i] = s / R[i][i];
  }
  return x;
}
