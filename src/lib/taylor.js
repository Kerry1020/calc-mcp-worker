// Taylor-mode automatic differentiation over the expression AST.
//
// Each node evaluates to a truncated power series [c0, c1, ..., cN] in (x - x0),
// where ck = f^(k)(x0) / k!. This yields Taylor coefficients to machine
// precision instead of the (badly conditioned) repeated finite differences.
import { evaluate } from './expression.js';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const zeros = (N) => new Array(N).fill(0);
const constant = (c, N) => { const s = zeros(N); s[0] = c; return s; };
const isConst = (a) => a.every((v, k) => k === 0 || v === 0);

const add = (a, b) => a.map((v, k) => v + b[k]);
const sub = (a, b) => a.map((v, k) => v - b[k]);
const scale = (a, c) => a.map(v => v * c);

function mul(a, b) {
  const N = a.length, c = zeros(N);
  for (let k = 0; k < N; k++) {
    let s = 0;
    for (let j = 0; j <= k; j++) s += a[j] * b[k - j];
    c[k] = s;
  }
  return c;
}

function div(a, b) {
  if (b[0] === 0) throw new Error('Taylor expansion hits a division by zero at x0');
  const N = a.length, c = zeros(N);
  for (let k = 0; k < N; k++) {
    let s = a[k];
    for (let j = 0; j < k; j++) s -= c[j] * b[k - j];
    c[k] = s / b[0];
  }
  return c;
}

function exp(a) {
  const N = a.length, b = zeros(N);
  b[0] = Math.exp(a[0]);
  for (let k = 1; k < N; k++) {
    let s = 0;
    for (let j = 1; j <= k; j++) s += j * a[j] * b[k - j];
    b[k] = s / k;
  }
  return b;
}

function ln(a) {
  if (!(a[0] > 0)) throw new Error('Taylor expansion requires a positive logarithm argument at x0');
  const N = a.length, b = zeros(N);
  b[0] = Math.log(a[0]);
  for (let k = 1; k < N; k++) {
    let s = 0;
    for (let j = 1; j < k; j++) s += j * b[j] * a[k - j];
    b[k] = (a[k] - s / k) / a[0];
  }
  return b;
}

function sinCos(a, hyperbolic = false) {
  const N = a.length, s = zeros(N), c = zeros(N);
  s[0] = hyperbolic ? Math.sinh(a[0]) : Math.sin(a[0]);
  c[0] = hyperbolic ? Math.cosh(a[0]) : Math.cos(a[0]);
  for (let k = 1; k < N; k++) {
    let ss = 0, cc = 0;
    for (let j = 1; j <= k; j++) { ss += j * a[j] * c[k - j]; cc += j * a[j] * s[k - j]; }
    s[k] = ss / k;
    c[k] = (hyperbolic ? cc : -cc) / k;
  }
  return [s, c];
}

function powConst(a, p) {
  const N = a.length;
  if (Number.isInteger(p) && p >= 0 && p <= 1024) {
    let result = constant(1, N), base = a, n = p;
    while (n > 0) { if (n & 1) result = mul(result, base); base = mul(base, base); n >>= 1; }
    return result;
  }
  if (a[0] === 0) throw new Error('Taylor expansion of x^p is not analytic at x0 = 0 for this exponent');
  if (a[0] < 0 && !Number.isInteger(p)) throw new Error('Taylor expansion of a negative base to a non-integer power is not real');
  const b = zeros(N);
  b[0] = Math.pow(a[0], p);
  for (let k = 1; k < N; k++) {
    let s = 0;
    for (let j = 1; j <= k; j++) s += (p * j - k + j) * a[j] * b[k - j];
    b[k] = s / (k * a[0]);
  }
  return b;
}

const derivative = (a) => a.map((_, k) => (k + 1 < a.length ? (k + 1) * a[k + 1] : 0));
const integrate = (g, c0) => g.map((_, k) => (k === 0 ? c0 : g[k - 1] / k));
/** b with b(x0) = b0 and b' = a' * g */
const chain = (a, g, b0) => integrate(mul(derivative(a), g), b0);

function unsupported(name) {
  throw new Error(`calc_taylor does not support ${name}() of an x-dependent argument`);
}

const UNARY = {
  exp, ln,
  sin: a => sinCos(a)[0],
  cos: a => sinCos(a)[1],
  tan: a => { const [s, c] = sinCos(a); return div(s, c); },
  sec: a => div(constant(1, a.length), sinCos(a)[1]),
  csc: a => div(constant(1, a.length), sinCos(a)[0]),
  cot: a => { const [s, c] = sinCos(a); return div(c, s); },
  sinh: a => sinCos(a, true)[0],
  cosh: a => sinCos(a, true)[1],
  tanh: a => { const [s, c] = sinCos(a, true); return div(s, c); },
  sqrt: a => powConst(a, 0.5),
  cbrt: a => (a[0] < 0 ? scale(powConst(scale(a, -1), 1 / 3), -1) : powConst(a, 1 / 3)),
  log: a => scale(ln(a), 1 / Math.LN10),
  log10: a => scale(ln(a), 1 / Math.LN10),
  log2: a => scale(ln(a), 1 / Math.LN2),
  abs: a => {
    if (a[0] === 0) throw new Error('abs() is not differentiable at x0');
    return a[0] > 0 ? a : scale(a, -1);
  },
  atan: a => chain(a, div(constant(1, a.length), add(constant(1, a.length), mul(a, a))), Math.atan(a[0])),
  asin: a => chain(a, powConst(sub(constant(1, a.length), mul(a, a)), -0.5), Math.asin(a[0])),
  acos: a => chain(a, scale(powConst(sub(constant(1, a.length), mul(a, a)), -0.5), -1), Math.acos(a[0])),
  asinh: a => chain(a, powConst(add(constant(1, a.length), mul(a, a)), -0.5), Math.asinh(a[0])),
  acosh: a => chain(a, powConst(sub(mul(a, a), constant(1, a.length)), -0.5), Math.acosh(a[0])),
  atanh: a => chain(a, div(constant(1, a.length), sub(constant(1, a.length), mul(a, a))), Math.atanh(a[0])),
  erf: a => chain(a, scale(exp(scale(mul(a, a), -1)), 2 / Math.sqrt(Math.PI)), evaluate({ type: 'call', name: 'erf', args: [{ type: 'num', value: a[0] }] })),
  rad: a => scale(a, Math.PI / 180),
  deg: a => scale(a, 180 / Math.PI),
  floor: a => constant(Math.floor(a[0]), a.length),
  ceil: a => constant(Math.ceil(a[0]), a.length),
  round: a => constant(Math.round(a[0]), a.length),
  sign: a => constant(Math.sign(a[0]), a.length),
  re: a => a,
};
UNARY.sinh_inv = UNARY.asinh;

function power(a, b) {
  if (isConst(b)) return powConst(a, b[0]);
  return exp(mul(b, ln(a)));
}

function series(node, ctx) {
  const N = ctx.N;
  switch (node.type) {
    case 'num': return constant(node.value, N);
    case 'id': {
      if (node.value === ctx.variable) { const s = constant(ctx.x0, N); if (N > 1) s[1] = 1; return s; }
      const v = evaluate(node, ctx.vars);
      if (typeof v !== 'number') throw new Error(`calc_taylor supports real-valued expressions only (${node.value} is not real)`);
      return constant(v, N);
    }
    case 'neg': return scale(series(node.arg, ctx), -1);
    case 'abs': return UNARY.abs(series(node.arg, ctx));
    case 'binop': {
      const a = series(node.left, ctx), b = series(node.right, ctx);
      switch (node.op) {
        case '+': return add(a, b);
        case '-': return sub(a, b);
        case '*': return mul(a, b);
        case '/': return div(a, b);
        case '^': return power(a, b);
        case '%':
          if (!isConst(b)) unsupported('%');
          if (isConst(a)) return constant(a[0] % b[0], N);
          return [a[0] % b[0], ...a.slice(1)];
      }
      throw new Error(`Unknown operator: ${node.op}`);
    }
    case 'postfix':
    case 'call': {
      const argNodes = node.type === 'call' ? node.args : [node.arg];
      const args = argNodes.map(a => series(a, ctx));
      if (args.every(isConst)) {
        // Every argument is constant in x: evaluate normally.
        const v = evaluate({ ...node, ...(node.type === 'call' ? { args: args.map(a => ({ type: 'num', value: a[0] })) } : { arg: { type: 'num', value: args[0][0] } }) }, ctx.vars);
        if (typeof v !== 'number') throw new Error('calc_taylor supports real-valued expressions only');
        return constant(v, N);
      }
      if (node.type === 'postfix') unsupported('factorial');
      const name = node.name;
      if (name === 'pow' && args.length === 2) return power(args[0], args[1]);
      if (name === 'log' && args.length === 2) return div(ln(args[0]), ln(args[1]));
      if (name === 'atan2' && args.length === 2) {
        const [y, x] = args;
        const g = div(constant(1, N), add(mul(x, x), mul(y, y)));
        const num = sub(mul(x, derivative(y)), mul(y, derivative(x)));
        return integrate(mul(num, g), Math.atan2(y[0], x[0]));
      }
      if ((name === 'max' || name === 'min') && args.length === 2) {
        const [a, b] = args;
        if (a[0] === b[0]) throw new Error(`${name}() is not differentiable at x0`);
        return (name === 'max') === (a[0] > b[0]) ? a : b;
      }
      if (args.length === 1 && hasOwn(UNARY, name)) return UNARY[name](args[0]);
      return unsupported(name);
    }
    case 'array': throw new Error('calc_taylor does not support arrays');
    default: throw new Error(`Unknown node type: ${node.type}`);
  }
}

/** Taylor coefficients c0..c_order of the compiled AST around x0. */
export function taylorCoefficients(ast, x0, order, vars = {}, variable = 'x') {
  const scope = Object.assign(Object.create(null), vars);
  const coeffs = series(ast, { N: order + 1, x0, vars: scope, variable });
  coeffs.forEach((c, k) => { if (!Number.isFinite(c)) throw new Error(`Taylor coefficient ${k} is not finite at x0 = ${x0}`); });
  return coeffs;
}
