// Root canal treatment: the pure model. World units are 5 per millimetre (a 5:1 demonstration
// specimen); every number the figure prints is converted back to true millimetres.
export const U = 5;

// Heights on the specimen (world z). The cut plane is y = 0 and runs through the tooth's long axis.
export const Z = { vise: 8, crest: 92, cej: 102, orifice: 97, roof: 118.5, apex: 30, constriction: 33 };

// Crown: a neck that swells to the height of contour, then a flat superellipse occlusal table.
export const CROWN = { neck: 12.5, bulge: 21, at: 16, cap: 26.5, n: 3 };
export const CROWN_H = CROWN.at + CROWN.cap;
Z.top = Z.cej + CROWN_H;

export function crownR(s) {
  if (s <= 0) return CROWN.neck;
  if (s < CROWN.at) return CROWN.neck + (CROWN.bulge - CROWN.neck) * Math.sin((Math.PI / 2) * (s / CROWN.at));
  const u = Math.min(1, (s - CROWN.at) / CROWN.cap);
  return CROWN.bulge * Math.pow(Math.max(0, 1 - Math.pow(u, CROWN.n)), 1 / CROWN.n);
}
export function crownSlope(s) {
  if (s < CROWN.at) return (CROWN.bulge - CROWN.neck) * (Math.PI / 2 / CROWN.at) * Math.cos((Math.PI / 2) * (s / CROWN.at));
  const u = Math.min(0.9995, (s - CROWN.at) / CROWN.cap);
  const n = CROWN.n;
  return Math.max(-60, (-CROWN.bulge / CROWN.cap) * Math.pow(1 - Math.pow(u, n), 1 / n - 1) * Math.pow(u, n - 1));
}
// Height of the crown surface at radius r (on the occlusal table).
export function crownTopAt(r) {
  const u = Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, r / CROWN.bulge), CROWN.n)), 1 / CROWN.n);
  return Z.cej + CROWN.at + CROWN.cap * u;
}
// Dentino-enamel junction: the same crown shrunk by the enamel, which thins to nothing at the CEJ.
export function dejR(s) {
  if (s < CROWN.at) return crownR(s) - 6 * (s / CROWN.at);
  const u = Math.min(1, (s - CROWN.at) / (CROWN.cap - 9));
  return (CROWN.bulge - 6) * Math.pow(Math.max(0, 1 - Math.pow(u, CROWN.n)), 1 / CROWN.n);
}

// Access cavity: a straight-line opening that flares toward the occlusal surface.
export const HOLE = { low: 7.5, high: 9.5, floor: 112 };
export const holeR = (z) => HOLE.low + (HOLE.high - HOLE.low) * Math.max(0, Math.min(1, (z - 110) / (Z.top - 110)));
export const RIM = crownTopAt(HOLE.high);
// The rubber stop rests on the cavity rim: every working length is measured from here.
export const Z_REF = RIM;
export const WL_MM = (Z_REF - Z.constriction) / U;

// Root: tapers from the neck to a rounded apex.
export function rootHalf(z) {
  const t = Math.max(0, Math.min(1, (z - Z.apex) / (Z.cej - Z.apex)));
  return 2.6 + 9.9 * Math.pow(t, 0.78);
}
// Pulp chamber, right half, from the canal orifice up round the pulp horn to the axis.
const CHAMBER_RAW = [[6, Z.orifice + 1], [8.4, 103], [9.2, 110], [9.6, 116], [8.4, 121], [6.6, 120.6], [3.6, 118.9], [0, 118.5]];
// Smoothed through the raw points (Catmull-Rom), so the pulp horns read as soft tissue, not a polygon.
const SUB = 6;
export const CHAMBER = (() => {
  const pts = CHAMBER_RAW, out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = i + 2 < pts.length ? pts[i + 2] : [-pts[i][0], pts[i][1]];
    for (let j = 0; j < SUB; j++) {
      const t = j / SUB, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((a) => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
})();
export const CHAMBER_WALL = 2 * SUB + 1; // points up to [9.2, 110]

// The canal as found: 0.25 mm at the apical constriction, opening 0.03 mm per mm toward the crown,
// and flaring a little below the constriction into the apical foramen.
export function canalOrig(z) {
  if (z < Z.constriction) return 0.25 + 0.12 * ((Z.constriction - z) / (Z.constriction - Z.apex));
  return 0.25 + 0.03 * ((z - Z.constriction) / U);
}
// A tapered instrument whose tip has reached `low` cuts the canal to D0 + taper · (height above tip).
export function canalDia(z, cuts) {
  let dia = canalOrig(z);
  for (const cut of cuts) {
    if (z < cut.low) continue;
    const mm = (z - cut.low) / U;
    dia = Math.max(dia, cut.d0 + cut.taper * Math.min(mm, 16) * cut.share);
  }
  return dia;
}

// ISO instruments: tip diameter in hundredths of a mm sets the colour of the handle ring.
export const FILES = [
  { id: "k10", size: 10, taper: 0.02, ring: "purple", kind: "hand K-file" },
  { id: "f15", size: 15, taper: 0.02, ring: "white", kind: "hand K-file" },
  { id: "f20", size: 20, taper: 0.04, ring: "yellow", kind: "NiTi rotary" },
  { id: "f25", size: 25, taper: 0.06, ring: "red", kind: "NiTi rotary" },
  { id: "f30", size: 30, taper: 0.06, ring: "blue", kind: "NiTi rotary" },
  { id: "f35", size: 35, taper: 0.06, ring: "green", kind: "NiTi rotary" },
  { id: "f40", size: 40, taper: 0.06, ring: "black", kind: "NiTi rotary" },
];
export const FILE = Object.fromEntries(FILES.map((file) => [file.id, file]));
export const SHAPING = FILES.slice(1);
export const TOOL_LEN = 125;            // tip to chuck, 25 mm
export const FLUTES = 16 * U;           // 16 mm of cutting flutes
export const STOP_AT = Z_REF - Z.constriction; // rubber stop set to the working length
export const PARK = Z.top + 8;          // tip height with the carriage parked

// Radius (world units) of each instrument at height h above its tip.
export function toolR(id, h) {
  if (h < 0) return 0;
  const file = FILE[id];
  if (file) {
    const tip = Math.min(1, h / 1.6);
    const dia = file.size / 100 + file.taper * Math.min(h, FLUTES) / U;
    const r = (dia * U) / 2;
    return h <= FLUTES ? Math.max(0.35, r * (0.55 + 0.45 * tip)) : Math.max(r, 2.2);
  }
  if (id === "bur") {
    if (h <= 7) return Math.sqrt(Math.max(0, 3.5 * 3.5 - (h - 3.5) ** 2)) || 0.4;
    if (h <= 16) return 1.6 + 2.4 * Math.max(0, (h - 12) / 4);
    return 4;
  }
  if (id === "needle") return h < 104 ? 0.8 : h < 110 ? 2.2 : 4.6;
  if (id === "cone") return Math.max(0.4, ((0.4 + 0.06 * Math.min(h, 140) / U) * U) / 2 * Math.min(1, 0.6 + h / 3));
  if (id === "plugger") return h < 60 ? ((0.5 + 0.06 * h / U) * U) / 2 : 3.2;
  if (id === "gun") return h < 80 ? 1.6 : h < 92 ? 1.6 + (h - 80) * 0.18 : 3.8;
  return 0;
}

export const STAGES = [
  { key: "diagnose", label: "Diagnose", dur: 3.6 },
  { key: "access", label: "Access", dur: 4.6 },
  { key: "length", label: "Length", dur: 5.6 },
  { key: "shape", label: "Shape", dur: SHAPING.length * 1.9 },
  { key: "irrigate", label: "Irrigate", dur: 5 },
  { key: "fill", label: "Fill", dur: 7 },
  { key: "restore", label: "Restore", dur: 5.6 },
];
export const STARTS = STAGES.reduce((list, stage, index) => (list.push(index ? list[index - 1] + STAGES[index - 1].dur : 0), list), []);
export const TOTAL = STARTS[STARTS.length - 1] + STAGES[STAGES.length - 1].dur;

export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const span = (p, a, b) => clamp((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
export const LESION = 9;                // apical radiolucency radius, world units
const mm = (v) => v.toFixed(1);

// Everything the figure shows, as a function of time through the procedure.
export function stateAt(T) {
  const time = clamp(T, 0, TOTAL - 1e-6);
  let stage = STARTS.findIndex((start, index) => time >= start && time < start + STAGES[index].dur);
  if (stage < 0) stage = STAGES.length - 1;
  const p = (time - STARTS[stage]) / STAGES[stage].dur;
  const s = {
    stage, p, tool: null, alpha: 1, tip: PARK, dx: 0, spin: 0,
    cavity: Z.top + 2, chamberPulp: 1, canalPulp: 1, cuts: [], fluid: 0, fluidTop: Z.orifice,
    sealer: 0, cone: 0, packed: 0, fillTop: null, core: 0, coreTop: Z.orifice, cap: 1, lesion: 1, reading: null, mL: 0, text: "",
  };
  for (let j = 0; j <= stage; j++) apply(j, j < stage ? 1 : p, s);
  return s;
}

function reach(s, low) {
  // Locator: distance from the file tip to the apical constriction, once the tip is in the canal.
  if (s.tip > Z.orifice + 2) return null;
  return (s.tip - Z.constriction) / U;
}

function visit(p, a, b, depth, s, { hold = 0.16, peck = 0 } = {}) {
  // Park → canal orifice → depth, hold, then back to park, inside the window [a, b] of p.
  const q = span(p, a, b);
  const down = 0.5 - hold / 2, up = 0.5 + hold / 2;
  if (q < 0.18) return lerp(PARK, Z.orifice + 4, ease(q / 0.18));
  if (q < down) return lerp(Z.orifice + 4, depth, 1 - Math.pow(1 - (q - 0.18) / (down - 0.18), 2));
  if (q < up) return depth + peck * (1 - Math.cos(((q - down) / (up - down)) * Math.PI * 4)) / 2;
  return lerp(depth, PARK, ease((q - up) / (1 - up)));
}

function apply(j, p, s) {
  const final = p >= 1;
  if (j === 0) {
    s.text = `01 diagnose · inflamed pulp · lesion ${mm((LESION * 2) / U)} mm`;
  }
  if (j === 1) {
    s.tool = final ? null : "bur";
    const drill = span(p, 0.2, 0.74);
    if (p < 0.2) s.tip = lerp(PARK, Z.top - 0.2, ease(p / 0.2));
    else if (p < 0.74) s.tip = lerp(Z.top - 0.2, HOLE.floor, ease(drill));
    else s.tip = lerp(HOLE.floor, PARK, ease(span(p, 0.74, 1)));
    s.spin = p > 0.1 && p < 0.86 ? 1 : 0;
    s.dx = p > 0.2 && p < 0.74 ? 2.6 * Math.sin(drill * Math.PI * 6) * Math.sin(drill * Math.PI) : 0;
    s.alpha = final ? 0 : Math.min(1, p / 0.05, (1 - p) / 0.05);
    const bottom = p < 0.2 ? Z.top + 2 : lerp(Z.top - 0.2, HOLE.floor, ease(drill));
    s.cavity = Math.min(s.cavity, bottom);
    s.chamberPulp = s.cavity < Z.roof ? 1 - ease(span(p, 0.74, 0.98)) * 0.85 : 1;
    if (final) s.chamberPulp = 0.15;
    const depth = (Z_REF - Math.max(s.cavity, HOLE.floor)) / U;
    s.text = s.cavity > Z.top ? "02 access · round bur" : s.cavity < Z.roof ? `02 access · roof off · ${mm(Math.max(0, depth))} mm` : `02 access · bur ${mm(Math.max(0, depth))} mm`;
  }
  if (j === 2) {
    s.tool = final ? null : "k10";
    s.tip = visit(p, 0, 1, Z.constriction, s, { hold: 0.2 });
    s.alpha = final ? 0 : Math.min(1, p / 0.04, (1 - p) / 0.04);
    const low = visit(Math.min(p, 0.4), 0, 1, Z.constriction, s, { hold: 0.2 });
    s.cuts.push({ d0: 0.1, taper: 0.02, low, share: 1 });
    s.canalPulp = 1 - 0.55 * ease(span(p, 0.2, 0.6));
    s.chamberPulp = Math.min(s.chamberPulp, 0.15 * (1 - span(p, 0, 0.3)));
    s.reading = final ? null : reach(s);
    const at = (Z_REF - s.tip) / U;
    s.text = s.reading === null ? `03 length · #10 K-file` : Math.abs(s.reading) < 0.05 ? `03 length · apex · WL ${mm(WL_MM)} mm` : `03 length · ${mm(at)} mm · apex ${mm(s.reading)}`;
  }
  if (j === 3) {
    const n = SHAPING.length;
    const index = Math.min(n - 1, Math.floor(p * n));
    const done = final ? n : index;
    for (let i = 0; i < n; i++) {
      if (i > index && !final) break;
      const file = SHAPING[i];
      const q = i < done ? 1 : p * n - index;
      const low = visit(Math.min(q, 0.42), 0, 1, Z.constriction, s);
      s.cuts.push({ d0: file.size / 100, taper: file.taper, low, share: 1 });
    }
    s.canalPulp = Math.max(0, 0.45 * (1 - ease(p * n)));
    if (final) { s.tool = null; s.tip = PARK; s.reading = null; s.text = `04 shape · 40/.06 · ${mm(WL_MM)} mm`; return; }
    const file = SHAPING[index];
    const q = p * n - index;
    s.tool = file.id;
    s.tip = visit(q, 0, 1, Z.constriction, s, { peck: index > 0 ? 3 : 0 });
    s.alpha = Math.min(1, q / 0.05, (1 - q) / 0.05);
    s.spin = file.kind === "NiTi rotary" && s.tip < PARK - 2 ? 1 : 0;
    s.reading = reach(s);
    s.text = `04 shape · ${file.size}/.${String(Math.round(file.taper * 100)).padStart(2, "0")} · ${mm(Math.max(0, (Z_REF - s.tip) / U))} mm`;
  }
  if (j === 4) {
    const depth = Z.constriction + 2 * U;
    const flow = span(p, 0.2, 0.8);
    s.tool = final ? null : "needle";
    if (p < 0.2) s.tip = lerp(PARK, depth, ease(p / 0.2));
    else if (p < 0.8) s.tip = depth + 2.5 * U * flow + 4 * Math.sin(flow * Math.PI * 6) * Math.sin(flow * Math.PI);
    else s.tip = lerp(depth + 2.5 * U, PARK, ease(span(p, 0.8, 1)));
    s.alpha = final ? 0 : Math.min(1, p / 0.04, (1 - p) / 0.04);
    s.fluid = ease(span(p, 0.18, 0.4));
    s.fluidTop = lerp(depth, Z.roof - 2, ease(span(p, 0.2, 0.7)));
    s.mL = 3 * flow;
    s.canalPulp = 0;
    s.text = p < 0.2 ? `05 irrigate · 30G side-vent at ${mm(WL_MM - 2)} mm` : `05 irrigate · NaOCl 3% · ${s.mL.toFixed(1)} mL`;
  }
  if (j === 5) {
    const depthPack = Z.constriction + 5 * U;
    s.fluid = 1 - ease(span(p, 0, 0.1));
    if (p < 0.1) { s.tool = null; s.tip = PARK; s.text = "06 fill · dry with paper points"; }
    s.sealer = ease(span(p, 0.1, 0.2));
    if (p >= 0.1 && p < 0.4) {
      const q = span(p, 0.1, 0.4);
      s.tool = "cone";
      s.alpha = Math.min(1, q / 0.06);
      s.tip = q < 0.3 ? lerp(PARK, Z.orifice + 4, ease(q / 0.3)) : lerp(Z.orifice + 4, Z.constriction, 1 - Math.pow(1 - (q - 0.3) / 0.7, 2));
      s.text = `06 fill · master cone 40/.06 · ${mm(Math.max(0, (Z_REF - s.tip) / U))} mm`;
    }
    if (p >= 0.4) { s.cone = 1; s.fillTop = Z.orifice + 1; }
    if (p >= 0.4 && p < 0.5) { s.tool = null; s.tip = lerp(Z.constriction, PARK, ease(span(p, 0.4, 0.5))); s.text = "06 fill · cone at length, tug-back"; }
    if (p >= 0.5 && p < 0.74) {
      const q = span(p, 0.5, 0.74);
      s.tool = "plugger";
      s.alpha = Math.min(1, q / 0.06, (1 - q) / 0.06);
      s.tip = visit(q, 0, 1, depthPack, s, { hold: 0.18 });
      s.spin = 0;
      if (q < 0.59) s.fillTop = Math.min(Z.orifice + 1, Math.max(s.tip, depthPack));
      else s.fillTop = depthPack;
      s.packed = ease(span(q, 0.4, 0.58));
      s.text = `06 fill · heat down-pack · ${mm(Math.max(0, (Z_REF - s.tip) / U))} mm`;
    }
    if (p >= 0.74) { s.fillTop = depthPack; s.packed = 1; }
    if (p >= 0.74 && p < 1) {
      const q = span(p, 0.74, 1);
      s.tool = "gun";
      s.alpha = Math.min(1, q / 0.05, (1 - q) / 0.05);
      const fillQ = span(q, 0.32, 0.82);
      if (q < 0.32) s.tip = lerp(PARK, depthPack, ease(q / 0.32));
      else if (q < 0.82) s.tip = lerp(depthPack, Z.orifice + 1, fillQ);
      else s.tip = lerp(Z.orifice + 1, PARK, ease(span(q, 0.82, 1)));
      s.fillTop = lerp(depthPack, Z.orifice + 1, fillQ);
      s.text = q < 0.32 ? "06 fill · backfill needle" : `06 fill · backfill · ${mm((s.fillTop - Z.constriction) / U)} mm sealed`;
    }
    if (final) { s.tool = null; s.tip = PARK; s.fillTop = Z.orifice + 1; s.text = `06 fill · ${mm((Z.orifice + 1 - Z.constriction) / U)} mm sealed to the orifice`; }
  }
  if (j === 6) {
    s.core = 1;
    s.coreTop = lerp(Z.orifice + 1, RIM + 0.6, ease(span(p, 0, 0.3)));
    s.cap = 1 - ease(span(p, 0.3, 0.7));
    s.lesion = 1 - ease(span(p, 0.72, 1));
    s.text = p < 0.3 ? "07 restore · composite core" : p < 0.72 ? (s.cap > 0.01 ? "07 restore · crown" : "07 restore · crown seated") : `07 recall · lesion ${mm((LESION * 2 * s.lesion) / U)} mm`;
  }
}
