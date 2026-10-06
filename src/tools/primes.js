// calc_prime
import { LIMITS, requireInteger } from '../lib/validate.js';
import { toolResult } from '../lib/format.js';

const MR_BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

function modPow(base, exp, mod) {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = result * base % mod;
    base = base * base % mod;
    exp >>= 1n;
  }
  return result;
}

/** Deterministic primality test for all safe integers. */
export function isPrime(n) {
  if (!Number.isSafeInteger(n) || n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  if (n < 2 ** 32) {
    for (let i = 5; i * i <= n; i += 6) if (n % i === 0 || n % (i + 2) === 0) return false;
    return true;
  }
  // Miller-Rabin with the first 12 prime bases is deterministic below 3.3e24.
  const N = BigInt(n);
  let d = N - 1n, s = 0;
  while ((d & 1n) === 0n) { d >>= 1n; s++; }
  outer: for (const a of MR_BASES) {
    let x = modPow(a, d, N);
    if (x === 1n || x === N - 1n) continue;
    for (let r = 1; r < s; r++) {
      x = x * x % N;
      if (x === N - 1n) continue outer;
    }
    return false;
  }
  return true;
}

function gcdBig(a, b) { while (b) [a, b] = [b, a % b]; return a; }

/** Pollard-Brent rho: returns a non-trivial factor of composite n (BigInt). */
function pollardRho(n) {
  if (n % 2n === 0n) return 2n;
  for (let c = 1n; c < 100n; c++) {
    let y = 2n, m = 128n, g = 1n, r = 1n, q = 1n, x = 0n, ys = 0n;
    const f = (v) => (v * v + c) % n;
    do {
      x = y;
      for (let i = 0n; i < r; i++) y = f(y);
      let k = 0n;
      do {
        ys = y;
        for (let i = 0n; i < m && i < r - k; i++) { y = f(y); q = q * (x > y ? x - y : y - x) % n; }
        g = gcdBig(q, n);
        k += m;
      } while (k < r && g === 1n);
      r *= 2n;
    } while (g === 1n);
    if (g === n) {
      do { ys = f(ys); g = gcdBig(x > ys ? x - ys : ys - x, n); } while (g === 1n);
    }
    if (g !== n) return g;
  }
  throw new Error('Factorization failed');
}

export function primeFactors(n) {
  const factors = [];
  if (n < 2) return factors;
  for (const p of [2, 3]) while (n % p === 0) { factors.push(p); n /= p; }
  for (let d = 5; d * d <= n && d <= 1e6; d += 6) {
    for (const p of [d, d + 2]) while (n % p === 0) { factors.push(p); n /= p; }
  }
  if (n > 1) {
    // Remaining cofactor has no prime factor <= 1e6.
    const stack = [n];
    while (stack.length) {
      const m = stack.pop();
      if (m === 1) continue;
      if (isPrime(m)) { factors.push(m); continue; }
      const f = Number(pollardRho(BigInt(m)));
      stack.push(f, m / f);
    }
  }
  return factors.sort((a, b) => a - b);
}

/** Sieve of Eratosthenes up to limit (inclusive). */
function sieve(limit) {
  const composite = new Uint8Array(limit + 1);
  composite[0] = 1; if (limit >= 1) composite[1] = 1;
  for (let i = 2; i * i <= limit; i++) if (!composite[i]) for (let j = i * i; j <= limit; j += i) composite[j] = 1;
  return composite;
}

export function nthPrime(n) {
  // Rosser's bound: p_n < n (ln n + ln ln n) for n >= 6.
  const limit = n < 6 ? 15 : Math.ceil(n * (Math.log(n) + Math.log(Math.log(n))));
  const composite = sieve(limit);
  let count = 0;
  for (let i = 2; i <= limit; i++) if (!composite[i] && ++count === n) return i;
  throw new Error('nth_prime bound failed');
}

function primesInRange(lo, hi) {
  const primes = [];
  lo = Math.max(lo, 2);
  if (hi < lo) return primes;
  if (hi <= 1e12) {
    // Segmented sieve.
    const root = Math.floor(Math.sqrt(hi));
    const small = sieve(root);
    const seg = new Uint8Array(hi - lo + 1);
    for (let p = 2; p <= root; p++) {
      if (small[p]) continue;
      for (let j = Math.max(p * p, Math.ceil(lo / p) * p); j <= hi; j += p) seg[j - lo] = 1;
    }
    for (let i = 0; i < seg.length; i++) if (!seg[i]) primes.push(lo + i);
    return primes;
  }
  for (let i = lo; i <= hi; i++) if (isPrime(i)) primes.push(i);
  return primes;
}

export function calcPrime(args) {
  const op = args.operation;
  const n = requireInteger(args.n, 'n');
  switch (op) {
    case 'is_prime': return toolResult({ n, is_prime: isPrime(n) });
    case 'factorize': {
      if (n < 1) throw new Error('factorize requires n >= 1');
      return toolResult({ n, factors: primeFactors(n) });
    }
    case 'nth_prime': {
      requireInteger(n, 'n', 1, LIMITS.MAX_NTH_PRIME);
      return toolResult({ n, prime: nthPrime(n) });
    }
    case 'primes_in_range': {
      const b = args.b === undefined || args.b === null ? n + 100 : requireInteger(args.b, 'b');
      if (b - n > LIMITS.MAX_PRIME_RANGE) throw new Error(`primes_in_range width must be at most ${LIMITS.MAX_PRIME_RANGE}`);
      if (b > 1e12 && b - n > 1e4) throw new Error('primes_in_range width must be at most 10000 when b > 1e12');
      const primes = primesInRange(n, b);
      return toolResult({ from: n, to: b, primes, count: primes.length });
    }
    case 'prime_count': {
      if (n > LIMITS.MAX_PRIME_SIEVE) throw new Error(`prime_count supports n up to ${LIMITS.MAX_PRIME_SIEVE}`);
      if (n < 2) return toolResult({ n, pi_n: 0 });
      const composite = sieve(n);
      let count = 0;
      for (let i = 2; i <= n; i++) if (!composite[i]) count++;
      return toolResult({ n, pi_n: count });
    }
    case 'next_prime': {
      let p = Math.max(n + 1, 2);
      while (!isPrime(p)) { p++; if (!Number.isSafeInteger(p)) throw new Error('next_prime exceeds the safe integer range'); }
      return toolResult({ n, next_prime: p });
    }
    case 'prev_prime': {
      let p = n - 1;
      while (p > 1 && !isPrime(p)) p--;
      return toolResult({ n, prev_prime: p > 1 ? p : null });
    }
    default: throw new Error(`Unknown prime operation: ${op}`);
  }
}
