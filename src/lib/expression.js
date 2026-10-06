import { CONSTANTS } from './constants.js';
import { Complex } from './complex.js';
import { factorialNumber, gammaFn, erfFn, gcdFn, lcmFn, binomialFn } from './special.js';

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

export { evaluateExpr, safeNullableEval, tokenize, parseExpr, evaluate };
