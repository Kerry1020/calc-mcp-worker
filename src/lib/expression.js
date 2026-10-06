// Safe expression language: tokenizer, Pratt parser and tree-walking evaluator.
//
// No eval/Function is used. Identifier and function lookups only consult own
// properties of null-prototype tables, so names like "constructor" or
// "__proto__" cannot reach JavaScript internals.
import { CONSTANTS } from './constants.js';
import { Complex } from './complex.js';
import { LIMITS } from './validate.js';
import { factorialNumber, gammaFn, erfFn, gcdFn, lcmFn, binomialFn } from './special.js';

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// ------------------------------------------------------------------
// Tokenizer
// ------------------------------------------------------------------
const NUMBER_RE = /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const IDENT_RE = /[A-Za-z_][A-Za-z0-9_]*/y;
const ABS_OPEN_PREV = new Set(['op', 'lparen', 'comma', 'lbracket', 'abs_open', 'semi', 'eq']);
const CHAR_ALIASES = { '×': '*', '·': '*', '÷': '/', '−': '-' };

export function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    let ch = expr[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (hasOwn(CHAR_ALIASES, ch)) ch = CHAR_ALIASES[ch];
    if (/[0-9.]/.test(ch)) {
      NUMBER_RE.lastIndex = i;
      const m = NUMBER_RE.exec(expr);
      if (!m) throw new Error(`Malformed number at position ${i}`);
      const end = i + m[0].length;
      if (end < expr.length && /[0-9.]/.test(expr[end])) throw new Error(`Malformed number at position ${i}`);
      tokens.push({ type: 'num', value: parseFloat(m[0]), text: m[0] });
      i = end;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      IDENT_RE.lastIndex = i;
      const id = IDENT_RE.exec(expr)[0];
      tokens.push({ type: 'id', value: id, text: id });
      i += id.length;
      continue;
    }
    if (ch === 'π') { tokens.push({ type: 'id', value: 'pi', text: 'pi' }); i++; continue; }
    if (ch === '*' && expr[i + 1] === '*') { tokens.push({ type: 'op', value: '^', text: '**' }); i += 2; continue; }
    if ('+-*/^%!'.includes(ch)) { tokens.push({ type: 'op', value: ch, text: ch }); i++; continue; }
    const simple = { '(': 'lparen', ')': 'rparen', '[': 'lbracket', ']': 'rbracket', ',': 'comma', '=': 'eq', ';': 'semi' };
    if (hasOwn(simple, ch)) { tokens.push({ type: simple[ch], text: ch }); i++; continue; }
    if (ch === '|') {
      const prev = tokens[tokens.length - 1];
      tokens.push({ type: !prev || ABS_OPEN_PREV.has(prev.type) ? 'abs_open' : 'abs_close', text: '|' });
      i++;
      continue;
    }
    throw new Error(`Unexpected character '${expr[i]}' at position ${i}`);
  }
  return tokens;
}

// ------------------------------------------------------------------
// Parser
// ------------------------------------------------------------------
// Precedence: + - (1) < * / % (2) < implicit multiplication (3) < ^ (4) < postfix !.
// Implicit multiplication binds tighter than explicit * and / so "1/2pi" is 1/(2*pi),
// but looser than ^ so "2x^2" is 2*(x^2).
const BINARY = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 4 };
const IMPLICIT_PREC = 3;
const STARTS_PRIMARY = new Set(['num', 'id', 'lparen', 'lbracket', 'abs_open']);

function mk(node, children) {
  let d = 0;
  for (const c of children) if (c.d > d) d = c.d;
  node.d = d + 1;
  if (node.d > LIMITS.MAX_AST_DEPTH) throw new Error(`Expression is too deeply nested (max depth ${LIMITS.MAX_AST_DEPTH})`);
  return node;
}

const describe = (t) => (t ? `'${t.text}'` : 'end of expression');

export function parseExpr(expr) {
  if (typeof expr !== 'string') throw new Error('Expression must be a string');
  if (expr.length > LIMITS.MAX_EXPRESSION_LENGTH) throw new Error(`Expression is too long (max ${LIMITS.MAX_EXPRESSION_LENGTH} characters)`);
  const tokens = tokenize(expr);
  if (!tokens.length) throw new Error('Empty expression');
  let idx = 0;
  let recursion = 0;
  const peek = () => tokens[idx];
  const consume = () => tokens[idx++];
  const expect = (type, what) => {
    const t = peek();
    if (!t || t.type !== type) throw new Error(`Expected ${what} but found ${describe(t)}`);
    return consume();
  };

  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.type === 'op' && t.value === '-') { consume(); const arg = parseExpression(BINARY['^']); return mk({ type: 'neg', arg }, [arg]); }
    if (t.type === 'op' && t.value === '+') { consume(); return parseExpression(BINARY['^']); }
    if (t.type === 'num') { consume(); return mk({ type: 'num', value: t.value }, []); }
    if (t.type === 'abs_open') {
      consume();
      const arg = parseExpression(0);
      expect('abs_close', "closing '|'");
      return mk({ type: 'abs', arg }, [arg]);
    }
    if (t.type === 'lbracket') {
      consume();
      const rows = [[]];
      if (peek()?.type !== 'rbracket') {
        for (;;) {
          rows[rows.length - 1].push(parseExpression(0));
          const sep = peek();
          if (sep?.type === 'comma') { consume(); continue; }
          if (sep?.type === 'semi') { consume(); rows.push([]); continue; }
          break;
        }
      }
      expect('rbracket', "']'");
      if (rows.length === 1) return mk({ type: 'array', elements: rows[0] }, rows[0]);
      // [a, b; c, d] matrix syntax -> array of row arrays
      const rowNodes = rows.map(r => mk({ type: 'array', elements: r }, r));
      return mk({ type: 'array', elements: rowNodes }, rowNodes);
    }
    if (t.type === 'id') {
      consume();
      if (peek()?.type === 'lparen') {
        consume();
        const args = [];
        if (peek()?.type !== 'rparen') {
          for (;;) {
            args.push(parseExpression(0));
            if (peek()?.type === 'comma') { consume(); continue; }
            break;
          }
        }
        expect('rparen', "')'");
        return mk({ type: 'call', name: t.value, args }, args);
      }
      return mk({ type: 'id', value: t.value }, []);
    }
    if (t.type === 'lparen') {
      consume();
      const inner = parseExpression(0);
      expect('rparen', "')'");
      return inner;
    }
    throw new Error(`Unexpected token ${describe(t)}`);
  }

  function parsePostfix() {
    let node = parsePrimary();
    while (peek()?.type === 'op' && peek().value === '!') {
      consume();
      node = mk({ type: 'postfix', op: '!', arg: node }, [node]);
    }
    return node;
  }

  function parseExpression(minPrec) {
    if (++recursion > LIMITS.MAX_AST_DEPTH) throw new Error(`Expression is too deeply nested (max depth ${LIMITS.MAX_AST_DEPTH})`);
    let left = parsePostfix();
    for (;;) {
      const t = peek();
      if (!t) break;
      if (STARTS_PRIMARY.has(t.type)) {
        if (IMPLICIT_PREC < minPrec) break;
        const right = parseExpression(BINARY['^']);
        left = mk({ type: 'binop', op: '*', left, right }, [left, right]);
        continue;
      }
      if (t.type !== 'op' || t.value === '!') break;
      const prec = BINARY[t.value];
      if (prec < minPrec) break;
      consume();
      const right = parseExpression(t.value === '^' ? prec : prec + 1);
      left = mk({ type: 'binop', op: t.value, left, right }, [left, right]);
    }
    recursion--;
    return left;
  }

  const ast = parseExpression(0);
  if (idx < tokens.length) throw new Error(`Unexpected token ${describe(tokens[idx])}`);
  return { ast, pos: idx };
}

// ------------------------------------------------------------------
// Builtin functions
// ------------------------------------------------------------------
const isC = (v) => v instanceof Complex;

function realArg(name, fn) {
  return (...args) => {
    for (const a of args) if (typeof a !== 'number') throw new Error(`${name}() expects real numeric arguments`);
    return fn(...args);
  };
}

function flattenNumbers(name, args) {
  const out = [];
  const visit = (v) => {
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (typeof v !== 'number') throw new Error(`${name}() expects real numbers`);
    out.push(v);
  };
  args.forEach(visit);
  if (!out.length) throw new Error(`${name}() requires at least one value`);
  return out;
}

function meanOf(a) { let s = 0; for (const x of a) s += x; return s / a.length; }
function varianceOf(a) {
  if (a.length < 2) return NaN;
  const m = meanOf(a);
  let s = 0; for (const x of a) s += (x - m) ** 2;
  return s / (a.length - 1);
}

export function powValues(l, r) {
  if (isC(l) || isC(r)) return Complex.from(l).pow(r);
  return Math.pow(l, r);
}

const BUILTINS = Object.assign(Object.create(null), {
  sin: z => isC(z) ? z.sin() : realArg('sin', Math.sin)(z),
  cos: z => isC(z) ? z.cos() : realArg('cos', Math.cos)(z),
  tan: z => isC(z) ? z.tan() : realArg('tan', Math.tan)(z),
  asin: realArg('asin', Math.asin), acos: realArg('acos', Math.acos), atan: realArg('atan', Math.atan), atan2: realArg('atan2', Math.atan2),
  sinh: realArg('sinh', Math.sinh), cosh: realArg('cosh', Math.cosh), tanh: realArg('tanh', Math.tanh),
  asinh: realArg('asinh', Math.asinh), acosh: realArg('acosh', Math.acosh), atanh: realArg('atanh', Math.atanh),
  sqrt: x => isC(x) ? x.sqrt() : realArg('sqrt', Math.sqrt)(x),
  cbrt: realArg('cbrt', Math.cbrt),
  abs: x => isC(x) ? x.abs() : realArg('abs', Math.abs)(x),
  ln: x => isC(x) ? x.ln() : realArg('ln', Math.log)(x),
  log: (x, base) => {
    if (base === undefined) return isC(x) ? x.log(10) : realArg('log', Math.log10)(x);
    if (isC(x) || isC(base)) return Complex.from(x).log(base);
    return realArg('log', (a, b) => Math.log(a) / Math.log(b))(x, base);
  },
  log2: realArg('log2', Math.log2), log10: realArg('log10', Math.log10),
  exp: x => isC(x) ? x.exp() : realArg('exp', Math.exp)(x),
  pow: (a, b) => powValues(a, b),
  ceil: realArg('ceil', Math.ceil), floor: realArg('floor', Math.floor), round: realArg('round', Math.round),
  sign: realArg('sign', Math.sign),
  max: (...args) => Math.max(...flattenNumbers('max', args)),
  min: (...args) => Math.min(...flattenNumbers('min', args)),
  factorial: n => factorialNumber(n),
  gamma: realArg('gamma', gammaFn), erf: realArg('erf', erfFn),
  sec: realArg('sec', x => 1 / Math.cos(x)), csc: realArg('csc', x => 1 / Math.sin(x)), cot: realArg('cot', x => 1 / Math.tan(x)),
  rad: realArg('rad', x => x * Math.PI / 180), deg: realArg('deg', x => x * 180 / Math.PI),
  mod: realArg('mod', (a, b) => a % b), gcd: realArg('gcd', gcdFn), lcm: realArg('lcm', lcmFn),
  binom: realArg('binom', binomialFn),
  re: z => isC(z) ? z.re : z,
  im: z => isC(z) ? z.im : 0,
  conj: z => isC(z) ? z.conj() : z,
  arg: z => isC(z) ? z.arg() : Math.atan2(0, z),
  mean: (...args) => meanOf(flattenNumbers('mean', args)),
  median: (...args) => {
    const s = flattenNumbers('median', args).sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  },
  stdev: (...args) => Math.sqrt(varianceOf(flattenNumbers('stdev', args))),
  variance: (...args) => varianceOf(flattenNumbers('variance', args)),
  csin: z => Complex.from(z).sin(),
  ccos: z => Complex.from(z).cos(),
  ctan: z => Complex.from(z).tan(),
  csqrt: z => Complex.from(z).sqrt(),
  cexp: z => Complex.from(z).exp(),
  cln: z => Complex.from(z).ln(),
});

export const BUILTIN_NAMES = Object.freeze(Object.keys(BUILTINS));

// ------------------------------------------------------------------
// Evaluator
// ------------------------------------------------------------------
const SPECIAL_VALUES = Object.assign(Object.create(null), {
  i: new Complex(0, 1),
  inf: Infinity, infinity: Infinity, Inf: Infinity,
  nan: NaN, NaN: NaN,
});

export function isKnownConstant(id) {
  return hasOwn(CONSTANTS, id) || id in SPECIAL_VALUES;
}

function resolveValue(id) {
  if (hasOwn(CONSTANTS, id)) return CONSTANTS[id];
  if (id in SPECIAL_VALUES) return SPECIAL_VALUES[id];
  return undefined;
}

function arithmetic(op, l, r) {
  if (Array.isArray(l) || Array.isArray(r)) throw new Error(`Operator '${op}' is not supported on arrays/matrices; use calc_matrix`);
  const complex = isC(l) || isC(r);
  switch (op) {
    case '+': return complex ? Complex.from(l).add(r) : l + r;
    case '-': return complex ? Complex.from(l).sub(r) : l - r;
    case '*': return complex ? Complex.from(l).mul(r) : l * r;
    case '/': return complex ? Complex.from(l).div(r) : l / r;
    case '^': return powValues(l, r);
    case '%':
      if (complex) throw new Error("Operator '%' is not supported for complex numbers");
      return l % r;
  }
  throw new Error(`Unknown operator: ${op}`);
}

export function evaluate(node, vars = {}) {
  switch (node.type) {
    case 'num': return node.value;
    case 'id': {
      if (hasOwn(vars, node.value)) return vars[node.value];
      const c = resolveValue(node.value);
      if (c !== undefined) return c;
      throw new Error(`Undefined variable: ${node.value}`);
    }
    case 'neg': {
      const v = evaluate(node.arg, vars);
      if (isC(v)) return v.neg();
      if (Array.isArray(v)) throw new Error('Unary minus is not supported on arrays/matrices; use calc_matrix');
      return -v;
    }
    case 'abs': {
      const v = evaluate(node.arg, vars);
      if (Array.isArray(v)) throw new Error('|x| is not supported on arrays/matrices');
      return isC(v) ? v.abs() : Math.abs(v);
    }
    case 'postfix': {
      const v = evaluate(node.arg, vars);
      if (node.op === '!') return factorialNumber(v);
      throw new Error(`Unknown postfix operator: ${node.op}`);
    }
    case 'binop':
      return arithmetic(node.op, evaluate(node.left, vars), evaluate(node.right, vars));
    case 'call': {
      if (!hasOwn(BUILTINS, node.name)) throw new Error(`Unknown function: ${node.name}`);
      const args = node.args.map(a => evaluate(a, vars));
      return BUILTINS[node.name](...args);
    }
    case 'array': return node.elements.map(e => evaluate(e, vars));
    default: throw new Error(`Unknown node type: ${node.type}`);
  }
}

// ------------------------------------------------------------------
// Compilation helpers
// ------------------------------------------------------------------
function analyze(ast) {
  let nodes = 0;
  const identifiers = new Set();
  const stack = [ast];
  while (stack.length) {
    const n = stack.pop();
    nodes++;
    if (n.type === 'id') identifiers.add(n.value);
    if (n.type === 'call') {
      if (!hasOwn(BUILTINS, n.name)) throw new Error(`Unknown function: ${n.name}`);
      stack.push(...n.args);
    }
    if (n.arg) stack.push(n.arg);
    if (n.left) stack.push(n.left, n.right);
    if (n.elements) stack.push(...n.elements);
  }
  return { nodes, identifiers };
}

/**
 * Parse once and validate. `variables` lists names that will be bound at
 * evaluation time; any other identifier must be a known constant.
 */
export function compile(expr, variables = []) {
  const { ast } = parseExpr(expr);
  const { nodes, identifiers } = analyze(ast);
  const bound = new Set(variables);
  for (const id of identifiers) {
    if (!bound.has(id) && !isKnownConstant(id)) throw new Error(`Undefined variable: ${id}`);
  }
  return { ast, nodeCount: nodes, identifiers };
}

/** Collect identifiers that are neither bound nor constants. */
export function freeIdentifiers(expr, bound = {}) {
  const { ast } = parseExpr(expr);
  const { identifiers } = analyze(ast);
  return [...identifiers].filter(id => !hasOwn(bound, id) && !isKnownConstant(id));
}

/**
 * Compile `expr` into a real-valued function of the named arguments.
 * Evaluation errors and non-real results become NaN; parse errors,
 * unknown functions and undefined variables throw immediately.
 */
export function compileRealFunction(expr, argNames, extraVars = {}) {
  const compiled = compile(expr, [...argNames, ...Object.keys(extraVars)]);
  const scope = Object.assign(Object.create(null), extraVars);
  const fn = (...values) => {
    for (let k = 0; k < argNames.length; k++) scope[argNames[k]] = values[k];
    try {
      const v = evaluate(compiled.ast, scope);
      return typeof v === 'number' ? v : NaN;
    } catch {
      return NaN;
    }
  };
  fn.nodeCount = compiled.nodeCount;
  fn.ast = compiled.ast;
  return fn;
}

export function evaluateExpr(expr, vars = {}) {
  const { ast } = parseExpr(expr);
  return evaluate(ast, vars);
}

export function safeNullableEval(expr, vars) {
  try {
    return evaluateExpr(expr, vars);
  } catch {
    return NaN;
  }
}
