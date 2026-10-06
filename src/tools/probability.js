// calc_probability, calc_hypothesis_test, calc_confidence_interval
import {
  LIMITS, requireArrayField, requireField, requireFiniteNumber, requireNumberArray,
  requirePositiveInteger, requirePositiveNumber, requireProbability,
} from '../lib/validate.js';
import {
  binomialCdf, binomialPmf, boxMuller, chi2Cdf, chi2Quantile, chi2Sf, lgamma, normalQuantile,
  normalSf, poissonCdf, poissonPmf, poissonSample, tCdf, tQuantile, tTwoSidedP,
} from '../lib/special.js';

const num = (p, field, context) => requireFiniteNumber(requireField(p, field, context), `${context} ${field}`);
const quantileArg = (p, context) => requireProbability(requireField(p, 'p', context), `${context} p`, { open: true });
const sampleSize = (p, context) => requirePositiveInteger(p.n ?? 10, `${context} n`, LIMITS.MAX_SAMPLE_SIZE);

export function calcProbability(args) {
  const dist = args.distribution;
  const op = args.operation;
  const p = args.params ?? {};
  if (typeof p !== 'object' || Array.isArray(p)) throw new Error('params must be an object');

  switch (dist) {
    case 'normal': {
      const mu = requireFiniteNumber(p.mean ?? 0, 'normal mean');
      const sigma = p.std ?? 1;
      if (!(typeof sigma === 'number' && sigma > 0 && Number.isFinite(sigma))) throw new Error('normal distribution requires std > 0');
      const params = { mean: mu, std: sigma };
      if (op === 'pdf') {
        const x = num(p, 'x', 'normal pdf');
        return { distribution: 'normal', params, x, pdf: Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI)) };
      }
      if (op === 'cdf') {
        const x = num(p, 'x', 'normal cdf');
        return { distribution: 'normal', params, x, cdf: 1 - normalSf((x - mu) / sigma) };
      }
      if (op === 'quantile') {
        const q = requireField(p, 'p', 'normal quantile');
        if (!(q > 0 && q < 1)) throw new Error('normal quantile requires 0 < p < 1');
        return { distribution: 'normal', params, p: q, quantile: mu + sigma * normalQuantile(q) };
      }
      if (op === 'mean') return { distribution: 'normal', mean: mu };
      if (op === 'variance') return { distribution: 'normal', variance: sigma * sigma };
      if (op === 'sample') return { distribution: 'normal', sample: boxMuller(mu, sigma, sampleSize(p, 'normal sample')) };
      break;
    }
    case 'binomial': {
      const n = requirePositiveInteger(p.n ?? 10, 'binomial n');
      const prob = p.p ?? 0.5;
      if (!(prob >= 0 && prob <= 1)) throw new Error('binomial requires 0 <= p <= 1');
      const params = { n, p: prob };
      if (op === 'pdf') {
        const k = num(p, 'k', 'binomial pdf');
        return { distribution: 'binomial', params, k, pdf: binomialPmf(k, n, prob) };
      }
      if (op === 'cdf') {
        const k = num(p, 'k', 'binomial cdf');
        return { distribution: 'binomial', params, k, cdf: binomialCdf(k, n, prob) };
      }
      if (op === 'mean') return { distribution: 'binomial', mean: n * prob };
      if (op === 'variance') return { distribution: 'binomial', variance: n * prob * (1 - prob) };
      break;
    }
    case 'poisson': {
      const lambda = p.lambda ?? 1;
      if (!(typeof lambda === 'number' && lambda > 0 && Number.isFinite(lambda))) throw new Error('poisson requires lambda > 0');
      if (op === 'pdf') {
        const k = num(p, 'k', 'poisson pdf');
        return { distribution: 'poisson', params: { lambda }, k, pdf: poissonPmf(k, lambda) };
      }
      if (op === 'cdf') {
        const k = num(p, 'k', 'poisson cdf');
        return { distribution: 'poisson', params: { lambda }, k, cdf: poissonCdf(k, lambda) };
      }
      if (op === 'mean') return { distribution: 'poisson', mean: lambda };
      if (op === 'variance') return { distribution: 'poisson', variance: lambda };
      if (op === 'sample') {
        const n = sampleSize(p, 'poisson sample');
        return { distribution: 'poisson', params: { lambda }, sample: Array.from({ length: n }, () => poissonSample(lambda)) };
      }
      break;
    }
    case 'exponential': {
      const lambda = p.lambda ?? 1;
      if (!(typeof lambda === 'number' && lambda > 0 && Number.isFinite(lambda))) throw new Error('exponential requires lambda > 0');
      if (op === 'pdf') {
        const x = num(p, 'x', 'exponential pdf');
        return { distribution: 'exponential', params: { lambda }, x, pdf: x >= 0 ? lambda * Math.exp(-lambda * x) : 0 };
      }
      if (op === 'cdf') {
        const x = num(p, 'x', 'exponential cdf');
        return { distribution: 'exponential', params: { lambda }, x, cdf: x >= 0 ? -Math.expm1(-lambda * x) : 0 };
      }
      if (op === 'quantile') {
        const q = quantileArg(p, 'exponential quantile');
        return { distribution: 'exponential', params: { lambda }, p: q, quantile: -Math.log1p(-q) / lambda };
      }
      if (op === 'mean') return { distribution: 'exponential', mean: 1 / lambda };
      if (op === 'variance') return { distribution: 'exponential', variance: 1 / (lambda * lambda) };
      break;
    }
    case 'chi2': {
      const k = requirePositiveNumber(p.df ?? 1, 'chi2 df');
      if (op === 'pdf') {
        const x = num(p, 'x', 'chi2 pdf');
        const pdf = x > 0 ? Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.LN2 - lgamma(k / 2)) : (x === 0 && k === 2 ? 0.5 : 0);
        return { distribution: 'chi2', params: { df: k }, x, pdf };
      }
      if (op === 'cdf') {
        const x = num(p, 'x', 'chi2 cdf');
        return { distribution: 'chi2', params: { df: k }, x, cdf: chi2Cdf(x, k) };
      }
      if (op === 'quantile') {
        const q = quantileArg(p, 'chi2 quantile');
        return { distribution: 'chi2', params: { df: k }, p: q, quantile: chi2Quantile(q, k) };
      }
      if (op === 'mean') return { distribution: 'chi2', mean: k };
      if (op === 'variance') return { distribution: 'chi2', variance: 2 * k };
      break;
    }
    case 't': {
      const df = requirePositiveNumber(p.df ?? 1, 't distribution df');
      if (op === 'pdf') {
        const x = num(p, 'x', 't pdf');
        const logPdf = lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI) - (df + 1) / 2 * Math.log1p(x * x / df);
        return { distribution: 't', params: { df }, x, pdf: Math.exp(logPdf) };
      }
      if (op === 'cdf') {
        const x = num(p, 'x', 't cdf');
        return { distribution: 't', params: { df }, x, cdf: tCdf(x, df) };
      }
      if (op === 'quantile') {
        const q = quantileArg(p, 't quantile');
        return { distribution: 't', params: { df }, p: q, quantile: tQuantile(q, df) };
      }
      // Undefined moments are reported as null (previously the key was silently dropped).
      if (op === 'mean') return { distribution: 't', mean: df > 1 ? 0 : null };
      if (op === 'variance') return { distribution: 't', variance: df > 2 ? df / (df - 2) : (df > 1 ? Infinity : null) };
      break;
    }
    case 'uniform': {
      const a = requireFiniteNumber(p.a ?? 0, 'uniform a');
      const b = requireFiniteNumber(p.b ?? 1, 'uniform b');
      if (!(b > a)) throw new Error('uniform requires b > a');
      if (op === 'pdf') {
        const x = num(p, 'x', 'uniform pdf');
        return { distribution: 'uniform', params: { a, b }, x, pdf: (x >= a && x <= b) ? 1 / (b - a) : 0 };
      }
      if (op === 'cdf') {
        const x = num(p, 'x', 'uniform cdf');
        return { distribution: 'uniform', params: { a, b }, x, cdf: x < a ? 0 : (x > b ? 1 : (x - a) / (b - a)) };
      }
      if (op === 'quantile') {
        const q = requireProbability(requireField(p, 'p', 'uniform quantile'), 'uniform quantile p');
        return { distribution: 'uniform', params: { a, b }, p: q, quantile: a + q * (b - a) };
      }
      if (op === 'mean') return { distribution: 'uniform', mean: (a + b) / 2 };
      if (op === 'variance') return { distribution: 'uniform', variance: (b - a) ** 2 / 12 };
      break;
    }
  }
  throw new Error(`Unsupported distribution/operation: ${dist}/${op}`);
}

function alphaOf(p) {
  if (p.alpha === undefined || p.alpha === null) return 0.05;
  return requireProbability(p.alpha, 'alpha', { open: true });
}

function sampleStats(data) {
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const variance = data.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  return { n, mean, variance };
}

const decision = (pValue, alpha) => ({ significant: pValue < alpha, conclusion: pValue < alpha ? 'Reject H0' : 'Fail to reject H0' });

export function calcHypothesisTest(args) {
  const test = args.test;
  const p = args.params ?? {};
  switch (test) {
    case 'z_test': {
      const sampleMean = num(p, 'sample_mean', 'z_test');
      const mu0 = num(p, 'mu0', 'z_test');
      const sigma = num(p, 'sigma', 'z_test');
      const n = requirePositiveInteger(requireField(p, 'n', 'z_test'), 'z_test n');
      const alpha = alphaOf(p);
      if (!(sigma > 0)) throw new Error('z_test requires sigma > 0');
      const z = (sampleMean - mu0) / (sigma / Math.sqrt(n));
      const pValue = 2 * normalSf(Math.abs(z));
      return { test: 'z_test', H0: `mu = ${mu0}`, z_statistic: z, p_value: pValue, ...decision(pValue, alpha), critical_value: normalQuantile(1 - alpha / 2) };
    }
    case 't_test_one_sample': {
      const data = requireNumberArray(requireArrayField(p, 'data', 't_test_one_sample'), 't_test_one_sample data', { min: 2 });
      const mu0 = num(p, 'mu0', 't_test_one_sample');
      const alpha = alphaOf(p);
      const { n, mean, variance } = sampleStats(data);
      if (variance === 0) throw new Error('t_test_one_sample requires data with non-zero variance');
      const t = (mean - mu0) / Math.sqrt(variance / n);
      const df = n - 1;
      const pValue = tTwoSidedP(t, df);
      return { test: 't_test_one_sample', H0: `mu = ${mu0}`, sample_mean: mean, sample_std: Math.sqrt(variance), t_statistic: t, df, p_value: pValue, ...decision(pValue, alpha), critical_value: tQuantile(1 - alpha / 2, df) };
    }
    case 't_test_two_sample': {
      const data1 = requireNumberArray(requireArrayField(p, 'data1', 't_test_two_sample'), 't_test_two_sample data1', { min: 2 });
      const data2 = requireNumberArray(requireArrayField(p, 'data2', 't_test_two_sample'), 't_test_two_sample data2', { min: 2 });
      const alpha = alphaOf(p);
      const s1 = sampleStats(data1), s2 = sampleStats(data2);
      const a = s1.variance / s1.n, b = s2.variance / s2.n;
      if (a + b === 0) throw new Error('t_test_two_sample requires data with non-zero variance');
      // Welch's t-test with the Welch-Satterthwaite degrees of freedom.
      const t = (s1.mean - s2.mean) / Math.sqrt(a + b);
      const df = (a + b) ** 2 / (a * a / (s1.n - 1) + b * b / (s2.n - 1));
      const pValue = tTwoSidedP(t, df);
      return { test: 't_test_two_sample', H0: 'mu1 = mu2', mean1: s1.mean, mean2: s2.mean, t_statistic: t, df, p_value: pValue, ...decision(pValue, alpha) };
    }
    case 'chi2_gof': {
      const observed = requireNumberArray(requireArrayField(p, 'observed', 'chi2_gof'), 'chi2_gof observed');
      const expected = requireNumberArray(requireArrayField(p, 'expected', 'chi2_gof'), 'chi2_gof expected');
      const alpha = alphaOf(p);
      if (observed.length !== expected.length) throw new Error('chi2_gof requires observed and expected arrays of the same length');
      if (observed.length < 2) throw new Error('chi2_gof requires at least 2 categories');
      if (expected.some(v => v <= 0)) throw new Error('chi2_gof requires expected values > 0');
      if (observed.some(v => v < 0)) throw new Error('chi2_gof requires observed counts >= 0');
      const chi2 = observed.reduce((s, o, i) => s + (o - expected[i]) ** 2 / expected[i], 0);
      const df = observed.length - 1;
      const pValue = chi2Sf(chi2, df);
      return { test: 'chi2_gof', chi2_statistic: chi2, df, p_value: pValue, ...decision(pValue, alpha), critical_value: chi2Quantile(1 - alpha, df) };
    }
  }
  throw new Error(`Unknown test: ${test}`);
}

export function calcConfidenceInterval(args) {
  const type = args.type;
  const confidence = args.confidence === undefined || args.confidence === null ? 0.95 : requireProbability(args.confidence, 'confidence', { open: true });
  const alpha = 1 - confidence;
  const z = normalQuantile(1 - alpha / 2);
  const data = args.data === undefined || args.data === null ? null : requireNumberArray(args.data, 'data');

  // Summary statistics either from data or from sample_mean / sample_std / n.
  const summary = (needStd) => {
    if (data) {
      if (needStd && data.length < 2) throw new Error(`${type} requires at least 2 data points`);
      const n = data.length;
      const mean = data.reduce((a, b) => a + b, 0) / n;
      const std = n > 1 ? Math.sqrt(data.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
      return { n, mean, std };
    }
    const n = requirePositiveInteger(args.n, 'n');
    const mean = needStd === 'variance' ? null : requireFiniteNumber(args.sample_mean, 'sample_mean');
    const std = needStd ? requirePositiveNumber(args.sample_std, 'sample_std') : null;
    if (needStd && n < 2) throw new Error(`${type} requires n >= 2`);
    return { n, mean, std };
  };

  switch (type) {
    case 'mean_z': {
      const sigma = requirePositiveNumber(args.sigma, 'sigma');
      const { n, mean } = summary(false);
      const margin = z * sigma / Math.sqrt(n);
      return { type: 'mean (known sigma)', confidence, mean, margin, lower: mean - margin, upper: mean + margin, sigma, n };
    }
    case 'mean_t': {
      const { n, mean, std } = summary(true);
      const df = n - 1;
      const tCrit = tQuantile(1 - alpha / 2, df);
      const margin = tCrit * std / Math.sqrt(n);
      return { type: 'mean (t-distribution)', confidence, mean, std, margin, lower: mean - margin, upper: mean + margin, df, n, t_critical: tCrit };
    }
    case 'proportion': {
      const phat = requireProbability(args.p, 'p');
      const n = requirePositiveInteger(args.n, 'n');
      const margin = z * Math.sqrt(phat * (1 - phat) / n);
      return { type: 'proportion', confidence, proportion: phat, margin, lower: Math.max(0, phat - margin), upper: Math.min(1, phat + margin), n };
    }
    case 'variance': {
      const { n, std } = summary('variance');
      const variance = std * std;
      const df = n - 1;
      const chi2Upper = chi2Quantile(1 - alpha / 2, df);
      const chi2Lower = chi2Quantile(alpha / 2, df);
      return { type: 'variance (chi2)', confidence, variance, lower: df * variance / chi2Upper, upper: df * variance / chi2Lower, df, n };
    }
  }
  throw new Error(`Unknown CI type: ${type}`);
}
