// Physical, mathematical and unit constants available in expressions.
export const SERVER_NAME = "calc-mcp-worker";
export const SERVER_VERSION = "1.1.0";
export const NUMERIC_EPSILON = 1e-12;
export const MATRIX_EPSILON = 1e-12;

export const CONSTANTS = {
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
  mph: 0.44704, kph: 1000 / 3600, knot: 1852 / 3600,
  Pa: 1, kPa: 1000, MPa: 1e6, psi: 6894.757293168,
  J: 1, kJ: 1000, MJ: 1e6, Wh: 3600, kWh: 3.6e6, BTU: 1055.06,
  W: 1, kW: 1000, MW: 1e6,
  Hz: 1, kHz: 1000, MHz: 1e6, GHz: 1e9,
};
