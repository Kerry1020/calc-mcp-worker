import { formatNumber, toolResult } from '../lib/format.js';
import { erfFn } from '../lib/special.js';
import { solveLinearSystem } from '../lib/matrix.js';

function calcStats(args) {
  const data = args.data;
  if (!data.length) throw new Error("Empty dataset");
  const n = data.length;
  const sorted = [...data].sort((a,b) => a-b);
  const sum = data.reduce((a,b) => a+b, 0);
  const mean = sum / n;
  const variance = data.reduce((s,x) => s + (x-mean)**2, 0) / (n > 1 ? n-1 : 1);
  const stdev = Math.sqrt(variance);
  const median = n%2 ? sorted[Math.floor(n/2)] : (sorted[n/2-1]+sorted[n/2])/2;
  const q1 = sorted[Math.floor(n*0.25)];
  const q3 = sorted[Math.floor(n*0.75)];
  const skewness = n > 2 ? data.reduce((s,x) => s + ((x-mean)/stdev)**3, 0) / n : 0;
  const kurtosis = n > 3 ? data.reduce((s,x) => s + ((x-mean)/stdev)**4, 0) / n - 3 : 0;
  // Mode
  const freq = {};
  data.forEach(x => freq[x] = (freq[x]||0)+1);
  const maxFreq = Math.max(...Object.values(freq));
  const mode = Object.entries(freq).filter(([,v]) => v === maxFreq).map(([k]) => Number(k));

  return toolResult({
    n, sum, mean: formatNumber(mean), median: formatNumber(median),
    mode: mode.length === n ? "no mode" : mode,
    stdev: formatNumber(stdev), variance: formatNumber(variance),
    min: sorted[0], max: sorted[n-1],
    q1: formatNumber(q1), q3: formatNumber(q3), iqr: formatNumber(q3-q1),
    range: formatNumber(sorted[n-1]-sorted[0]),
    skewness: formatNumber(skewness), kurtosis: formatNumber(kurtosis)
  });
}

function calcLeastSquares(args) {
  const x = args.x, y = args.y;
  if (x.length !== y.length || x.length < 2) throw new Error("Need at least 2 matching data points");
  const n = x.length;
  const degree = args.degree || 1;

  if (degree === 1) {
    // Linear: y = ax + b
    const sx = x.reduce((a,b)=>a+b,0), sy = y.reduce((a,b)=>a+b,0);
    const sxy = x.reduce((a,xi,i)=>a+xi*y[i],0);
    const sxx = x.reduce((a,xi)=>a+xi*xi,0);
    const a = (n*sxy - sx*sy) / (n*sxx - sx*sx);
    const b = (sy - a*sx) / n;
    // R²
    const yMean = sy/n;
    const ssTot = y.reduce((s,yi)=>s+(yi-yMean)**2,0);
    const ssRes = y.reduce((s,yi,i)=>s+(yi-(a*x[i]+b))**2,0);
    const r2 = 1 - ssRes/ssTot;
    const residuals = y.map((yi,i) => yi - (a*x[i]+b));
    const predictions = x.map(xi => a*xi+b);
    return { n, slope: a, intercept: b, r_squared: r2, equation: `y = ${a}x + ${b}`, residuals, predictions };
  }

  // Polynomial least squares (degree > 1)
  // Build Vandermonde matrix and solve normal equations
  const m = degree + 1;
  // X^T X and X^T y
  const XtX = Array.from({length:m},()=>Array(m).fill(0));
  const Xty = Array(m).fill(0);
  for (let i = 0; i < n; i++) {
    const row = Array.from({length:m},(_,k)=>Math.pow(x[i],k));
    for (let j = 0; j < m; j++) {
      Xty[j] += row[j] * y[i];
      for (let k = 0; k < m; k++) XtX[j][k] += row[j] * row[k];
    }
  }
  // Solve via Gauss elimination
  const coeffs = solveLinearSystem(XtX, Xty);
  const predictions = x.map(xi => coeffs.reduce((s,c,k) => s + c*Math.pow(xi,k), 0));
  const yMean = y.reduce((a,b)=>a+b,0)/n;
  const ssTot = y.reduce((s,yi)=>s+(yi-yMean)**2,0);
  const ssRes = y.reduce((s,yi,i)=>s+(yi-predictions[i])**2,0);
  const r2 = 1 - ssRes/ssTot;
  const terms = coeffs.map((c,i) => i===0 ? `${c}` : `${c >= 0 ? '+' : ''}${c}x^${i}`).join(' ');
  return { n, degree, coefficients: coeffs, r_squared: r2, equation: terms, predictions };
}

function calcAnova(args) {
  const groups = args.groups;
  const k = groups.length;
  const allData = groups.flat();
  const N = allData.length;
  const grandMean = allData.reduce((a,b)=>a+b,0)/N;

  // SS between
  const ssBetween = groups.reduce((s,g) => {
    const gm = g.reduce((a,b)=>a+b,0)/g.length;
    return s + g.length * (gm - grandMean)**2;
  }, 0);

  // SS within
  const ssWithin = groups.reduce((s,g) => {
    const gm = g.reduce((a,b)=>a+b,0)/g.length;
    return s + g.reduce((ss,x) => ss + (x-gm)**2, 0);
  }, 0);

  const ssTotal = allData.reduce((s,x) => s + (x-grandMean)**2, 0);
  const dfBetween = k - 1;
  const dfWithin = N - k;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const F = msBetween / msWithin;
  const pValue = 1 - 0.5*(1+erfFn(Math.sqrt(F/2))); // Approximate

  return {
    test: "one-way ANOVA",
    groups: k,
    total_n: N,
    grand_mean: grandMean,
    ss_between: ssBetween,
    ss_within: ssWithin,
    ss_total: ssTotal,
    df_between: dfBetween,
    df_within: dfWithin,
    ms_between: msBetween,
    ms_within: msWithin,
    F_statistic: F,
    p_value: pValue,
    significant: pValue < 0.05,
    conclusion: pValue < 0.05 ? "Reject H0: at least one group mean differs" : "Fail to reject H0: no significant difference"
  };
}

function calcCorrelation(args) {
  const x = args.x, y = args.y;
  const n = x.length;
  const method = args.method || "pearson";

  if (method === "pearson") {
    const mx = x.reduce((a,b)=>a+b,0)/n, my = y.reduce((a,b)=>a+b,0)/n;
    const cov = x.reduce((s,xi,i)=>s+(xi-mx)*(y[i]-my),0)/(n-1);
    const sx = Math.sqrt(x.reduce((s,xi)=>s+(xi-mx)**2,0)/(n-1));
    const sy = Math.sqrt(y.reduce((s,yi)=>s+(yi-my)**2,0)/(n-1));
    const r = cov/(sx*sy);
    // t-test for significance
    const t = r * Math.sqrt((n-2)/(1-r*r+1e-15));
    const pValue = 2*(1-0.5*(1+erfFn(Math.abs(t)/Math.sqrt(2))));
    return { method: "pearson", r, r_squared: r*r, covariance: cov, t_statistic: t, p_value: pValue, significant: pValue < 0.05, n };
  }

  if (method === "spearman") {
    // Rank-based
    const rank = (arr) => {
      const sorted = [...arr].sort((a,b)=>a-b);
      return arr.map(v => sorted.indexOf(v)+1);
    };
    const rx = rank(x), ry = rank(y);
    const d2 = rx.reduce((s,r,i)=>s+(r-ry[i])**2,0);
    const rho = 1 - 6*d2/(n*(n*n-1));
    return { method: "spearman", rho, n };
  }

  if (method === "covariance") {
    const mx = x.reduce((a,b)=>a+b,0)/n, my = y.reduce((a,b)=>a+b,0)/n;
    const cov = x.reduce((s,xi,i)=>s+(xi-mx)*(y[i]-my),0)/(n-1);
    return { method: "covariance", covariance: cov, n };
  }

  if (method === "kendall") {
    let concordant = 0, discordant = 0;
    for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) {
      const dx = x[i]-x[j], dy = y[i]-y[j];
      if (dx*dy > 0) concordant++;
      else if (dx*dy < 0) discordant++;
    }
    const tau = (concordant - discordant) / (n*(n-1)/2);
    return { method: "kendall", tau, concordant, discordant, n };
  }
}

export { calcStats, calcLeastSquares, calcAnova, calcCorrelation };
