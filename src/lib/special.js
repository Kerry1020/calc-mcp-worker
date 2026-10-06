export function factorialNumber(n) {
  if (!Number.isFinite(n)) throw new Error("Factorial requires a finite number");
  if (n < 0 || Math.trunc(n) !== n) throw new Error("Factorial requires a non-negative integer");
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

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

export { gammaFn, erfFn, gcdFn, lcmFn, binomialFn, erfinv, boxMuller };
