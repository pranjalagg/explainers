// The pure model behind the figure. SI units throughout (m, m³/s, mm/h).
// Gutter and inlet equations are FHWA HEC-22 (3rd ed.), SI forms; pipes use Manning.

export const G = 9.81;
export const RHO = 998; // kg/m³, water at 20 °C
export const SIGMA = 0.0728; // N/m, surface tension of water at 20 °C
export const CAPILLARY = Math.sqrt(SIGMA / (RHO * G)); // ≈ 2.7 mm

export const STREET = {
  n: 0.016, // Manning's n, asphalt with a concrete gutter (HEC-22 example value)
  gutterW: 0.6, // gutter pan width, m
  panDrop: 0.038, // gutter depression a = (Sw − Sx)·W, m (≈ 1.5 in)
  curbH: 0.15, // curb face, m (6 in)
  inletL: 1.5, // curb-opening length, m
  spacing: 90, // gutter length draining to this inlet, m
  width: 15, // tributary width: half the street, the sidewalk and the frontage that drains to it, m
  C: 0.85, // runoff coefficient of that mostly paved strip (rational method)
  allowT: 3.0, // design spread: gutter plus a 2.4 m parking lane, m
  lane: 0.6 + 2.4, // where the traffic lane starts, m from the curb
};

export const PIPES = {
  lateral: { D: 0.3, S: 0.02, n: 0.013 }, // inlet lead, concrete
  main: { D: 0.45, S: 0.005, n: 0.013, area: 0.9 }, // storm main and the hectares it serves
};

// Rational method: Q = C·i·A, with i in mm/h and A in m² → m³/s.
export const runoff = (C, i, area) => (C * i * area) / 3.6e6;

const uniform = (T, Sx, SL, n) => (0.376 / n) * Sx ** (5 / 3) * Math.sqrt(SL) * T ** (8 / 3);

// HEC-22 composite gutter: Eo is the share of the flow carried in the pan of width W.
export function eo(T, Sx, Sw, W) {
  if (T <= W) return 1;
  const r = Sw / Sx;
  return 1 / (1 + r / ((1 + r / (T / W - 1)) ** (8 / 3) - 1));
}

export function gutterQ(T, Sx, SL, s = STREET) {
  const W = s.gutterW;
  const Sw = Sx + s.panDrop / W;
  if (T <= W) return uniform(T, Sw, SL, s.n);
  const Qs = uniform(T - W, Sx, SL, s.n);
  return Qs / (1 - eo(T, Sx, Sw, W));
}

// Spread for a flow: bisect on T, since Q(T) rises monotonically.
export function spreadOf(Q, Sx, SL, s = STREET) {
  if (Q <= 0) return 0;
  let lo = 0, hi = 40;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (gutterQ(mid, Sx, SL, s) < Q) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Depth at the curb and wetted area for a spread T.
export function sectionOf(T, Sx, s = STREET) {
  const W = s.gutterW;
  const Sw = Sx + s.panDrop / W;
  if (T <= W) {
    const d = T * Sw;
    return { d, A: 0.5 * T * d };
  }
  const d = (T - W) * Sx + s.panDrop + W * Sx;
  const dLip = (T - W) * Sx;
  return { d, A: 0.5 * (T - W) * dLip + W * (dLip + 0.5 * (d - dLip)) };
}

// HEC-22 curb opening on grade. LT is the length that would take all the flow.
export function inletOf(Q, T, Sx, SL, s = STREET, clogged = 0) {
  if (Q <= 0) return { LT: 0, E: 1, Qi: 0, Qb: 0 };
  const W = s.gutterW;
  const Sw = Sx + s.panDrop / W;
  const Se = Sx + (s.panDrop / W) * eo(T, Sx, Sw, W);
  const LT = 0.817 * Q ** 0.42 * SL ** 0.3 * (1 / (s.n * Se)) ** 0.6;
  const L = s.inletL * (1 - clogged);
  const E = L >= LT ? 1 : 1 - (1 - L / LT) ** 1.8;
  return { LT, E, Qi: E * Q, Qb: (1 - E) * Q };
}

// Manning in a round pipe. theta is the angle the water surface subtends at the centre.
export function pipeFlow(theta, D, S, n) {
  const A = (D * D * (theta - Math.sin(theta))) / 8;
  const Pw = (D * theta) / 2;
  if (A <= 0) return 0;
  return (1 / n) * A * (A / Pw) ** (2 / 3) * Math.sqrt(S);
}
export const pipeFull = ({ D, S, n }) => pipeFlow(2 * Math.PI, D, S, n);

// Depth ratio y/D for a flow; Manning peaks near 94% depth, so bisect below that peak.
export function pipeDepth(Q, pipe) {
  const { D, S, n } = pipe;
  const peakTheta = 5.278; // where Manning's Q is largest
  const Qpeak = pipeFlow(peakTheta, D, S, n);
  if (Q <= 0) return { y: 0, theta: 0, share: 0, surcharged: false };
  const share = Q / pipeFull(pipe);
  if (Q >= Qpeak) return { y: 1, theta: 2 * Math.PI, share, surcharged: Q > pipeFull(pipe) * 1.0001 };
  let lo = 0, hi = peakTheta;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (pipeFlow(mid, D, S, n) < Q) lo = mid;
    else hi = mid;
  }
  const theta = (lo + hi) / 2;
  return { y: (1 - Math.cos(theta / 2)) / 2, theta, share, surcharged: false };
}

// Gravity against surface tension: Bond number at a depth d.
export const bondOf = (d) => (RHO * G * d * d) / SIGMA;

// Everything the page shows, for one rain rate and street geometry.
// x is metres along the model (0 at its upstream end), modelL its length, and the
// inlet throat runs from inletX to inletX + inletL.
export function solve({ rain, Sx, SL, clogged = 0, modelL = 6, inletX = 4.5 }, s = STREET) {
  const qPerM = runoff(s.C, rain, s.width); // m³/s gained per metre of gutter
  const upstream = s.spacing - inletX - s.inletL; // gutter length upstream of the model
  const Qat = (x) => qPerM * (upstream + x);
  const Qin = Qat(inletX + s.inletL);
  const T = spreadOf(Qin, Sx, SL, s);
  const inlet = inletOf(Qin, T, Sx, SL, s, clogged);
  const sec = sectionOf(T, Sx, s);
  const V = sec.A > 0 ? Qin / sec.A : 0;
  // Spread along the model: grows with the flow, drops across the throat, then carries the bypass.
  const profile = (x) => {
    if (x <= inletX) return spreadOf(Qat(x), Sx, SL, s);
    if (x <= inletX + s.inletL) {
      const t = (x - inletX) / s.inletL;
      return spreadOf(Qin - inlet.Qi * t, Sx, SL, s);
    }
    return spreadOf(inlet.Qb + qPerM * (x - inletX - s.inletL), Sx, SL, s);
  };
  const lateral = pipeDepth(inlet.Qi, PIPES.lateral);
  const mainQ = runoff(s.C, rain, PIPES.main.area * 1e4);
  const main = pipeDepth(mainQ, PIPES.main);
  return {
    qPerM, Qin, T, d: sec.d, A: sec.A, V, inlet,
    profile, lateral, mainQ, main,
    bond: bondOf(sec.d),
    within: T <= s.allowT,
    intoLane: T > s.lane,
    overCurb: sec.d > s.curbH,
  };
}
