import { toolResult } from '../lib/format.js';

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

export { calcPrime, isPrime, primeFactors, nthPrime };
