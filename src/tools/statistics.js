// calc_stats, calc_least_squares, calc_anova, calc_correlation
import { formatNumber, toolResult } from '../lib/format.js';
import { Sum } from '../lib/numeric.js';
import { fSf, tTwoSidedP } from '../lib/special.js';
import { leastSquaresQR } from '../lib/matrix.js';
import { LIMITS, optionalInteger, requireNumberArray } from '../lib/validate.js';

const sumOf = (a) => { const s = new Sum(); for (const x of a) s.add(x); return s.value; };
const meanOf = (a) => sumOf(a) / a.length;

/** Linear-interpolation quantile (R type 7 / NumPy default / Excel QUARTILE.INC). */
function quantileSorted(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function calcStats(args) {
  const data = requireNumberArray(args.data, 'data');
  const n = data.length;
  const sorted = [...data].sort((a, b) => a - b);
  const sum = sumOf(data);
  const mean = sum / n;
  const m2s = new Sum(), m3s = new Sum(), m4s = new Sum();
  for (const x of data) { const d = x - mean; m2s.add(d * d); m3s.add(d * d * d); m4s.add(d * d * d * d); }
  const ss = m2s.value;
  const variance = ss / (n > 1 ? n - 1 : 1); // sample variance
  const stdev = Math.sqrt(variance);
  // Population-moment shape statistics: g1 = m3 / m2^1.5, g2 = m4 / m2^2 - 3 (excess kurtosis).
  const m2 = ss / n, m3 = m3s.value / n, m4 = m4s.value / n;
  const skewness = n > 2 ? (m2 > 0 ? m3 / Math.pow(m2, 1.5) : null) : 0;
  const kurtosis = n > 3 ? (m2 > 0 ? m4 / (m2 * m2) - 3 : null) : 0;
  const median = quantileSorted(sorted, 0.5);
  const q1 = quantileSorted(sorted, 0.25);
  const q3 = quantileSorted(sorted, 0.75);
  const freq = new Map();
  let maxFreq = 0;
  for (const x of data) { const c = (freq.get(x) || 0) + 1; freq.set(x, c); if (c > maxFreq) maxFreq = c; }
  const mode = [...freq.entries()].filter(([, v]) => v === maxFreq).map(([k]) => k);
  return toolResult({
    n, sum, mean: formatNumber(mean), median: formatNumber(median),
    mode: mode.length === n ? 'no mode' : mode,
    stdev: formatNumber(stdev), variance: formatNumber(variance),
    min: sorted[0], max: sorted[n - 1],
    q1: formatNumber(q1), q3: formatNumber(q3), iqr: formatNumber(q3 - q1),
    range: formatNumber(sorted[n - 1] - sorted[0]),
    skewness: skewness === null ? null : formatNumber(skewness),
    kurtosis: kurtosis === null ? null : formatNumber(kurtosis),
  });
}

function rSquared(y, predictions) {
  const yMean = meanOf(y);
  const ssTot = sumOf(y.map(yi => (yi - yMean) ** 2));
  const ssRes = sumOf(y.map((yi, i) => (yi - predictions[i]) ** 2));
  if (ssTot === 0) return ssRes === 0 ? 1 : 0;
  return 1 - ssRes / ssTot;
}

export function calcLeastSquares(args) {
  const x = requireNumberArray(args.x, 'x', { min: 2 });
  const y = requireNumberArray(args.y, 'y', { min: 2 });
  if (x.length !== y.length) throw new Error('Need at least 2 matching data points');
  const n = x.length;
  const degree = optionalInteger(args.degree, 'degree', 1, 1, 10);
  if (n <= degree) throw new Error(`Degree ${degree} fit needs at least ${degree + 1} data points`);

  if (degree === 1) {
    const mx = meanOf(x), my = meanOf(y);
    let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); }
    if (sxx === 0) throw new Error('All x values are identical; slope is undefined');
    const a = sxy / sxx;
    const b = my - a * mx;
    const predictions = x.map(xi => a * xi + b);
    const residuals = y.map((yi, i) => yi - predictions[i]);
    return { n, slope: a, intercept: b, r_squared: rSquared(y, predictions), equation: `y = ${a}x ${b < 0 ? '-' : '+'} ${Math.abs(b)}`, residuals, predictions };
  }

  // Polynomial fit via Householder QR on the Vandermonde matrix (better conditioned than normal equations).
  const V = x.map(xi => Array.from({ length: degree + 1 }, (_, k) => Math.pow(xi, k)));
  const coeffs = leastSquaresQR(V, y);
  const predictions = x.map(xi => coeffs.reduce((s, c, k) => s + c * Math.pow(xi, k), 0));
  const residuals = y.map((yi, i) => yi - predictions[i]);
  const terms = coeffs.map((c, i) => (i === 0 ? `${c}` : `${c >= 0 ? '+' : ''}${c}x^${i}`)).join(' ');
  return { n, degree, coefficients: coeffs, r_squared: rSquared(y, predictions), equation: terms, predictions, residuals };
}

export function calcAnova(args) {
  const groups = args.groups;
  if (!Array.isArray(groups) || groups.length < 2) throw new Error('groups must be an array of at least 2 groups');
  groups.forEach((g, i) => requireNumberArray(g, `groups[${i}]`));
  const k = groups.length;
  const allData = groups.flat();
  const N = allData.length;
  if (N > LIMITS.MAX_DATA_POINTS) throw new Error(`Too many observations (max ${LIMITS.MAX_DATA_POINTS})`);
  if (N <= k) throw new Error('ANOVA needs more observations than groups');
  const grandMean = meanOf(allData);
  const means = groups.map(meanOf);
  const ssBetween = sumOf(groups.map((g, i) => g.length * (means[i] - grandMean) ** 2));
  const ssWithin = sumOf(groups.map((g, i) => sumOf(g.map(x => (x - means[i]) ** 2))));
  const ssTotal = sumOf(allData.map(x => (x - grandMean) ** 2));
  const dfBetween = k - 1, dfWithin = N - k;
  const msBetween = ssBetween / dfBetween, msWithin = ssWithin / dfWithin;
  if (msWithin === 0) throw new Error('Within-group variance is zero; the F statistic is undefined');
  const F = msBetween / msWithin;
  const pValue = fSf(F, dfBetween, dfWithin);
  return {
    test: 'one-way ANOVA', groups: k, total_n: N, grand_mean: grandMean,
    ss_between: ssBetween, ss_within: ssWithin, ss_total: ssTotal,
    df_between: dfBetween, df_within: dfWithin, ms_between: msBetween, ms_within: msWithin,
    F_statistic: F, p_value: pValue, significant: pValue < 0.05,
    conclusion: pValue < 0.05 ? 'Reject H0: at least one group mean differs' : 'Fail to reject H0: no significant difference',
  };
}

/** Ranks with ties averaged (1-based). */
function averageRanks(a) {
  const idx = a.map((v, i) => i).sort((i, j) => a[i] - a[j]);
  const ranks = new Array(a.length);
  for (let s = 0; s < idx.length;) {
    let e = s;
    while (e + 1 < idx.length && a[idx[e + 1]] === a[idx[s]]) e++;
    const r = (s + e) / 2 + 1;
    for (let t = s; t <= e; t++) ranks[idx[t]] = r;
    s = e + 1;
  }
  return ranks;
}

function pearson(x, y) {
  const n = x.length;
  const mx = meanOf(x), my = meanOf(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  if (sxx === 0 || syy === 0) throw new Error('Correlation is undefined when x or y has zero variance');
  const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
  return { r, cov: sxy / (n - 1) };
}

export function calcCorrelation(args) {
  const x = requireNumberArray(args.x, 'x', { min: 2 });
  const y = requireNumberArray(args.y, 'y', { min: 2 });
  if (x.length !== y.length) throw new Error('x and y must have the same length');
  const n = x.length;
  const method = args.method ?? 'pearson';

  if (method === 'pearson') {
    const { r, cov } = pearson(x, y);
    const df = n - 2;
    let t = null, pValue = null;
    if (df > 0) {
      t = Math.abs(r) === 1 ? Math.sign(r) * Infinity : r * Math.sqrt(df / (1 - r * r));
      pValue = tTwoSidedP(t, df);
    }
    return { method: 'pearson', r, r_squared: r * r, covariance: cov, t_statistic: t, p_value: pValue, significant: pValue !== null && pValue < 0.05, n };
  }
  if (method === 'spearman') {
    // Pearson correlation of average ranks (correct with ties).
    const { r } = pearson(averageRanks(x), averageRanks(y));
    return { method: 'spearman', rho: r, n };
  }
  if (method === 'covariance') {
    const mx = meanOf(x), my = meanOf(y);
    const cov = sumOf(x.map((xi, i) => (xi - mx) * (y[i] - my))) / (n - 1);
    return { method: 'covariance', covariance: cov, n };
  }
  if (method === 'kendall') {
    if (n > LIMITS.MAX_KENDALL_POINTS) throw new Error(`kendall supports at most ${LIMITS.MAX_KENDALL_POINTS} points`);
    let concordant = 0, discordant = 0, tiesX = 0, tiesY = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const s = Math.sign(x[i] - x[j]) * Math.sign(y[i] - y[j]);
      if (s > 0) concordant++;
      else if (s < 0) discordant++;
      else { if (x[i] === x[j]) tiesX++; if (y[i] === y[j]) tiesY++; }
    }
    const n0 = n * (n - 1) / 2;
    const denom = Math.sqrt((n0 - tiesX) * (n0 - tiesY));
    if (denom === 0) throw new Error('Kendall tau is undefined when x or y is constant');
    // tau-b (equals tau-a when there are no ties).
    const tau = (concordant - discordant) / denom;
    return { method: 'kendall', tau, concordant, discordant, n };
  }
  throw new Error(`Unknown correlation method: ${method}`);
}
