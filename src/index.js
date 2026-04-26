// calc-mcp-worker — High-performance math computation MCP server
// Supports: batch eval, constants, complex, calculus, Newton, series, matrices, statistics, units, CAS

const SERVER_NAME = "calc-mcp-worker";
const SERVER_VERSION = "1.0.0";
const NUMERIC_EPSILON = 1e-12;
const MATRIX_EPSILON = 1e-12;

// ============================================================
// CONSTANTS — physics, math, chemistry, astronomy
// ============================================================
const CONSTANTS = {
  // Math
  pi: Math.PI, PI: Math.PI,
  e: Math.E, E: Math.E,
  phi: (1 + Math.sqrt(5)) / 2, // golden ratio
  euler_gamma: 0.5772156649015329,
  catalan: 0.9159655941772190,
  apery: 1.2020569031595943,
  ln2: Math.LN2, ln10: Math.LN10,
  sqrt2: Math.SQRT2, sqrt1_2: Math.SQRT1_2,
  // Physics
  c: 299792458, // speed of light m/s
  h: 6.62607015e-34, // Planck constant
  hbar: 1.054571817e-34, // reduced Planck
  k: 1.380649e-23, // Boltzmann
  G: 6.67430e-11, // gravitational
  g0: 9.80665, // standard gravity
  eV: 1.602176634e-19, // electron volt
  e_charge: 1.602176634e-19, // elementary charge
  m_e: 9.1093837015e-31, // electron mass
  m_p: 1.67262192369e-27, // proton mass
  m_n: 1.67492749804e-27, // neutron mass
  a0: 5.29177210903e-11, // Bohr radius
  sigma: 5.670374419e-8, // Stefan-Boltzmann
  epsilon0: 8.8541878128e-12, // vacuum permittivity
  mu0: 1.25663706212e-6, // vacuum permeability
  R: 8.314462618, // gas constant
  Na: 6.02214076e23, // Avogadro
  F: 96485.33212, // Faraday
  // Astronomy
  au: 1.495978707e11, // astronomical unit m
  ly: 9.460730473e15, // light year m
  pc: 3.085677581e16, // parsec m
  M_sun: 1.98847e30, // solar mass kg
  R_earth: 6.371e6, // Earth radius m
  M_earth: 5.9722e24, // Earth mass kg
  // Chemistry
  u: 1.66053906660e-27, // atomic mass unit
  // Conversion
  inch: 0.0254, foot: 0.3048, mile: 1609.344,
  lb: 0.45359237, kg: 1, oz: 0.028349523125,
  atm: 101325, bar: 1e5,
  hp: 745.7, cal: 4.184,
  km: 1000, m: 1, cm: 0.01, mm: 0.001,
  yard: 0.9144, nm: 1852, // nautical mile
  ton: 1000, g: 0.001, mg: 0.000001,
  liter: 0.001, mL: 0.000001, gallon: 0.003785411784,
  mph: 0.44704, kph: 0.277778, knot: 0.514444,
  Pa: 1, kPa: 1000, MPa: 1e6, psi: 6894.757293168,
  J: 1, kJ: 1000, MJ: 1e6, Wh: 3600, kWh: 3.6e6, BTU: 1055.06,
  W: 1, kW: 1000, MW: 1e6,
  Hz: 1, kHz: 1000, MHz: 1e6, GHz: 1e9,
};

// ============================================================
// COMPLEX NUMBER CLASS
// ============================================================
class Complex {
  constructor(re = 0, im = 0) { this.re = re; this.im = im; }
  static from(v) { return v instanceof Complex ? v : new Complex(Number(v), 0); }
  add(b) { b = Complex.from(b); return new Complex(this.re + b.re, this.im + b.im); }
  sub(b) { b = Complex.from(b); return new Complex(this.re - b.re, this.im - b.im); }
  mul(b) { b = Complex.from(b); return new Complex(this.re*b.re - this.im*b.im, this.re*b.im + this.im*b.re); }
  div(b) { b = Complex.from(b); const d = b.re*b.re + b.im*b.im; return new Complex((this.re*b.re+this.im*b.im)/d, (this.im*b.re-this.re*b.im)/d); }
  abs() { return Math.sqrt(this.re*this.re + this.im*this.im); }
  arg() { return Math.atan2(this.im, this.re); }
  conj() { return new Complex(this.re, -this.im); }
  pow(b) { b = Complex.from(b); if (this.re===0&&this.im===0) return new Complex(0); const r=this.abs(), t=this.arg(); const nr=Math.pow(r,b.re)*Math.exp(-b.im*t); const nt=b.re*t+b.im*Math.log(r); return new Complex(nr*Math.cos(nt), nr*Math.sin(nt)); }
  sqrt() { const r=this.abs(), t=this.arg(); return new Complex(Math.sqrt(r)*Math.cos(t/2), Math.sqrt(r)*Math.sin(t/2)); }
  exp() { const er=Math.exp(this.re); return new Complex(er*Math.cos(this.im), er*Math.sin(this.im)); }
  ln() { return new Complex(Math.log(this.abs()), this.arg()); }
  sin() { return new Complex(Math.sin(this.re)*Math.cosh(this.im), Math.cos(this.re)*Math.sinh(this.im)); }
  cos() { return new Complex(Math.cos(this.re)*Math.cosh(this.im), -Math.sin(this.re)*Math.sinh(this.im)); }
  tan() { return this.sin().div(this.cos()); }
  log(b) { return this.ln().div(Complex.from(b||Math.E).ln()); }
  toString() { if (Math.abs(this.im)<1e-15) return `${this.re}`; if (Math.abs(this.re)<1e-15) return `${this.im}i`; return `${this.re}${this.im>=0?'+':''}${this.im}i`; }
}

function factorialNumber(n) {
  if (!Number.isFinite(n)) throw new Error("Factorial requires a finite number");
  if (n < 0 || Math.trunc(n) !== n) throw new Error("Factorial requires a non-negative integer");
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function requireField(obj, field, context) {
  if (obj[field] === undefined || obj[field] === null) throw new Error(`${context} requires ${field}`);
  return obj[field];
}

function requireArrayField(obj, field, context, minLength = 1) {
  const value = requireField(obj, field, context);
  if (!Array.isArray(value) || value.length < minLength) throw new Error(`${context} requires ${field} as an array with at least ${minLength} value${minLength === 1 ? '' : 's'}`);
  return value;
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
  return value;
}

function assertFiniteNumber(value, context) {
  if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`${context} produced NaN`);
  if (!Number.isFinite(value)) throw new Error(`${context} produced a non-finite result`);
  return value;
}

function assertFiniteComputation(value, context) {
  if (value instanceof Complex) {
    assertFiniteNumber(value.re, `${context} real part`);
    assertFiniteNumber(value.im, `${context} imaginary part`);
    return value;
  }
  return assertFiniteNumber(value, context);
}

function evaluateExpr(expr, vars = {}) {
  const { ast } = parseExpr(expr);
  return evaluate(ast, vars);
}

function safeNullableEval(expr, vars) {
  try {
    return evaluateExpr(expr, vars);
  } catch {
    return NaN;
  }
}

// ============================================================
// TOKENIZER + PARSER (handles complex, functions, matrices)
// ============================================================
function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue; }
    // Numbers (including scientific notation)
    if (/[0-9.]/.test(expr[i])) {
      let num = '';
      while (i < expr.length && /[0-9.eE]/.test(expr[i])) { num += expr[i]; i++; if ((expr[i]==='-'||expr[i]==='+') && (num.endsWith('e')||num.endsWith('E'))) { num += expr[i]; i++; } }
      tokens.push({ type: 'num', value: parseFloat(num) });
      continue;
    }
    // Identifiers (vars, functions, constants)
    if (/[a-zA-Z_]/.test(expr[i])) {
      let id = '';
      while (i < expr.length && /[a-zA-Z_0-9]/.test(expr[i])) { id += expr[i]; i++; }
      tokens.push({ type: 'id', value: id });
      continue;
    }
    // Operators and parens
    if ('+-*/^%!'.includes(expr[i])) { tokens.push({ type: 'op', value: expr[i] }); i++; continue; }
    if (expr[i] === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (expr[i] === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
    if (expr[i] === '[') { tokens.push({ type: 'lbracket' }); i++; continue; }
    if (expr[i] === ']') { tokens.push({ type: 'rbracket' }); i++; continue; }
    if (expr[i] === ',') { tokens.push({ type: 'comma' }); i++; continue; }
    if (expr[i] === '|' && (tokens.length===0 || tokens[tokens.length-1].type==='op' || tokens[tokens.length-1].type==='lparen')) { tokens.push({ type: 'abs_open' }); i++; continue; }
    if (expr[i] === '|') { tokens.push({ type: 'abs_close' }); i++; continue; }
    if (expr[i] === '=') { tokens.push({ type: 'eq' }); i++; continue; }
    if (expr[i] === ';') { tokens.push({ type: 'semi' }); i++; continue; }
    i++;
  }
  return tokens;
}

// Pratt parser for expressions
function resolveValue(id) {
  if (id in CONSTANTS) return CONSTANTS[id];
  if (id === 'i') return new Complex(0, 1);
  if (id === 'inf' || id === 'infinity' || id === 'Inf') return Infinity;
  if (id === 'nan' || id === 'NaN') return NaN;
  return undefined;
}

function parseExpr(exprOrTokens, pos = 0) {
  // Auto-tokenize if string input
  const tokens = typeof exprOrTokens === 'string' ? tokenize(exprOrTokens) : exprOrTokens;
  let idx = pos;
  function peek() { return tokens[idx]; }
  function consume() { return tokens[idx++]; }

  const BUILTINS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
    ln: Math.log, log: Math.log10, log2: Math.log2, log10: Math.log10,
    exp: Math.exp, pow: Math.pow,
    ceil: Math.ceil, floor: Math.floor, round: Math.round,
    sign: Math.sign, max: Math.max, min: Math.min,
    factorial: factorialNumber,
    gamma: gammaFn, erf: erfFn,
    sec: x => 1/Math.cos(x), csc: x => 1/Math.sin(x), cot: x => 1/Math.tan(x),
    rad: x => x*Math.PI/180, deg: x => x*180/Math.PI,
    mod: (a,b) => a%b, gcd: gcdFn, lcm: lcmFn,
    binom: binomialFn,
    sinh_inv: x => Math.asinh(x), cosh_inv: x => Math.acosh(x), tanh_inv: x => Math.atanh(x),
    re: z => z instanceof Complex ? z.re : z,
    im: z => z instanceof Complex ? z.im : 0,
    conj: z => z instanceof Complex ? z.conj() : z,
    arg: z => z instanceof Complex ? z.arg() : 0,
    // Statistical
    mean: arr => arr.reduce((a,b)=>a+b,0)/arr.length,
    median: arr => { const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; },
    stdev: arr => { const m=arr.reduce((a,b)=>a+b,0)/arr.length; return Math.sqrt(arr.reduce((s,x)=>s+(x-m)**2,0)/(arr.length-1)); },
    variance: arr => { const m=arr.reduce((a,b)=>a+b,0)/arr.length; return arr.reduce((s,x)=>s+(x-m)**2,0)/(arr.length-1); },
  };



  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error("Unexpected end of expression");

    // Unary minus/plus
    if (t.type === 'op' && t.value === '-') { consume(); return { type: 'neg', arg: parseExpression(3) }; }
    if (t.type === 'op' && t.value === '+') { consume(); return parseExpression(3); }

    // Number literal
    if (t.type === 'num') { consume(); return { type: 'num', value: t.value }; }

    // Absolute value |x|
    if (t.type === 'abs_open') {
      consume();
      const inner = parseExpression(0);
      if (peek()?.type === 'abs_close') consume();
      return { type: 'abs', arg: inner };
    }

    // Matrix [a,b;c,d] or [a,b,c]
    if (t.type === 'lbracket') {
      consume();
      const elements = [];
      while (peek() && peek().type !== 'rbracket') {
        elements.push(parseExpression(0));
        if (peek()?.type === 'comma') consume();
        else if (peek()?.type === 'semi') consume();
      }
      if (peek()?.type === 'rbracket') consume();
      return { type: 'array', elements };
    }

    // Function call or identifier
    if (t.type === 'id') {
      const id = consume().value;
      // Function call
      if (peek()?.type === 'lparen') {
        consume();
        const args = [];
        while (peek() && peek().type !== 'rparen') {
          args.push(parseExpression(0));
          if (peek()?.type === 'comma') consume();
        }
        if (peek()?.type === 'rparen') consume();
        return { type: 'call', name: id, args };
      }
      // Implicit multiplication: 2pi, 3i
      return { type: 'id', value: id };
    }

    // Parenthesized expression
    if (t.type === 'lparen') {
      consume();
      const expr = parseExpression(0);
      if (peek()?.type === 'rparen') consume();
      return expr;
    }

    throw new Error(`Unexpected token: ${JSON.stringify(t)}`);
  }

  function parsePostfix() {
    let node = parsePrimary();
    while (peek()?.type === 'op' && peek().value === '!') {
      consume();
      node = { type: 'postfix', op: '!', arg: node };
    }
    return node;
  }

  function getOpPrec(op) {
    if (op === '+' || op === '-') return { prec: 1, assoc: 'left' };
    if (op === '*' || op === '/' || op === '%') return { prec: 2, assoc: 'left' };
    if (op === '^') return { prec: 3, assoc: 'right' };
    return { prec: 0, assoc: 'left' };
  }

  function parseExpression(minPrec) {
    let left = parsePostfix();
    // Implicit multiplication: 2pi, 3i, 2(3+4)
    while (peek()) {
      const t = peek();
      if ((t.type === 'id' || t.type === 'lparen' || t.type === 'num' || t.type === 'lbracket' || t.type === 'abs_open') && left.type !== 'op') {
        const right = parsePostfix();
        left = { type: 'binop', op: '*', left, right };
        continue;
      }
      if (t.type !== 'op' || t.value === '!') break;
      const { prec, assoc } = getOpPrec(t.value);
      if (prec < minPrec) break;
      consume();
      const right = parseExpression(assoc === 'right' ? prec : prec + 1);
      left = { type: 'binop', op: t.value, left, right };
    }
    return left;
  }

  const ast = parseExpression(0);
  return { ast, pos: idx };
}

// ============================================================
// EVALUATOR
// ============================================================
function evaluate(node, vars = {}) {
  switch (node.type) {
    case 'num': return node.value;
    case 'id': {
      if (node.value in vars) return vars[node.value];
      const c = resolveValue(node.value);
      if (c !== undefined) return c;
      throw new Error(`Undefined variable: ${node.value}`);
    }
    case 'neg': return -1 * evaluate(node.arg, vars);
    case 'abs': { const v = evaluate(node.arg, vars); return v instanceof Complex ? v.abs() : Math.abs(v); }
    case 'postfix': {
      const v = evaluate(node.arg, vars);
      if (node.op === '!') return factorialNumber(v);
      throw new Error(`Unknown postfix operator: ${node.op}`);
    }
    case 'binop': {
      const l = evaluate(node.left, vars);
      const r = evaluate(node.right, vars);
      switch (node.op) {
        case '+': return l instanceof Complex || r instanceof Complex ? Complex.from(l).add(r) : l+r;
        case '-': return l instanceof Complex || r instanceof Complex ? Complex.from(l).sub(r) : l-r;
        case '*': return l instanceof Complex || r instanceof Complex ? Complex.from(l).mul(r) : l*r;
        case '/': return l instanceof Complex || r instanceof Complex ? Complex.from(l).div(r) : l/r;
        case '^': return l instanceof Complex || r instanceof Complex ? Complex.from(l).pow(r) : Math.pow(l,r);
        case '%': return l%r;
      }
    }
    case 'call': {
      const fn = BUILTINS_FROM_PARSER[node.name];
      if (!fn) throw new Error(`Unknown function: ${node.name}`);
      const args = node.args.map(a => evaluate(a, vars));
      return fn(...args);
    }
    case 'matrix': return node.rows.map(row => row.map(cell => evaluate(cell, vars)));
    case 'array': return node.elements.map(e => evaluate(e, vars));
    default: throw new Error(`Unknown node type: ${node.type}`);
  }
}

const BUILTINS_FROM_PARSER = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
  sqrt: x => x instanceof Complex ? x.sqrt() : Math.sqrt(x),
  cbrt: Math.cbrt, abs: x => x instanceof Complex ? x.abs() : Math.abs(x),
  ln: x => x instanceof Complex ? x.ln() : Math.log(x),
  log: x => x instanceof Complex ? x.log(10) : Math.log10(x),
  log2: Math.log2, log10: Math.log10,
  exp: x => x instanceof Complex ? x.exp() : Math.exp(x),
  ceil: Math.ceil, floor: Math.floor, round: Math.round,
  sign: Math.sign,
  max: Math.max, min: Math.min,
  factorial: n => { let r=1; for(let i=2;i<=n;i++)r*=i; return r; },
  gamma: gammaFn, erf: erfFn,
  sec: x => 1/Math.cos(x), csc: x => 1/Math.sin(x), cot: x => 1/Math.tan(x),
  rad: x => x*Math.PI/180, deg: x => x*180/Math.PI,
  mod: (a,b) => a%b, gcd: gcdFn, lcm: lcmFn,
  binom: binomialFn,
  re: z => z instanceof Complex ? z.re : z,
  im: z => z instanceof Complex ? z.im : 0,
  conj: z => z instanceof Complex ? z.conj() : z,
  arg: z => z instanceof Complex ? z.arg() : 0,
  mean: arr => Array.isArray(arr) ? arr.flat().reduce((a,b)=>a+b,0)/arr.flat().length : arr,
  median: arr => { const s=[...arr.flat()].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; },
  stdev: arr => { const a=arr.flat(); const m=a.reduce((s,x)=>s+x,0)/a.length; return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1)); },
  variance: arr => { const a=arr.flat(); const m=a.reduce((s,x)=>s+x,0)/a.length; return a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1); },
  // Complex versions
  csin: z => Complex.from(z).sin(),
  ccos: z => Complex.from(z).cos(),
  ctan: z => Complex.from(z).tan(),
  csqrt: z => Complex.from(z).sqrt(),
  cexp: z => Complex.from(z).exp(),
  cln: z => Complex.from(z).ln(),
};

// ============================================================
// MATH HELPERS
// ============================================================
function gammaFn(z) {
  // Lanczos approximation
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFn(1 - z));
  z -= 1;
  const g = 7;
  const c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

function erfFn(x) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const t = 1/(1+p*x);
  const y = 1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x);
  return sign*y;
}

function gcdFn(a, b) { a=Math.abs(Math.round(a)); b=Math.abs(Math.round(b)); while(b){[a,b]=[b,a%b];} return a; }
function lcmFn(a, b) { return Math.abs(Math.round(a)*Math.round(b))/gcdFn(a,b); }
function binomialFn(n, k) { if(k<0||k>n)return 0; if(k===0||k===n)return 1; k=Math.min(k,n-k); let r=1; for(let i=0;i<k;i++)r=r*(n-i)/(i+1); return Math.round(r); }

// ============================================================
// NUMERICAL METHODS
// ============================================================
function ensureStableNumericEstimate(samples, context) {
  const finite = samples.map(value => assertFiniteNumber(value, context));
  const magnitudes = finite.map(v => Math.abs(v));
  const explosive = magnitudes.length >= 2 && magnitudes.every((m, i, arr) => i === 0 || m >= arr[i - 1] * 100);
  if (explosive) throw new Error(`${context} is unstable near the evaluation point`);

  const tail = finite.slice(-2);
  const spread = Math.abs(tail[0] - tail[1]);
  const scale = Math.max(1, ...tail.map(v => Math.abs(v)));
  if (spread > scale * 1e-3) throw new Error(`${context} is unstable near the evaluation point`);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

function numericalDerivative(expr, x, vars = {}, h = 1e-8) {
  const steps = [h * 10000, h * 100, h];
  const samples = steps.map(step => {
    const v1 = assertFiniteNumber(safeNullableEval(expr, { ...vars, x: x + step }), "Derivative sample");
    const v2 = assertFiniteNumber(safeNullableEval(expr, { ...vars, x: x - step }), "Derivative sample");
    return (v1 - v2) / (2 * step);
  });
  return assertFiniteNumber(ensureStableNumericEstimate(samples, "Derivative"), "Derivative");
}

function numericalIntegral(expr, a, b, vars = {}, n = 10000) {
  const h = (b - a) / n;
  let sum = assertFiniteNumber(safeNullableEval(expr, { ...vars, x: a }), "Integral endpoint") + assertFiniteNumber(safeNullableEval(expr, { ...vars, x: b }), "Integral endpoint");
  for (let i = 1; i < n; i++) {
    const xi = a + i * h;
    sum += (i % 2 === 0 ? 2 : 4) * assertFiniteNumber(safeNullableEval(expr, { ...vars, x: xi }), "Integral sample");
  }
  return assertFiniteNumber(sum * h / 3, "Integral");
}

function numericalIntegral2D(expr, xa, xb, ya, yb, vars = {}, n = 50) {
  const hx = (xb - xa) / n;
  let total = 0;
  for (let i = 0; i <= n; i++) {
    const xi = xa + i * hx;
    const cx = (i === 0 || i === n) ? 1 : (i % 2 === 0 ? 2 : 4);
    const hy = (yb - ya) / n;
    let innerSum = 0;
    for (let j = 0; j <= n; j++) {
      const yj = ya + j * hy;
      const cy = (j === 0 || j === n) ? 1 : (j % 2 === 0 ? 2 : 4);
      innerSum += cy * assertFiniteNumber(safeNullableEval(expr, { ...vars, x: xi, y: yj }), "Double integral sample");
    }
    total += cx * innerSum * hy / 3;
  }
  return assertFiniteNumber(total * hx / 3, "Double integral");
}

function newtonMethod(expr, x0, vars = {}, tol = 1e-12, maxIter = 100) {
  let x = x0;
  const iterations = [];
  for (let i = 0; i < maxIter; i++) {
    const fx = assertFiniteNumber(safeNullableEval(expr, { ...vars, x }), "Newton function value");
    const fpx = numericalDerivative(expr, x, vars);
    if (Math.abs(fpx) < 1e-15) return { root: null, iterations, converged: false, error: "Zero derivative" };
    const xNew = assertFiniteNumber(x - fx / fpx, "Newton iterate");
    iterations.push({ i: i + 1, x, fx, fpx, dx: xNew - x });
    if (Math.abs(xNew - x) < tol) return { root: xNew, iterations, converged: true, iterations_count: i + 1 };
    x = xNew;
  }
  return { root: x, iterations, converged: false, error: "Did not converge" };
}

function bisectionMethod(expr, a, b, vars = {}, tol = 1e-12, maxIter = 100) {
  let fa = assertFiniteNumber(safeNullableEval(expr, { ...vars, x: a }), "Bisection endpoint");
  let fb = assertFiniteNumber(safeNullableEval(expr, { ...vars, x: b }), "Bisection endpoint");
  if (fa * fb > 0) return { root: null, converged: false, error: "f(a) and f(b) have same sign" };
  for (let i = 0; i < maxIter; i++) {
    const c = (a + b) / 2;
    const fc = assertFiniteNumber(safeNullableEval(expr, { ...vars, x: c }), "Bisection sample");
    if (Math.abs(fc) < tol || (b - a) / 2 < tol) return { root: c, converged: true, iterations_count: i + 1 };
    if (fa * fc < 0) { b = c; fb = fc; } else { a = c; fa = fc; }
  }
  return { root: (a + b) / 2, converged: false, error: "Did not converge" };
}

function seriesSum(expr, nStart, nEnd, varName = 'n', vars = {}) {
  let sum = 0;
  const terms = [];
  for (let n = nStart; n <= nEnd; n++) {
    const val = safeNullableEval(expr, { ...vars, [varName]: n });
    sum += val;
    if (n - nStart < 20) terms.push({ n, value: val, partial_sum: sum });
  }
  return { sum, nStart, nEnd, terms, term_count: nEnd - nStart + 1 };
}

function classifyDirectionalLimit(samples) {
  const finite = samples.filter(v => typeof v === 'number' && Number.isFinite(v));
  if (!finite.length) return { classification: 'undefined' };

  const allPositive = finite.every(v => v > 0);
  const allNegative = finite.every(v => v < 0);
  const magnitudes = finite.map(v => Math.abs(v));
  const growingFast = magnitudes.length >= 2 && magnitudes.every((m, i, arr) => i === 0 || m >= arr[i - 1] * 5);
  if (growingFast && allPositive) return { classification: 'infinite', value: Infinity };
  if (growingFast && allNegative) return { classification: 'infinite', value: -Infinity };

  const tail = finite.slice(-3);
  const spread = Math.max(...tail) - Math.min(...tail);
  const scale = Math.max(1, ...tail.map(v => Math.abs(v)));
  if (spread <= scale * 1e-6) {
    return { classification: 'finite', value: tail.reduce((a, b) => a + b, 0) / tail.length };
  }

  return { classification: 'unstable', samples: finite };
}

function limitExpr(expr, approach, fromDir = 'both', vars = {}) {
  const steps = [1e-3, 1e-5, 1e-7, 1e-9];
  const result = { approach, direction: fromDir, method: 'multi-point numerical sampling' };

  if (fromDir === 'left' || fromDir === 'both') {
    const samples = steps.map(h => safeNullableEval(expr, { ...vars, x: approach - h }));
    const classification = classifyDirectionalLimit(samples);
    result.from_left = classification.value !== undefined ? classification.value : null;
    result.from_left_samples = samples;
    result.from_left_classification = classification.classification;
  }

  if (fromDir === 'right' || fromDir === 'both') {
    const samples = steps.map(h => safeNullableEval(expr, { ...vars, x: approach + h }));
    const classification = classifyDirectionalLimit(samples);
    result.from_right = classification.value !== undefined ? classification.value : null;
    result.from_right_samples = samples;
    result.from_right_classification = classification.classification;
  }

  if (fromDir === 'both') {
    if (result.from_left_classification === 'finite' && result.from_right_classification === 'finite') {
      const left = result.from_left;
      const right = result.from_right;
      if (Math.abs(left - right) <= Math.max(1, Math.abs(left), Math.abs(right)) * 1e-6) {
        result.limit = (left + right) / 2;
      }
    } else if (result.from_left_classification === 'infinite' && result.from_right_classification === 'infinite' && result.from_left === result.from_right) {
      result.limit = result.from_left;
    }
  }

  return result;
}

function taylorSeries(expr, x0, order, vars = {}) {
  // Numerical Taylor expansion
  const coeffs = [];
  let factorial = 1;
  for (let n = 0; n <= order; n++) {
    if (n > 0) factorial *= n;
    // nth derivative via finite differences
    const dn = nthDerivative(expr, x0, n, vars);
    coeffs.push({ n, coeff: dn / factorial });
  }
  // Build polynomial string
  const terms = coeffs.map(c => {
    const coeff = c.n === 0 ? c.coeff : c.coeff;
    return `${coeff}*(x-${x0})^${c.n}`;
  });
  return { x0, order, coefficients: coeffs.map(c => c.coeff), polynomial: terms.join(' + ').replace(/\+ -/g, '- ') };
}

function nthDerivative(expr, x0, n, vars = {}, h = 1e-4) {
  if (n === 0) return safeNullableEval(expr, { ...vars, x: x0 });
  // Use finite difference coefficients
  if (n === 1) return numericalDerivative(expr, x0, vars, h);
  // Recursive: d^n/dx^n f(x) ≈ (f^(n-1)(x+h) - f^(n-1)(x-h)) / (2h)
  const deriv = (x) => nthDerivative(expr, x, n - 1, vars, h * 1.5);
  return (deriv(x0 + h) - deriv(x0 - h)) / (2 * h);
}

function eulerMethod(dydx, x0, y0, xEnd, steps, vars = {}) {
  const h = (xEnd - x0) / steps;
  const points = [{ x: x0, y: y0 }];
  let x = x0, y = y0;
  for (let i = 0; i < steps; i++) {
    const slope = safeNullableEval(dydx, { ...vars, x, y });
    y = y + h * slope;
    x = x0 + (i + 1) * h;
    points.push({ x, y });
  }
  return { method: "euler", x0, y0, xEnd, steps, h, points };
}

function rungeKutta4(dydx, x0, y0, xEnd, steps, vars = {}) {
  const h = (xEnd - x0) / steps;
  const points = [{ x: x0, y: y0 }];
  let x = x0, y = y0;
  for (let i = 0; i < steps; i++) {
    const k1 = safeNullableEval(dydx, { ...vars, x, y });
    const k2 = safeNullableEval(dydx, { ...vars, x: x+h/2, y: y+h*k1/2 });
    const k3 = safeNullableEval(dydx, { ...vars, x: x+h/2, y: y+h*k2/2 });
    const k4 = safeNullableEval(dydx, { ...vars, x: x+h, y: y+h*k3 });
    y = y + h*(k1 + 2*k2 + 2*k3 + k4)/6;
    x = x0 + (i+1)*h;
    points.push({ x, y });
  }
  return { method: "rk4", x0, y0, xEnd, steps, h, points };
}

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

// ============================================================
// MCP TOOL DEFINITIONS
// ============================================================
const TOOLS = [
  {
    name: "calc_batch",
    description: "Batch evaluate multiple math expressions in parallel. Supports arithmetic, functions, constants, complex numbers, matrices. Returns all results at once.",
    inputSchema: {
      type: "object",
      properties: {
        expressions: {
          type: "array",
          items: { type: "string" },
          description: "Array of math expressions to evaluate (up to 100)"
        },
        precision: { type: "number", description: "Decimal places for output, default 10" },
        variables: { type: "object", description: "Variable assignments: {\"x\": 3, \"y\": 5}" }
      },
      required: ["expressions"]
    }
  },
  {
    name: "calc_single",
    description: "Evaluate a single math expression. Supports: arithmetic, trig, log, exp, factorial, gamma, erf, complex numbers (use 'i'), matrices ([a,b;c,d]), all constants.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Math expression" },
        variables: { type: "object", description: "Variable assignments" },
        precision: { type: "number", description: "Decimal places, default 10" }
      },
      required: ["expression"]
    }
  },
  {
    name: "calc_derivative",
    description: "Numerical derivative d/dx of an expression at a point. Returns derivative value.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Function f(x), e.g. 'sin(x)*exp(x)'" },
        point: { type: "number", description: "x value to evaluate at" },
        variables: { type: "object" }
      },
      required: ["expression", "point"]
    }
  },
  {
    name: "calc_integral",
    description: "Numerical definite integral ∫f(x)dx from a to b using Simpson's rule. High accuracy.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Integrand f(x)" },
        a: { type: "number", description: "Lower bound" },
        b: { type: "number", description: "Upper bound" },
        n: { type: "number", description: "Subdivisions, default 10000" },
        variables: { type: "object" }
      },
      required: ["expression", "a", "b"]
    }
  },
  {
    name: "calc_double_integral",
    description: "Numerical double integral ∬f(x,y)dxdy over a rectangular region.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Integrand f(x,y)" },
        xa: { type: "number" }, xb: { type: "number" },
        ya: { type: "number" }, yb: { type: "number" },
        n: { type: "number", description: "Subdivisions per axis, default 50" }
      },
      required: ["expression", "xa", "xb", "ya", "yb"]
    }
  },
  {
    name: "calc_solve",
    description: "Solve f(x)=0 using Newton's method. Returns root, iterations, and convergence info.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "f(x) = 0, e.g. 'x^3 - 2*x - 5'" },
        initial_guess: { type: "number", description: "Starting x value" },
        method: { type: "string", enum: ["newton", "bisection"], description: "Solver method, default newton" },
        tol: { type: "number", description: "Tolerance, default 1e-12" },
        max_iter: { type: "number", description: "Max iterations, default 100" },
        a: { type: "number", description: "For bisection: lower bound" },
        b: { type: "number", description: "For bisection: upper bound" }
      },
      required: ["expression"]
    }
  },
  {
    name: "calc_series",
    description: "Sum a series ∑f(n) from n_start to n_end. Returns sum and partial sums.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "General term, e.g. '1/n^2'" },
        n_start: { type: "number", description: "Start index, default 1" },
        n_end: { type: "number", description: "End index" },
        variable: { type: "string", description: "Index variable name, default n" }
      },
      required: ["expression", "n_end"]
    }
  },
  {
    name: "calc_limit",
    description: "Compute numerical limit of f(x) as x approaches a value.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "f(x)" },
        approach: { type: "number", description: "Value x approaches" },
        direction: { type: "string", enum: ["both", "left", "right"], description: "Direction, default both" }
      },
      required: ["expression", "approach"]
    }
  },
  {
    name: "calc_taylor",
    description: "Compute Taylor series expansion of f(x) around x0 to given order.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "f(x)" },
        x0: { type: "number", description: "Center point, default 0" },
        order: { type: "number", description: "Order of expansion, default 5" }
      },
      required: ["expression"]
    }
  },
  {
    name: "calc_ode",
    description: "Solve ODE dy/dx = f(x,y) with initial condition. Euler or RK4 method.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "dy/dx = f(x,y), e.g. '-x*y'" },
        x0: { type: "number", description: "Initial x" },
        y0: { type: "number", description: "Initial y" },
        x_end: { type: "number", description: "End x" },
        steps: { type: "number", description: "Number of steps, default 100" },
        method: { type: "string", enum: ["euler", "rk4"], description: "Method, default rk4" }
      },
      required: ["expression", "x0", "y0", "x_end"]
    }
  },
  {
    name: "calc_matrix",
    description: "Matrix operations: add, sub, mul, det, inv, transpose, trace, eigen. Input as [[a,b],[c,d]].",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["det", "inv", "transpose", "trace", "eigen", "add", "sub", "mul"], description: "Operation" },
        matrix: { type: "string", description: "Matrix A as expression, e.g. [[1,2],[3,4]]" },
        matrix_b: { type: "string", description: "Matrix B (for add/sub/mul)" }
      },
      required: ["operation", "matrix"]
    }
  },
  {
    name: "calc_simplify",
    description: "Numeric simplification/evaluation with substitutions. Not a symbolic CAS.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Expression to simplify" },
        operation: { type: "string", enum: ["evaluate", "expand", "substitute"], description: "Default evaluate. expand/substitute return an unsupported-operation error for free-symbol algebra." },
        substitutions: { type: "object", description: "Variable substitutions" }
      },
      required: ["expression"]
    }
  },
  {
    name: "calc_constants",
    description: "List all available constants or search for specific ones. Returns name, value, and category.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search filter (optional). Returns all if omitted." }
      }
    }
  },
  {
    name: "calc_convert",
    description: "Unit conversion between common units. Supports length, mass, pressure, energy, temperature.",
    inputSchema: {
      type: "object",
      properties: {
        value: { type: "number", description: "Value to convert" },
        from: { type: "string", description: "Source unit" },
        to: { type: "string", description: "Target unit" }
      },
      required: ["value", "from", "to"]
    }
  },
  {
    name: "calc_stats",
    description: "Statistical analysis of a dataset: mean, median, mode, stdev, variance, min, max, quartiles, skewness, kurtosis.",
    inputSchema: {
      type: "object",
      properties: {
        data: { type: "array", items: { type: "number" }, description: "Dataset" }
      },
      required: ["data"]
    }
  },
  {
    name: "calc_base_convert",
    description: "Convert numbers between bases: binary, octal, decimal, hexadecimal, and arbitrary bases.",
    inputSchema: {
      type: "object",
      properties: {
        value: { type: "string", description: "Number to convert" },
        from_base: { type: "number", description: "Source base (2-36), default 10" },
        to_base: { type: "number", description: "Target base (2-36), default 10" }
      },
      required: ["value"]
    }
  },
  {
    name: "calc_prime",
    description: "Prime number operations: test if prime, factorize, nth prime, primes in range, prime counting function.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["is_prime", "factorize", "nth_prime", "primes_in_range", "prime_count", "next_prime", "prev_prime"], description: "Operation" },
        n: { type: "number", description: "Input number" },
        b: { type: "number", description: "Upper bound for range operations" }
      },
      required: ["operation", "n"]
    }
  },
  {
    name: "calc_plot_data",
    description: "Generate x,y data points for plotting a function. Returns arrays suitable for charting.",
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "f(x) to plot" },
        x_min: { type: "number", description: "X range start" },
        x_max: { type: "number", description: "X range end" },
        points: { type: "number", description: "Number of points, default 100" },
        variables: { type: "object" }
      },
      required: ["expression", "x_min", "x_max"]
    }
  },
  {
    name: "calc_least_squares",
    description: "Linear least squares regression y=ax+b. Returns slope, intercept, R², residuals.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "array", items: { type: "number" }, description: "X data points" },
        y: { type: "array", items: { type: "number" }, description: "Y data points" },
        degree: { type: "number", description: "Polynomial degree: 1=linear, 2=quadratic, etc. Default 1." }
      },
      required: ["x", "y"]
    }
  },
  {
    name: "calc_probability",
    description: "Probability distributions: normal CDF/PDF, binomial, poisson, uniform, exponential, chi-square, t-distribution.",
    inputSchema: {
      type: "object",
      properties: {
        distribution: { type: "string", enum: ["normal", "binomial", "poisson", "exponential", "uniform", "chi2", "t"], description: "Distribution type" },
        operation: { type: "string", enum: ["pdf", "cdf", "quantile", "mean", "variance", "sample"], description: "Operation" },
        params: { type: "object", description: "Distribution parameters" }
      },
      required: ["distribution", "operation"]
    }
  },
  {
    name: "calc_hypothesis_test",
    description: "Hypothesis testing: z-test, t-test (one-sample, two-sample), chi-square goodness of fit.",
    inputSchema: {
      type: "object",
      properties: {
        test: { type: "string", enum: ["z_test", "t_test_one_sample", "t_test_two_sample", "chi2_gof"], description: "Test type" },
        params: { type: "object", description: "Test parameters" }
      },
      required: ["test", "params"]
    }
  },
  {
    name: "calc_confidence_interval",
    description: "Confidence intervals for mean (z or t), proportion, and variance.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["mean_z", "mean_t", "proportion", "variance"], description: "CI type" },
        data: { type: "array", items: { type: "number" }, description: "Sample data (for mean_z, mean_t, variance)" },
        confidence: { type: "number", description: "Confidence level 0-1, default 0.95" },
        sample_mean: { type: "number", description: "For proportion/variance" },
        sample_std: { type: "number" },
        n: { type: "number", description: "Sample size" },
        p: { type: "number", description: "Proportion (for proportion CI)" },
        sigma: { type: "number", description: "Known population std (for mean_z)" }
      },
      required: ["type"]
    }
  },
  {
    name: "calc_anova",
    description: "One-way ANOVA: test if means of multiple groups are equal. Returns F-statistic, p-value, SS between/within.",
    inputSchema: {
      type: "object",
      properties: {
        groups: { type: "array", items: { type: "array", items: { type: "number" } }, description: "Array of groups" }
      },
      required: ["groups"]
    }
  },
  {
    name: "calc_correlation",
    description: "Correlation and regression: Pearson r, Spearman rho, covariance, Kendall tau.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "array", items: { type: "number" } },
        y: { type: "array", items: { type: "number" } },
        method: { type: "string", enum: ["pearson", "spearman", "covariance", "kendall"], description: "Default pearson" }
      },
      required: ["x", "y"]
    }
  },
  {
    name: "health",
    description: "Health check.",
    inputSchema: { type: "object", properties: {} }
  }
];

// ============================================================
// TOOL HANDLERS
// ============================================================
function formatNumber(n, precision = 10) {
  if (n instanceof Complex) return n.toString();
  if (Array.isArray(n)) {
    if (Array.isArray(n[0])) return n.map(row => row.map(v => formatNumber(v, precision)));
    return n.map(v => formatNumber(v, precision));
  }
  if (typeof n !== 'number') return String(n);
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  if (Math.abs(n) < 1e-15) return '0';
  if (Math.abs(n) > 1e12 || Math.abs(n) < 1e-6) return n.toExponential(precision);
  return parseFloat(n.toPrecision(precision)).toString();
}

async function callTool(params) {
  const { name, arguments: args } = params;
  switch (name) {
    case "calc_batch": return calcBatch(args);
    case "calc_single": return calcSingle(args);
    case "calc_derivative": return calcDerivative(args);
    case "calc_integral": return calcIntegral(args);
    case "calc_double_integral": return calcDoubleIntegral(args);
    case "calc_solve": return calcSolve(args);
    case "calc_series": return calcSeries(args);
    case "calc_limit": return calcLimit(args);
    case "calc_taylor": return calcTaylor(args);
    case "calc_ode": return calcOde(args);
    case "calc_matrix": return calcMatrix(args);
    case "calc_simplify": return calcSimplify(args);
    case "calc_constants": return calcConstants(args);
    case "calc_convert": return calcConvert(args);
    case "calc_stats": return calcStats(args);
    case "calc_base_convert": return calcBaseConvert(args);
    case "calc_prime": return calcPrime(args);
    case "calc_plot_data": return calcPlotData(args);
    case "calc_least_squares":
      return toolResult(await calcLeastSquares(args));
    case "calc_probability":
      return toolResult(calcProbability(args));
    case "calc_hypothesis_test":
      return toolResult(calcHypothesisTest(args));
    case "calc_confidence_interval":
      return toolResult(calcConfidenceInterval(args));
    case "calc_anova":
      return toolResult(calcAnova(args));
    case "calc_correlation":
      return toolResult(calcCorrelation(args));
    case "health": return toolResult({ status: "ok", version: SERVER_VERSION, tools: TOOLS.length });
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

function calcBatch(args) {
  const exprs = args.expressions || [];
  if (exprs.length > 100) throw new Error("Max 100 expressions per batch");
  const precision = args.precision || 10;
  const vars = args.variables || {};
  const results = exprs.map(expr => {
    try {
      const val = assertFiniteComputation(evaluateExpr(expr, vars), `Expression ${expr}`);
      return { expression: expr, result: formatNumber(val, precision), error: null };
    } catch (e) {
      return { expression: expr, result: null, error: e.message };
    }
  });
  return toolResult({ batch: results, count: results.length });
}

function calcSingle(args) {
  const precision = args.precision || 10;
  const vars = args.variables || {};
  const val = assertFiniteComputation(evaluateExpr(args.expression, vars), `Expression ${args.expression}`);
  return toolResult({ expression: args.expression, result: formatNumber(val, precision), type: typeof val === 'object' && val instanceof Complex ? 'complex' : typeof val });
}

function calcDerivative(args) {
  const vars = args.variables || {};
  try {
    const result = numericalDerivative(args.expression, args.point, vars);
    return toolResult({ expression: `d/dx [${args.expression}]`, at: `x = ${args.point}`, derivative: formatNumber(result) });
  } catch (e) {
    return toolResult({ expression: `d/dx [${args.expression}]`, at: `x = ${args.point}`, error: e.message });
  }
}

function calcIntegral(args) {
  const vars = args.variables || {};
  const n = args.n || 10000;
  const result = numericalIntegral(args.expression, args.a, args.b, vars, n);
  return toolResult({ expression: `∫[${args.a},${args.b}] ${args.expression} dx`, result: formatNumber(result), method: "Simpson's rule", subdivisions: n });
}

function calcDoubleIntegral(args) {
  const n = args.n || 50;
  const result = numericalIntegral2D(args.expression, args.xa, args.xb, args.ya, args.yb, {}, n);
  return toolResult({ expression: `∬[${args.xa},${args.xb}]×[${args.ya},${args.yb}] ${args.expression} dxdy`, result: formatNumber(result), subdivisions_per_axis: n });
}

function calcSolve(args) {
  const vars = args.variables || {};
  const method = args.method || "newton";
  let result;
  try {
    if (method === "bisection") {
      if (args.a === undefined || args.b === undefined) throw new Error("Bisection requires a and b bounds");
      result = bisectionMethod(args.expression, args.a, args.b, vars, args.tol);
    } else {
      const x0 = args.initial_guess !== undefined ? args.initial_guess : 1;
      result = newtonMethod(args.expression, x0, vars, args.tol, args.max_iter);
    }
  } catch (e) {
    result = { root: null, converged: false, error: e.message };
  }
  return toolResult({ expression: `${args.expression} = 0`, method, ...result });
}

function calcSeries(args) {
  const nStart = args.n_start || 1;
  const variable = args.variable || "n";
  const result = seriesSum(args.expression, nStart, args.n_end, variable);
  return toolResult({ expression: `∑(${variable}=${nStart} to ${args.n_end}) ${args.expression}`, ...result });
}

function calcLimit(args) {
  const result = limitExpr(args.expression, args.approach, args.direction || "both");
  if (result.from_left !== undefined && result.from_left !== null) result.from_left = formatNumber(result.from_left);
  if (result.from_right !== undefined && result.from_right !== null) result.from_right = formatNumber(result.from_right);
  if (result.limit !== undefined && result.limit !== null) result.limit = formatNumber(result.limit);
  return toolResult({ expression: `lim(x→${args.approach}) ${args.expression}`, ...result });
}

function calcTaylor(args) {
  const x0 = args.x0 || 0;
  const order = args.order || 5;
  const result = taylorSeries(args.expression, x0, order);
  return toolResult({ expression: `Taylor expansion of ${args.expression}`, ...result });
}

function calcOde(args) {
  const method = args.method || "rk4";
  const steps = args.steps || 100;
  let result;
  if (method === "euler") {
    result = eulerMethod(args.expression, args.x0, args.y0, args.x_end, steps);
  } else {
    result = rungeKutta4(args.expression, args.x0, args.y0, args.x_end, steps);
  }
  result.points.forEach(point => {
    assertFiniteNumber(point.x, "ODE x");
    assertFiniteNumber(point.y, "ODE y");
  });
  const stride = Math.max(1, Math.floor(result.points.length / 50));
  result.points = result.points.filter((_, i) => i % stride === 0 || i === result.points.length - 1);
  return toolResult({ expression: `dy/dx = ${args.expression}`, ...result });
}

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

function calcSimplify(args) {
  const vars = args.substitutions || {};
  const operation = args.operation || "evaluate";
  const hasFreeSymbol = /[a-zA-Z_][a-zA-Z0-9_]*/.test(args.expression) && Object.keys(vars).length === 0;
  if (operation !== "evaluate") {
    return toolResult({ expression: args.expression, operation, error: `Operation ${operation} is not supported without a symbolic algebra engine` });
  }
  if (hasFreeSymbol) {
    return toolResult({ expression: args.expression, operation, error: "Free-symbol simplification is not supported; provide substitutions or use evaluate-only inputs" });
  }
  try {
    const val = evaluateExpr(args.expression, vars);
    return toolResult({ expression: args.expression, operation, simplified: formatNumber(val), substitutions: vars });
  } catch (e) {
    return toolResult({ expression: args.expression, operation, error: e.message });
  }
}

function calcConstants(args) {
  const query = (args.query || "").toLowerCase();
  const entries = Object.entries(CONSTANTS).filter(([k]) => !query || k.toLowerCase().includes(query));
  return toolResult({ constants: entries.map(([name, value]) => ({ name, value })), count: entries.length });
}

function calcConvert(args) {
  const fromVal = args.value;
  const from = args.from.toLowerCase();
  const to = args.to.toLowerCase();

  // Temperature special case
  if (['c','f','k'].includes(from) && ['c','f','k'].includes(to)) {
    let celsius;
    if (from === 'c') celsius = fromVal;
    else if (from === 'f') celsius = (fromVal - 32) * 5/9;
    else celsius = fromVal - 273.15;
    if (to === 'c') return toolResult({ value: fromVal, from, to, result: celsius });
    if (to === 'f') return toolResult({ value: fromVal, from, to, result: celsius * 9/5 + 32 });
    return toolResult({ value: fromVal, from, to, result: celsius + 273.15 });
  }

  if (CONSTANTS[from] && CONSTANTS[to]) {
    const result = fromVal * CONSTANTS[from] / CONSTANTS[to];
    return toolResult({ value: fromVal, from, to, result });
  }
  throw new Error(`Unknown unit conversion: ${from} -> ${to}. Check calc_constants for available units.`);
}

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

function calcBaseConvert(args) {
  const fromBase = args.from_base || 10;
  const toBase = args.to_base || 10;
  const decimal = parseInt(args.value, fromBase);
  if (isNaN(decimal)) throw new Error(`Invalid number "${args.value}" in base ${fromBase}`);
  const result = decimal.toString(toBase).toUpperCase();
  return toolResult({ value: args.value, from_base: fromBase, to_base: toBase, result, decimal });
}

function calcPrime(args) {
  const op = args.operation;
  const n = args.n;
  switch (op) {
    case "is_prime": return toolResult({ n, is_prime: isPrime(n) });
    case "factorize": return toolResult({ n, factors: primeFactors(n) });
    case "nth_prime": return toolResult({ n, prime: nthPrime(n) });
    case "primes_in_range": {
      const primes = [];
      for (let i = n; i <= (args.b || n+100); i++) if (isPrime(i)) primes.push(i);
      return toolResult({ from: n, to: args.b || n+100, primes, count: primes.length });
    }
    case "prime_count": {
      let count = 0;
      for (let i = 2; i <= n; i++) if (isPrime(i)) count++;
      return toolResult({ n, pi_n: count });
    }
    case "next_prime": { let p = n+1; while(!isPrime(p))p++; return toolResult({ n, next_prime: p }); }
    case "prev_prime": { let p = n-1; while(p>1&&!isPrime(p))p--; return toolResult({ n, prev_prime: p>1?p:null }); }
    default: throw new Error(`Unknown prime operation: ${op}`);
  }
}

function isPrime(n) {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n%2===0||n%3===0) return false;
  for (let i=5; i*i<=n; i+=6) if (n%i===0||n%(i+2)===0) return false;
  return true;
}

function primeFactors(n) {
  const factors = [];
  let d = 2;
  while (d*d <= n) {
    while (n%d===0) { factors.push(d); n/=d; }
    d++;
  }
  if (n > 1) factors.push(n);
  return factors;
}

function nthPrime(n) {
  let count = 0, num = 1;
  while (count < n) { num++; if (isPrime(num)) count++; }
  return num;
}

function calcPlotData(args) {
  const nPoints = args.points || 100;
  const vars = args.variables || {};
  const dx = (args.x_max - args.x_min) / (nPoints - 1);
  const xVals = [], yVals = [];
  for (let i = 0; i < nPoints; i++) {
    const x = args.x_min + i * dx;
    try {
      const y = safeNullableEval(args.expression, { ...vars, x });
      xVals.push(parseFloat(x.toPrecision(6)));
      yVals.push(typeof y === 'number' && isFinite(y) ? parseFloat(y.toPrecision(8)) : null);
    } catch {
      yVals.push(null);
    }
  }
  return toolResult({ expression: args.expression, x_range: [args.x_min, args.x_max], points: nPoints, x: xVals, y: yVals });
}


// ============================================================
// STATISTICS & PROBABILITY EXTENSIONS
// ============================================================

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

function erfinv(x) {
  // Approximate inverse error function
  const a = [0.886226899, -1.645349621, 0.914624893, -0.140543331];
  const b = [-2.118377725, 1.442710462, -0.329097515, 0.012229801];
  const c = [-1.970840454, -1.624906003, 3.429567803, 1.641345311];
  const d = [3.543889200, 1.637067800];
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  let r;
  if (x <= 0.7) {
    const x2 = x*x;
    r = x * (((a[3]*x2+a[2])*x2+a[1])*x2+a[0]) / ((((b[3]*x2+b[2])*x2+b[1])*x2+b[0])*x2+1);
  } else {
    const y = Math.sqrt(-Math.log((1-x)/2));
    r = y >= 4 ? y : (y <= 2 ? (((c[3]*y+c[2])*y+c[1])*y+c[0])/((d[1]*y+d[0])*y+1) : (((d[1]*y+d[0])*y)*Math.log(y)-d[0]-d[1])/y);
  }
  return sign * r;
}

function boxMuller(mu, sigma, n) {
  const samples = [];
  for (let i = 0; i < Math.ceil(n/2); i++) {
    const u1 = Math.random(), u2 = Math.random();
    const z0 = Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
    const z1 = Math.sqrt(-2*Math.log(u1))*Math.sin(2*Math.PI*u2);
    samples.push(mu + sigma*z0);
    if (samples.length < n) samples.push(mu + sigma*z1);
  }
  return samples.slice(0,n).map(v => parseFloat(v.toPrecision(6)));
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

// ============================================================
// MCP JSON-RPC HANDLER
// ============================================================
function toolResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function rpcResult(id, result) { return { jsonrpc: "2.0", id, result }; }
function rpcError(id, code, message) { return { jsonrpc: "2.0", id, error: { code, message } }; }

async function handleJsonRpc(message) {
  const { id, method, params } = message;
  try {
    if (method === "initialize") {
      return rpcResult(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
      });
    }
    if (method === "notifications/initialized") return null;
    if (method === "tools/list") return rpcResult(id, { tools: TOOLS });
    if (method === "tools/call") return rpcResult(id, await callTool(params));
    return rpcError(id, -32601, `Method not found: ${method}`);
  } catch (e) {
    return rpcError(id, -32000, e.message);
  }
}

// ============================================================
// CF WORKER ENTRY
// ============================================================
export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "*" } });
    }
    if (request.method === "GET") {
      return new Response(JSON.stringify({ name: SERVER_NAME, version: SERVER_VERSION, tools: TOOLS.length, mcp: "/mcp" }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    try {
      const message = await request.json();
      const result = await handleJsonRpc(message);
      if (!result) return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
  }
};

