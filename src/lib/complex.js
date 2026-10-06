export class Complex {
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
