// Minimal complex number type used by the expression evaluator.
export class Complex {
  constructor(re = 0, im = 0) { this.re = re; this.im = im; }
  static from(v) {
    if (v instanceof Complex) return v;
    if (typeof v !== 'number') throw new Error('Complex arithmetic requires numeric operands');
    return new Complex(v, 0);
  }
  add(b) { b = Complex.from(b); return new Complex(this.re + b.re, this.im + b.im); }
  sub(b) { b = Complex.from(b); return new Complex(this.re - b.re, this.im - b.im); }
  mul(b) { b = Complex.from(b); return new Complex(this.re * b.re - this.im * b.im, this.re * b.im + this.im * b.re); }
  div(b) {
    b = Complex.from(b);
    // Smith's algorithm: avoids overflow/underflow of |b|^2.
    if (Math.abs(b.re) >= Math.abs(b.im)) {
      const r = b.im / b.re, d = b.re + b.im * r;
      return new Complex((this.re + this.im * r) / d, (this.im - this.re * r) / d);
    }
    const r = b.re / b.im, d = b.re * r + b.im;
    return new Complex((this.re * r + this.im) / d, (this.im * r - this.re) / d);
  }
  neg() { return new Complex(-this.re, -this.im); }
  abs() { return Math.hypot(this.re, this.im); }
  arg() { return Math.atan2(this.im, this.re); }
  conj() { return new Complex(this.re, -this.im); }
  pow(b) {
    b = Complex.from(b);
    if (b.re === 0 && b.im === 0) return new Complex(1, 0);
    if (this.re === 0 && this.im === 0) {
      if (b.re > 0) return new Complex(0, 0);
      return new Complex(Infinity, 0);
    }
    // Exact repeated multiplication for small integer exponents (e.g. i^2 = -1 exactly).
    if (b.im === 0 && Number.isInteger(b.re) && Math.abs(b.re) <= 64) {
      let result = new Complex(1, 0), base = this, n = Math.abs(b.re);
      while (n > 0) {
        if (n & 1) result = result.mul(base);
        base = base.mul(base);
        n >>= 1;
      }
      return b.re < 0 ? new Complex(1, 0).div(result) : result;
    }
    const r = this.abs(), t = this.arg();
    const nr = Math.pow(r, b.re) * Math.exp(-b.im * t);
    const nt = b.re * t + b.im * Math.log(r);
    return new Complex(nr * Math.cos(nt), nr * Math.sin(nt));
  }
  sqrt() {
    // Numerically stable principal square root.
    if (this.re === 0 && this.im === 0) return new Complex(0, 0);
    const m = this.abs();
    const a = Math.sqrt((m + Math.abs(this.re)) / 2);
    if (this.re >= 0) return new Complex(a, this.im / (2 * a));
    return new Complex(Math.abs(this.im) / (2 * a), this.im >= 0 ? a : -a);
  }
  exp() { const er = Math.exp(this.re); return new Complex(er * Math.cos(this.im), er * Math.sin(this.im)); }
  ln() { return new Complex(Math.log(this.abs()), this.arg()); }
  sin() { return new Complex(Math.sin(this.re) * Math.cosh(this.im), Math.cos(this.re) * Math.sinh(this.im)); }
  cos() { return new Complex(Math.cos(this.re) * Math.cosh(this.im), -Math.sin(this.re) * Math.sinh(this.im)); }
  tan() { return this.sin().div(this.cos()); }
  log(b) { return this.ln().div(Complex.from(b ?? Math.E).ln()); }
  toString() {
    if (this.im === 0) return `${this.re}`;
    if (this.re === 0) return `${this.im}i`;
    return `${this.re}${this.im >= 0 ? '+' : ''}${this.im}i`;
  }
}
