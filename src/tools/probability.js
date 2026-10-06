import { requireField, requireArrayField, requirePositiveInteger } from '../lib/validate.js';
import { gammaFn, erfFn, binomialFn, erfinv, boxMuller } from '../lib/special.js';

function calcProbability(args) {
  const dist = args.distribution;
  const op = args.operation;
  const p = args.params || {};

  switch (dist) {
    case "normal": {
      const mu = p.mean ?? 0;
      const sigma = p.std ?? 1;
      if (!(sigma > 0)) throw new Error("normal distribution requires std > 0");
      const pdf = (x) => Math.exp(-0.5*((x-mu)/sigma)**2) / (sigma*Math.sqrt(2*Math.PI));
      const cdf = (x) => 0.5 * (1 + erfFn((x-mu)/(sigma*Math.sqrt(2))));
      const quantile = (q) => {
        if (!(q > 0 && q < 1)) throw new Error("normal quantile requires 0 < p < 1");
        return mu + sigma * Math.sqrt(2) * erfinv(2*q-1);
      };
      if (op === "pdf") {
        const x = requireField(p, "x", "normal pdf");
        return { distribution: "normal", params: {mean:mu,std:sigma}, x, pdf: pdf(x) };
      }
      if (op === "cdf") {
        const x = requireField(p, "x", "normal cdf");
        return { distribution: "normal", params: {mean:mu,std:sigma}, x, cdf: cdf(x) };
      }
      if (op === "quantile") {
        const q = requireField(p, "p", "normal quantile");
        return { distribution: "normal", params: {mean:mu,std:sigma}, p: q, quantile: quantile(q) };
      }
      if (op === "mean") return { distribution: "normal", mean: mu };
      if (op === "variance") return { distribution: "normal", variance: sigma*sigma };
      if (op === "sample") {
        const n = requirePositiveInteger(p.n ?? 10, "normal sample n");
        return { distribution: "normal", sample: boxMuller(mu, sigma, n) };
      }
      break;
    }
    case "binomial": {
      const n = requirePositiveInteger(p.n ?? 10, "binomial n");
      const prob = p.p ?? 0.5;
      if (!(prob >= 0 && prob <= 1)) throw new Error("binomial requires 0 <= p <= 1");
      const pmf = (k) => binomialFn(n, k) * Math.pow(prob,k) * Math.pow(1-prob,n-k);
      const cdfVal = (k) => { let s=0; for(let i=0;i<=k;i++) s+=pmf(i); return s; };
      if (op === "pdf") {
        const k = requireField(p, "k", "binomial pdf");
        return { distribution: "binomial", params: {n,p:prob}, k, pdf: pmf(k) };
      }
      if (op === "cdf") {
        const k = requireField(p, "k", "binomial cdf");
        return { distribution: "binomial", params: {n,p:prob}, k, cdf: cdfVal(k) };
      }
      if (op === "mean") return { distribution: "binomial", mean: n*prob };
      if (op === "variance") return { distribution: "binomial", variance: n*prob*(1-prob) };
      break;
    }
    case "poisson": {
      const lambda = p.lambda ?? 1;
      if (!(lambda > 0)) throw new Error("poisson requires lambda > 0");
      const pmf = (k) => Math.exp(-lambda) * Math.pow(lambda,k) / gammaFn(k+1);
      const cdfVal = (k) => { let s=0; for(let i=0;i<=k;i++) s+=pmf(i); return s; };
      if (op === "pdf") {
        const k = requireField(p, "k", "poisson pdf");
        return { distribution: "poisson", params: {lambda}, k, pdf: pmf(k) };
      }
      if (op === "cdf") {
        const k = requireField(p, "k", "poisson cdf");
        return { distribution: "poisson", params: {lambda}, k, cdf: cdfVal(k) };
      }
      if (op === "mean") return { distribution: "poisson", mean: lambda };
      if (op === "variance") return { distribution: "poisson", variance: lambda };
      if (op === "sample") {
        const n = requirePositiveInteger(p.n ?? 10, "poisson sample n");
        const sample = [];
        for (let i = 0; i < n; i++) {
          const l = Math.exp(-lambda);
          let k = 0;
          let product = 1;
          do {
            k++;
            product *= Math.random();
          } while (product > l);
          sample.push(k - 1);
        }
        return { distribution: "poisson", params: {lambda}, sample };
      }
      break;
    }
    case "exponential": {
      const lambda = p.lambda ?? 1;
      if (!(lambda > 0)) throw new Error("exponential requires lambda > 0");
      const pdf = (x) => x >= 0 ? lambda * Math.exp(-lambda*x) : 0;
      const cdf = (x) => x >= 0 ? 1 - Math.exp(-lambda*x) : 0;
      if (op === "pdf") {
        const x = requireField(p, "x", "exponential pdf");
        return { distribution: "exponential", params: {lambda}, x, pdf: pdf(x) };
      }
      if (op === "cdf") {
        const x = requireField(p, "x", "exponential cdf");
        return { distribution: "exponential", params: {lambda}, x, cdf: cdf(x) };
      }
      if (op === "mean") return { distribution: "exponential", mean: 1/lambda };
      if (op === "variance") return { distribution: "exponential", variance: 1/(lambda*lambda) };
      break;
    }
    case "chi2": {
      const k = requirePositiveInteger(p.df ?? 1, "chi2 df");
      const pdf = (x) => x > 0 ? Math.pow(x,k/2-1)*Math.exp(-x/2)/(Math.pow(2,k/2)*gammaFn(k/2)) : 0;
      if (op === "pdf") {
        const x = requireField(p, "x", "chi2 pdf");
        return { distribution: "chi2", params: {df:k}, x, pdf: pdf(x) };
      }
      if (op === "mean") return { distribution: "chi2", mean: k };
      if (op === "variance") return { distribution: "chi2", variance: 2*k };
      break;
    }
    case "t": {
      const df = requirePositiveInteger(p.df ?? 1, "t distribution df");
      const pdf = (x) => {
        const num = gammaFn((df+1)/2);
        const den = Math.sqrt(df*Math.PI)*gammaFn(df/2);
        return (num/den)*Math.pow(1+x*x/df, -(df+1)/2);
      };
      if (op === "pdf") {
        const x = requireField(p, "x", "t pdf");
        return { distribution: "t", params: {df}, x, pdf: pdf(x) };
      }
      if (op === "mean") return { distribution: "t", mean: df > 1 ? 0 : undefined };
      if (op === "variance") return { distribution: "t", variance: df > 2 ? df/(df-2) : undefined };
      break;
    }
    case "uniform": {
      const a = p.a ?? 0;
      const b = p.b ?? 1;
      if (!(b > a)) throw new Error("uniform requires b > a");
      const pdf = (x) => (x >= a && x <= b) ? 1/(b-a) : 0;
      const cdf = (x) => x < a ? 0 : (x > b ? 1 : (x-a)/(b-a));
      if (op === "pdf") {
        const x = requireField(p, "x", "uniform pdf");
        return { distribution: "uniform", params: {a,b}, x, pdf: pdf(x) };
      }
      if (op === "cdf") {
        const x = requireField(p, "x", "uniform cdf");
        return { distribution: "uniform", params: {a,b}, x, cdf: cdf(x) };
      }
      if (op === "mean") return { distribution: "uniform", mean: (a+b)/2 };
      if (op === "variance") return { distribution: "uniform", variance: (b-a)**2/12 };
      break;
    }
  }
  throw new Error(`Unsupported distribution/operation: ${dist}/${op}`);
}

function calcHypothesisTest(args) {
  const test = args.test;
  const p = args.params || {};

  switch (test) {
    case "z_test": {
      const sample_mean = requireField(p, "sample_mean", "z_test");
      const mu0 = requireField(p, "mu0", "z_test");
      const sigma = requireField(p, "sigma", "z_test");
      const n = requirePositiveInteger(requireField(p, "n", "z_test"), "z_test n");
      const alpha = p.alpha || 0.05;
      if (!(sigma > 0)) throw new Error("z_test requires sigma > 0");
      const se = sigma / Math.sqrt(n);
      const z = (sample_mean - mu0) / se;
      const pValue = 2 * (1 - 0.5*(1+erfFn(Math.abs(z)/Math.sqrt(2))));
      const critical = erfinv(1-alpha) * Math.sqrt(2);
      return { test: "z_test", H0: `mu = ${mu0}`, z_statistic: z, p_value: pValue, significant: pValue < alpha, critical_value: critical, conclusion: pValue < alpha ? "Reject H0" : "Fail to reject H0" };
    }
    case "t_test_one_sample": {
      const data = requireArrayField(p, "data", "t_test_one_sample");
      const mu0 = requireField(p, "mu0", "t_test_one_sample");
      const alpha = p.alpha || 0.05;
      const n = data.length;
      const mean = data.reduce((a,b)=>a+b,0)/n;
      const variance = data.reduce((s,x)=>s+(x-mean)**2,0)/(n-1);
      const se = Math.sqrt(variance/n);
      const t = (mean - mu0) / se;
      const df = n - 1;
      const pValue = 2 * (1 - 0.5*(1+erfFn(Math.abs(t)/Math.sqrt(2))));
      return { test: "t_test_one_sample", H0: `mu = ${mu0}`, sample_mean: mean, sample_std: Math.sqrt(variance), t_statistic: t, df, p_value: pValue, significant: pValue < alpha, conclusion: pValue < alpha ? "Reject H0" : "Fail to reject H0" };
    }
    case "t_test_two_sample": {
      const data1 = requireArrayField(p, "data1", "t_test_two_sample");
      const data2 = requireArrayField(p, "data2", "t_test_two_sample");
      const alpha = p.alpha || 0.05;
      const n1=data1.length, n2=data2.length;
      const m1=data1.reduce((a,b)=>a+b,0)/n1, m2=data2.reduce((a,b)=>a+b,0)/n2;
      const v1=data1.reduce((s,x)=>s+(x-m1)**2,0)/(n1-1), v2=data2.reduce((s,x)=>s+(x-m2)**2,0)/(n2-1);
      const se = Math.sqrt(v1/n1 + v2/n2);
      const t = (m1 - m2) / se;
      const df = Math.pow(v1/n1+v2/n2,2) / (Math.pow(v1/n1,2)/(n1-1)+Math.pow(v2/n2,2)/(n2-1));
      const pValue = 2 * (1 - 0.5*(1+erfFn(Math.abs(t)/Math.sqrt(2))));
      return { test: "t_test_two_sample", H0: "mu1 = mu2", mean1: m1, mean2: m2, t_statistic: t, df, p_value: pValue, significant: pValue < alpha, conclusion: pValue < alpha ? "Reject H0" : "Fail to reject H0" };
    }
    case "chi2_gof": {
      const observed = requireArrayField(p, "observed", "chi2_gof");
      const expected = requireArrayField(p, "expected", "chi2_gof");
      const alpha = p.alpha || 0.05;
      if (observed.length !== expected.length) throw new Error("chi2_gof requires observed and expected arrays of the same length");
      if (expected.some(v => v <= 0)) throw new Error("chi2_gof requires expected values > 0");
      const chi2 = observed.reduce((s,o,i) => s + (o-expected[i])**2/expected[i], 0);
      const df = observed.length - 1;
      const pValue = 1 - 0.5*(1+erfFn(Math.sqrt(chi2/2)));
      return { test: "chi2_gof", chi2_statistic: chi2, df, p_value: pValue, significant: pValue < alpha, conclusion: pValue < alpha ? "Reject H0" : "Fail to reject H0" };
    }
  }
  throw new Error(`Unknown test: ${test}`);
}

function calcConfidenceInterval(args) {
  const type = args.type;
  const confidence = args.confidence || 0.95;
  const alpha = 1 - confidence;
  const z = erfinv(1-alpha/2) * Math.sqrt(2); // z_{alpha/2}

  switch (type) {
    case "mean_z": {
      const { data, sigma } = args;
      const n = data.length;
      const mean = data.reduce((a,b)=>a+b,0)/n;
      const se = sigma / Math.sqrt(n);
      const margin = z * se;
      return { type: "mean (known sigma)", confidence, mean, margin, lower: mean-margin, upper: mean+margin, sigma, n };
    }
    case "mean_t": {
      const data = args.data;
      const n = data.length;
      const mean = data.reduce((a,b)=>a+b,0)/n;
      const std = Math.sqrt(data.reduce((s,x)=>s+(x-mean)**2,0)/(n-1));
      const se = std / Math.sqrt(n);
      // Approximate t critical value
      const t_crit = z; // Use z as approximation for large n, reasonable for moderate n
      const margin = t_crit * se;
      return { type: "mean (t-distribution)", confidence, mean, std, margin, lower: mean-margin, upper: mean+margin, df: n-1, n };
    }
    case "proportion": {
      const { p: phat, n } = args;
      const se = Math.sqrt(phat*(1-phat)/n);
      const margin = z * se;
      return { type: "proportion", confidence, proportion: phat, margin, lower: phat-margin, upper: phat+margin, n };
    }
    case "variance": {
      const data = args.data || [];
      const n = data.length || args.n;
      const std = args.sample_std || (data.length ? Math.sqrt(data.reduce((s,x)=>s+(x-data.reduce((a,b)=>a+b,0)/n)**2,0)/(n-1)) : undefined);
      const variance = std * std;
      // Chi-square critical values (approximate)
      const df = n - 1;
      const chi2_upper = df * (1 - 2/(9*df) + z*Math.sqrt(2/(9*df)))**3;
      const chi2_lower = df * (1 - 2/(9*df) - z*Math.sqrt(2/(9*df)))**3;
      return { type: "variance (chi2)", confidence, variance, lower: df*variance/chi2_upper, upper: df*variance/chi2_lower, df, n };
    }
  }
  throw new Error(`Unknown CI type: ${type}`);
}

export { calcProbability, calcHypothesisTest, calcConfidenceInterval };
