import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../kit/tube.mjs";
import { kitScript } from "../kit/inline.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const { U, Z, CROWN, CROWN_H, PARK, TOOL_LEN, STOP_AT } = M;

const WIDTH = 600;
const HEIGHT = 560;

// ---------- plan ----------
const PLATE = { x: -134, y: -62, w: 294, d: 142, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const PLINTH = { x: -84, y: -48, w: 156, d: 62, r: 3 };
const PLINTH_H = 8;
const BLOCK = { x: -55, y: -34, w: 110, d: 34, r: 0.4 };
const END = { x: -84, y: -38, w: 9, d: 38, r: 1 };
const JAW_L = { x: -64, y: -38, w: 9, d: 38, r: 1 };
const JAW_R = { x: 55, y: -38, w: 9, d: 38, r: 1 };
const JAW_TOP = 44;
const COL = { x: 108, y: -40, w: 16, d: 16, r: 1.5 };
const COL_TOP = PARK + TOOL_LEN + 34;
const FLANGE = { x: 98, y: -50, w: 36, d: 36, r: 3 };
const LOC = { x: 92, y: 20, w: 56, d: 40, r: 4 };
const LOC_H = 20;
const DIAL = [119, 40];
const DIAL_R = 13;
const STAND = { x: -116, y: 28, w: 62, d: 20, r: 3 };
const STAND_H = 12;
const CARR = PARK + TOOL_LEN - 6;        // carriage block bottom at park
const CARR_PLAN = { x: 104, y: -44, w: 24, d: 24, r: 2 };
const NUT = PARK + TOOL_LEN;             // chuck nut bottom at park

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [COL.x + 16, COL.y, COL_TOP + 4], [COL.x, COL.y + 16, COL_TOP + 4], [0, 0, NUT + 15]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 60, elevation: 30 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const f2 = (v) => (Math.round(v * 100) / 100).toString();
const pathScreen = (pts, close = false) => k.pathOf(pts.map(at), close);
const zFrame = (o) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const xFrame = (o, sign = 1) => G.frameOf(o, [sign, 0, 0], [0, 1, 0], [0, 0, 1]);
const yFrame = (o, sign = 1) => G.frameOf(o, [0, sign, 0], [1, 0, 0], [0, 0, 1]);

// The cut face: local (x, -z) in the plane y = 0.
const FACE = k.sideMatrix([0, 0], 0, P, "left");
const fp = (pts, close = false) => (pts.length ? "M" + pts.map(([x, z]) => `${f2(x)} ${f2(-z)}`).join("L") + (close ? "Z" : "") : "");
const mirror = (right) => [...right, ...right.slice().reverse().map(([x, z]) => [-x, z])];

// ---------- base ----------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3.5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Endo ruler: millimetre ticks at 5:1, a major every 5 mm.
  const strip = { x: -46, y: 64, w: 132, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 6, strip.x + strip.w - 6, U, 5, strip.y + 0.01, 0.8, [2.2, 4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2.6, strip.y + 4, 0.8]), at([strip.x + strip.w - 2.6, strip.y + 4, 0.8])], { size: 0.45 }));
  // Label plate.
  const label = { x: -120, y: 58, w: 40, d: 13, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }));
  out.push(L([[label.x + 5, 24], [label.x + 5, 16], [label.x + 5, 11]].map(([x, len], i) => k.lineOnTop([x, label.y + 3.6 + i * 2.9], [x + len, label.y + 3.6 + i * 2.9], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + label.w - 3.4, label.y + 3.4, 0.8]), at([label.x + label.w - 3.4, label.y + label.d - 3.4, 0.8])], { size: 0.45 }));
  return out.join("");
}

// ---------- column, ruler, carriage ----------
const tickZ = (mm) => M.Z_REF + TOOL_LEN - 11 - U * mm;
function columnSvg() {
  const out = [];
  out.push(S(k.slabOf(COL, 6, COL_TOP - 6, P, 3, 0.5), { tone: "mid", inner: L([60, 120].map((z) => k.sideSeam(COL, z, P, 3)).join(""), { tone: "faint" }) }));
  const minor = [], major = [];
  for (let mm = -2; mm <= 24; mm++) {
    const z = tickZ(mm);
    const big = mm % 5 === 0;
    (big ? major : minor).push(k.segment([COL.x + COL.w, COL.y + COL.d, z], [COL.x + COL.w - (big ? 6 : 3.4), COL.y + COL.d, z], P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  // T-slot down the +x face: a closed slot with its floor in shade.
  const slot = (y0, y1, z0, z1, r) => { const pts = []; for (let i = 0; i <= 8; i++) { const a = Math.PI + (Math.PI * i) / 8; pts.push([COL.x + COL.w, (y0 + y1) / 2 + ((y1 - y0) / 2) * Math.cos(a), z1 - r - r * Math.sin(a) * -1]); } for (let i = 0; i <= 8; i++) { const a = (Math.PI * i) / 8; pts.push([COL.x + COL.w, (y0 + y1) / 2 + ((y1 - y0) / 2) * Math.cos(a), z0 + r - r * Math.sin(a)]); } return k.pathOf(pts.map(at), true); };
  out.push(`<path class="rc-hole" d="${slot(-35, -29, 14, COL_TOP - 12, 3)}"/>`, L(slot(-35, -29, 14, COL_TOP - 12, 3), { tone: "lo" }));
  out.push(L(k.segment([COL.x + COL.w, COL.y + COL.d, tickZ(0)], [COL.x + COL.w - 8, COL.y + COL.d, tickZ(0)], P), { tone: "hi" }));
  out.push(S(k.slabOf({ x: COL.x - 2, y: COL.y - 2, w: 20, d: 20, r: 2 }, COL_TOP, 4, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([COL.x + 8, COL.y + 8, COL_TOP + 4])], { size: 0.55 }));
  return out.join("");
}
function flange() {
  const out = [S(k.slabOf(FLANGE, 0, 6, P, 4, 0.8), { tone: "mid" })];
  const screws = k.corners(FLANGE, 5);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 6, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 6])), { size: 0.5 }));
  return out.join("");
}
// Clip that shows the column only above the carriage's top plate (moves with the carriage).
const CARR_TOP = CARR + 26;
const upperClip = (() => {
  const a = at([COL.x, COL.y + COL.d, CARR_TOP]), b = at([COL.x + COL.w, COL.y + COL.d, CARR_TOP]), c = at([COL.x + COL.w, COL.y, CARR_TOP]);
  const up = (p) => [p[0], p[1] - 600];
  return k.pathOf([[a[0] - 2, a[1]], a, b, c, [c[0] + 2, c[1]], up([c[0] + 2, c[1]]), up([a[0] - 2, a[1]])], true);
})();
function carriage() {
  const out = [];
  const plate = { x: 103, y: -45, w: 26, d: 26, r: 2.5 };
  out.push(S(k.slabOf(CARR_PLAN, CARR, 24, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(CARR_PLAN, CARR + 12, P, 4), { tone: "faint" }) }));
  out.push(S(k.slabOf(plate, CARR + 24, 2, P, 4, 0.4), { tone: "mid" }));
  out.push(D(k.corners(plate, 3).map(([x, y]) => at([x, y, CARR + 26])), { size: 0.45 }));
  // Index tongue: its lit lower edge reads depth on the column scale.
  const tongue = { x: 119, y: -21, w: 6, d: 1.2, r: 0.3 };
  out.push(S(k.slabOf(tongue, CARR - 5, 5.2, P, 2), { tone: "mid" }));
  out.push(L(k.segment([tongue.x, -19.8, CARR - 5], [tongue.x + 6, -19.8, CARR - 5], P), { tone: "lit" }));
  // Gib screws on the front face, lock knob on the +x face.
  out.push(L([[108, CARR + 7], [124, CARR + 7], [108, CARR + 17], [124, CARR + 17]].map(([x, z]) => k.sideRing([x, -20, z], 1.3, "y", P, 14)).join(""), { tone: "lo" }));
  out.push(D([[108, CARR + 7], [124, CARR + 7], [108, CARR + 17], [124, CARR + 17]].map(([x, z]) => at([x, -20, z])), { size: 0.4 }));
  const KF = xFrame([128, -32, CARR + 12]);
  out.push(S(G.disc(0, 3, 2.4, KF, P), { tone: "mid" }));
  out.push(S(G.disc(3, 9, 5.2, KF, P, { bevel: 0.4 }), { tone: "mid", inner: k.fadedSvg(G.ribsOf(KF, 3, 9, 5.2, 28, P, { fade: [0.1, 0.55] }), { tone: "lo" }) }));
  out.push(L(G.circleOf(KF, 9, 2, P), { tone: "faint" }));
  return out.join("");
}
function head() {
  // Contra-angle handpiece: a head over the tooth, a neck and a grip running back to a clamp on the carriage.
  const out = [];
  const zc = NUT + 6;
  out.push(S(k.cylinder(0, 0, 7.6, NUT, 12, P, 48, 0.5), { tone: "hi", inner: L(k.sideArc(0, 0, 7.6, NUT + 3, P, 32), { tone: "faint" }) }));
  out.push(S(k.cylinder(0, 0, 6.6, NUT + 12, 1.4, P, 40, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, 4.8, NUT + 13.4, 1.4, P, 32, 0.3), { tone: "hi" }));
  out.push(D([at([0, 0, NUT + 14.8])], { size: 0.5, tone: "hi" }));
  const BF = xFrame([0, 0, zc]);
  out.push(S(G.solidOf([[6.4, 4.1], [14, 4.4, 1], [24, 4.9, 1], [35.4, 5.4]], BF, P), { tone: "hi" }));
  out.push(S(G.disc(35.4, 37, 6.9, BF, P), { tone: "mid" }));
  out.push(S(G.disc(37, 92, 6.4, BF, P), { tone: "hi", inner: k.fadedSvg(G.ribsOf(BF, 52, 80, 6.4, 30, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) + L(G.arcOf(BF, 86, 6.4, P), { tone: "faint" }) }));
  const clamp = { x: 92, y: -34, w: 12, d: 42, r: 2 };
  out.push(S(k.slabOf(clamp, NUT - 4, 20, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(clamp, zc, P, 4), { tone: "faint" }) }));
  out.push(L(k.ring(98, -26, 2, NUT + 16, P, 16), { tone: "lo" }), D([at([98, -26, NUT + 16]), at([98, -12, NUT + 16])], { size: 0.45 }));
  // File-clip block on the clamp's front face.
  out.push(S(k.slabOf({ x: 94.5, y: 8, w: 7, d: 2.4, r: 0.5 }, NUT + 1, 8, P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([98, 10.4, NUT + 7])], { size: 0.45 }));
  return out.join("");
}

// ---------- vise ----------
function viseBack() {
  const out = [];
  out.push(S(k.slabOf(PLINTH, 0, PLINTH_H, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLINTH, 4), PLINTH_H, P), { tone: "faint" }));
  const screws = [[PLINTH.x + 4.5, PLINTH.y + 4.5], [PLINTH.x + PLINTH.w - 4.5, PLINTH.y + 4.5], [PLINTH.x + PLINTH.w - 4.5, PLINTH.y + PLINTH.d - 4.5], [PLINTH.x + 4.5 + 22, PLINTH.y + PLINTH.d - 4.5]];
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.8, PLINTH_H, P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, PLINTH_H])), { size: 0.45 }));
  // Fixed end block carrying the screw nut.
  out.push(S(k.slabOf(END, PLINTH_H, 32, P, 3, 0.6), { tone: "mid" }));
  out.push(D([at([END.x + 4.5, END.y + 5, 40]), at([END.x + 4.5, END.y + END.d - 5, 40])], { size: 0.45 }));
  // Guide rods and the lead screw between end block and moving jaw.
  for (const [y, z, r] of [[-31, 18, 2], [-19, 30, 2.8], [-7, 18, 2]]) {
    const F = xFrame([END.x + END.w, y, z]);
    const len = JAW_L.x - (END.x + END.w);
    if (r > 2.5) out.push(S(G.disc(0, len, r, F, P), { tone: "mid", inner: k.fadedSvg(G.ribsOf(F, 0, len, r, 0, P), {}) + L(Array.from({ length: 7 }, (_, i) => G.arcOf(F, 1 + i * 1.2, r, P)).join(""), { tone: "lo" }) }));
    else out.push(S(G.disc(0, len, r, F, P), { tone: "hi" }));
  }
  // Screw out through the end block to a knurled knob with a tommy bar.
  const SF = xFrame([END.x, -19, 30], -1);
  out.push(S(G.disc(0, 6, 2.8, SF, P), { tone: "mid", inner: L(Array.from({ length: 4 }, (_, i) => G.arcOf(SF, 1 + i * 1.3, 2.8, P)).join(""), { tone: "lo" }) }));
  out.push(S(G.disc(6, 16, 6.4, SF, P, { bevel: 0.5 }), { tone: "mid", inner: k.fadedSvg(G.ribsOf(SF, 6, 16, 6.4, 36, P, { fade: [0.1, 0.55] }), { tone: "lo" }) }));
  out.push(L(G.circleOf(SF, 16, 2.4, P), { tone: "faint" }));
  out.push(S(k.slabOf(JAW_L, PLINTH_H, JAW_TOP - PLINTH_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(JAW_L, 34, P, 3), { tone: "faint" }) }));
  out.push(D([at([JAW_L.x + 4.5, JAW_L.y + 6, JAW_TOP]), at([JAW_L.x + 4.5, JAW_L.y + JAW_L.d - 6, JAW_TOP])], { size: 0.45 }));
  return out.join("");
}
function jawRight() {
  const out = [S(k.slabOf(JAW_R, PLINTH_H, JAW_TOP - PLINTH_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(JAW_R, 34, P, 3), { tone: "faint" }) })];
  out.push(L([[-28, 22], [-10, 22]].map(([y, z]) => k.sideRing([JAW_R.x + JAW_R.w, y, z], 2.2, "x", P, 18)).join(""), { tone: "lo" }));
  out.push(D([[-28, 22], [-10, 22]].map(([y, z]) => at([JAW_R.x + JAW_R.w, y, z])), { size: 0.45 }));
  out.push(D([at([JAW_R.x + 4.5, JAW_R.y + 6, JAW_TOP]), at([JAW_R.x + 4.5, JAW_R.y + JAW_R.d - 6, JAW_TOP])], { size: 0.45 }));
  return out.join("");
}

// ---------- specimen: block, crown back half, cut face ----------
function blockSvg() {
  return S(k.slabOf(BLOCK, PLINTH_H, Z.cej - PLINTH_H, P, 2), { tone: "mid" });
}
function halfLathe(radius, slope, s0, s1, z0, id, style) {
  // A convex turned body cut at y = 0: draw the whole body, clipped to the hull of its back half.
  const F = zFrame([0, 0, z0]);
  const knots = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const s = s0 + (s1 - s0) * (1 - Math.pow(1 - i / n, 1.6));
    knots.push(i === n ? [s1, 0] : [s, radius(s), i > 0 ? 1 : 0]);
  }
  const paths = G.solidOf(knots, F, P, { smooth: { slope }, rows: 6 });
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const s = s0 + ((s1 - s0) * i) / 80;
    const r = radius(s);
    for (let j = 0; j <= 36; j++) pts.push(at(G.pointOf(F, s, r, Math.PI + (Math.PI * j) / 36)));
  }
  const hull = k.pathOf(G.hullOf(pts), true);
  return `<clipPath id="${id}"><path d="${hull}"/></clipPath><g clip-path="url(#${id})">${S({ ...paths, outline: "" }, style)}</g>${L(hull, { tone: style.tone ?? "hi", className: "iso-edge" })}`;
}
const capR = (s) => {
  const c = { neck: CROWN.neck + 1.4, bulge: CROWN.bulge + 1.4, at: CROWN.at, cap: CROWN.cap + 1.4, n: CROWN.n };
  if (s < c.at) return c.neck + (c.bulge - c.neck) * Math.sin((Math.PI / 2) * (s / c.at));
  const u = Math.min(1, (s - c.at) / c.cap);
  return c.bulge * Math.pow(Math.max(0, 1 - Math.pow(u, c.n)), 1 / c.n);
};
const capSlope = (s) => {
  const h = 0.01;
  return Math.max(-60, (capR(Math.min(s + h, CROWN_H + 1.4)) - capR(Math.max(0, s - h))) / (2 * h));
};
const CAP_H = CROWN_H + 1.4;

function crownBack() {
  return halfLathe(M.crownR, M.crownSlope, 0, CROWN_H, Z.cej, "rc-crown-half", { tone: "hi" });
}

// Static drawing on the cut face, behind and in front of the lesion.
function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const ROOT_TIP = Z.apex - M.rootHalf(Z.apex);
function rootRight() {
  const pts = [];
  for (let z = Z.cej; z >= Z.apex; z -= 2) pts.push([M.rootHalf(z), z]);
  const r = M.rootHalf(Z.apex);
  for (let i = 0; i <= 10; i++) pts.push([r * Math.cos((Math.PI / 2) * (i / 10)), Z.apex - r * Math.sin((Math.PI / 2) * (i / 10))]);
  return pts;
}
const SOCKET = 2.4;
function socketRight() {
  const pts = [];
  for (let z = Z.crest; z >= Z.apex; z -= 2) pts.push([M.rootHalf(z) + SOCKET, z]);
  const r = M.rootHalf(Z.apex) + SOCKET;
  for (let i = 0; i <= 12; i++) pts.push([r * Math.cos((Math.PI / 2) * (i / 12)), Z.apex - r * Math.sin((Math.PI / 2) * (i / 12))]);
  return pts;
}
function crownRight(radius = M.crownR, h = CROWN_H) {
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const s = h * (1 - Math.pow(1 - i / 48, 1.5));
    pts.push([radius(s), Z.cej + s]);
  }
  pts[pts.length - 1] = [0, Z.cej + h];
  return pts;
}
function dejRight() {
  const pts = [];
  const top = CROWN.at + CROWN.cap - 9;
  for (let i = 0; i <= 40; i++) {
    const s = top * (1 - Math.pow(1 - i / 40, 1.5));
    pts.push([M.dejR(s), Z.cej + s]);
  }
  pts[pts.length - 1] = [0, Z.cej + top];
  return pts;
}
const half = (pts) => pts.slice(0, -1);
const closed = (right) => {
  const r = right[right.length - 1][0] === 0 ? right.slice(0, -1) : right;
  const top = right[right.length - 1];
  return [...r, ...(top[0] === 0 ? [top] : []), ...r.slice().reverse().map(([x, z]) => [-x, z])];
};
function faceBack() {
  const out = [];
  const W = BLOCK.w / 2;
  out.push(`<path class="rc-bone" d="${fp([[-W, PLINTH_H], [W, PLINTH_H], [W, Z.crest], [-W, Z.crest]], true)}"/>`);
  out.push(`<path class="rc-gum" d="${fp([[-W, Z.crest], [W, Z.crest], [W, Z.cej], [-W, Z.cej]], true)}"/>`);
  // Trabecular bone: closed little rings, kept off the socket.
  const rand = rng(7);
  const rings = [];
  const placed = [];
  for (let tries = 0; tries < 3000 && placed.length < 150; tries++) {
    const x = -W + 3 + rand() * (2 * W - 6);
    const z = PLINTH_H + 3 + rand() * (Z.crest - PLINTH_H - 9);
    const rx = 1.2 + rand() * 2.4;
    const ry = rx * (0.45 + rand() * 0.4);
    const reach = z > ROOT_TIP - 6 ? M.rootHalf(Math.max(z, Z.apex)) + SOCKET + rx + 2 : Math.hypot(x, z - Z.apex) < M.rootHalf(Z.apex) + SOCKET + rx + 3 ? Infinity : 0;
    if (Math.abs(x) < reach) continue;
    if (Math.abs(x) > W - rx - 1.2 || z + ry > Z.crest - 3) continue;
    if (placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + rx + 1.4)) continue;
    placed.push([x, z, rx]);
    const tilt = rand() * Math.PI;
    const pts = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      const ex = rx * Math.cos(a), ez = ry * Math.sin(a);
      return [x + ex * Math.cos(tilt) - ez * Math.sin(tilt), z + ex * Math.sin(tilt) + ez * Math.cos(tilt)];
    });
    rings.push(fp(pts, true));
  }
  out.push(`<path class="rc-trab" d="${rings.join("")}"/>`);
  // Cortical crest with the lamina dura running down round the socket.
  const socket = socketRight();
  const socketPath = [...socket.map(([x, z]) => [-x, z]), ...socket.slice(0, -1).reverse()];
  out.push(`<path class="rc-pdl" d="${fp(socketPath, true)}"/>`);
  out.push(L(fp([[-W, Z.crest], [-socket[0][0], Z.crest]]) + fp([[socket[0][0], Z.crest], [W, Z.crest]]), { tone: "lo" }));
  out.push(L(fp(socketPath), { tone: "lo" }));
  // Face edge.
  out.push(L(fp([[-W, Z.cej], [-W, PLINTH_H], [W, PLINTH_H], [W, Z.cej]]), { tone: "mid" }));
  return out.join("");
}
function faceTooth() {
  const out = [];
  const root = rootRight();
  const crown = crownRight();
  const dej = dejRight();
  out.push(`<path class="rc-enamel" d="${fp(closed(crown), true)}"/>`);
  const dentin = closed([...root.slice().reverse(), ...dej]);
  out.push(`<path class="rc-dentin" d="${fp(dentin, true)}"/>`);
  out.push(L(fp(closed(dej)), { tone: "faint" }));
  out.push(L(fp([...root.map(([x, z]) => [-x, z]), ...root.slice(0, -1).reverse()]), { tone: "lo" }));
  out.push(L(fp(closed(crown)), { tone: "mid" }));
  // Top of the block on either side of the tooth.
  const W = BLOCK.w / 2;
  out.push(L(fp([[-W, Z.cej], [-M.crownR(0), Z.cej]]) + fp([[M.crownR(0), Z.cej], [W, Z.cej]]), { tone: "mid" }));
  return out.join("");
}

// ---------- tools ----------
const TOOL_SPEC = {
  bur: { top: 18, cls: "rc-steel", parts: [{ h0: 16, h1: TOOL_LEN, r: 4, tone: "mid" }] },
  needle: { top: 104, cls: "rc-steel", parts: [{ h0: 104, h1: 110, r: 2.2, tone: "mid" }, { h0: 110, h1: TOOL_LEN, r: 4.6, tone: "hi", cls: "rc-hub" }] },
  cone: { top: TOOL_LEN, cls: "rc-gpt", parts: [] },
  plugger: { top: 62, cls: "rc-steel", parts: [{ h0: 60, h1: 98, r: 3.2, tone: "mid" }, { h0: 98, h1: TOOL_LEN, r: 4.6, tone: "hi", cls: "rc-sleeve" }] },
  gun: { top: 82, cls: "rc-steel", parts: [{ h0: 80, h1: TOOL_LEN, r: 3.8, tone: "mid" }] },
};
for (const file of M.FILES) TOOL_SPEC[file.id] = { top: 117, cls: "rc-steel", parts: [{ h0: STOP_AT, h1: STOP_AT + 3.6, r: 5.4, tone: "mid", cls: "rc-stop" }, { h0: 116, h1: TOOL_LEN, r: 2.7, tone: "hi", cls: `rc-iso rc-c-${file.ring}` }] };

function toolOutline(id, top) {
  const right = [];
  const steps = Math.ceil(top / 0.5);
  for (let i = 0; i <= steps; i++) {
    const h = (top * i) / steps;
    right.push([M.toolR(id, h), h]);
  }
  const pts = [...right.map(([r, h]) => [r, h]), ...right.slice().reverse().map(([r, h]) => [-r, h])];
  return fp(pts, true);
}
function toolSvg(id) {
  const spec = TOOL_SPEC[id];
  const face = [`<path class="${spec.cls}" d="${toolOutline(id, spec.top)}"/>`];
  // Shine down the lit side.
  const shine = [];
  for (let i = 0; i <= 40; i++) { const h = (spec.top * i) / 40; shine.push([-M.toolR(id, h) * 0.62, h]); }
  for (let i = 40; i >= 0; i--) { const h = (spec.top * i) / 40; shine.push([-M.toolR(id, h) * 0.18, h]); }
  if (id !== "needle") face.push(`<path class="rc-shine" d="${fp(shine, true)}"/>`);
  face.push(`<path class="rc-flutes" data-flutes="${id}" d=""/>`);
  if (id === "needle") face.push(L(fp([[0, 1.4], [0.8, 1.4], [0.8, 4.2], [0, 4.2]], true), { tone: "lo" }));
  face.push(`<path class="iso-line rc-tool-edge" data-tone="lit" d="${toolOutline(id, spec.top)}"/>`);
  const solids = spec.parts.map((part) => S(k.cylinder(0, 0, part.r, part.h0, part.h1 - part.h0, P, 32, 0.3), { tone: part.tone, className: part.cls }));
  return `<g data-tool="${id}" opacity="0" style="display:none"><g data-tool-face transform="${FACE}">${face.join("")}</g>${solids.join("")}</g>`;
}

// ---------- apex locator ----------
const DIAL_FROM = (-90 * Math.PI) / 180;
const DIAL_ZERO = (10 * Math.PI) / 180;
const DIAL_OVER = (30 * Math.PI) / 180;
function locator() {
  const out = [`<path class="iso-halo" d="${k.haloOf(LOC, 0, LOC_H, P)}"/>`];
  out.push(S(k.slabOf(LOC, 0, LOC_H, P, 6, 1), { tone: "mid", inner: L(k.sideSeam(LOC, 4, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(LOC, 3), LOC_H, P, 6), { tone: "faint" }));
  const [cx, cy] = DIAL;
  out.push(S(k.cylinder(cx, cy, DIAL_R + 2, LOC_H, 1.4, P, 64, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, DIAL_R, LOC_H + 1.4, 0.6, P, 64), { tone: "hi", crease: "lo" }));
  const top = LOC_H + 2;
  const t = k.radialTicks(cx, cy, DIAL_R - 1.6, 12, 4, top, [1.4, 2.8], P, DIAL_FROM, DIAL_ZERO - DIAL_FROM);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  const arc = (r, a0, a1) => Array.from({ length: 25 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / 24; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; });
  out.push(L(k.onTop(arc(DIAL_R - 1.6, DIAL_FROM, DIAL_OVER), top, P), { tone: "lo" }));
  out.push(L(k.onTop(arc(DIAL_R - 1.6, DIAL_ZERO, DIAL_OVER), top, P), { tone: "red" }));
  out.push(L(k.onTop([[cx + (DIAL_R - 1.6) * Math.sin(DIAL_ZERO), cy - (DIAL_R - 1.6) * Math.cos(DIAL_ZERO)], [cx + (DIAL_R - 5.4) * Math.sin(DIAL_ZERO), cy - (DIAL_R - 5.4) * Math.cos(DIAL_ZERO)]], top, P), { tone: "hi" }));
  out.push(k.faceTextSvg(k.topMatrix([cx + 1.6, cy + 5.6], top, P), "APEX", { size: 2.6, tone: "lo" }));
  out.push(L(k.ring(cx, cy, DIAL_R, LOC_H + 2, P, 64), { tone: "lo" }));
  out.push(L(k.ring(cx, cy, 1.4, top, P, 16), { tone: "mid" }));
  // Buttons, LED, file port on top.
  for (const [x, y] of [[140, 32], [140, 41]]) {
    out.push(S(k.cylinder(x, y, 2.6, LOC_H, 1.2, P, 24, 0.3), { tone: "mid" }));
  }
  out.push(L(k.ring(141, 51, 2, LOC_H, P, 18), { tone: "lo" }));
  out.push(`<circle class="rc-led" data-led cx="${f2(at([141, 51, LOC_H])[0])}" cy="${f2(at([141, 51, LOC_H])[1])}" r="1.3"/>`);
  out.push(S(k.cylinder(143, 25, 2.8, LOC_H, 3.6, P, 28, 0.3), { tone: "mid" }));
  out.push(L(k.ring(143, 25, 1.2, LOC_H + 3.6, P, 16), { tone: "lo" }));
  out.push(D(k.corners(LOC, 4.2).filter(([x, y]) => !(x > 140 && y < 30)).map(([x, y]) => at([x, y, LOC_H])), { size: 0.45 }));
  return out.join("");
}
const NEEDLE_REST = (-98 * Math.PI) / 180;

// ---------- file stand ----------
const SLOTS = M.FILES.map((file, i) => ({ id: file.id, ring: file.ring, x: STAND.x + 7.5 + i * 7.8, y: STAND.y + 10 }));
function standSvg() {
  const out = [`<path class="iso-halo" d="${k.haloOf(STAND, 0, STAND_H, P)}"/>`];
  out.push(S(k.slabOf(STAND, 0, STAND_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(STAND, 3, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(STAND, 2.6), STAND_H, P, 4), { tone: "faint" }));
  for (const slot of SLOTS) out.push(`<path class="rc-hole" d="${k.pathOf(k.circleRing(slot.x, slot.y, 2.2, 20).map(([x, y]) => at([x, y, STAND_H])), true)}"/>`, L(k.ring(slot.x, slot.y, 2.2, STAND_H, P, 20), { tone: "lo" }));
  for (const slot of SLOTS) {
    const file = M.FILE[slot.id];
    const shank = L(k.segment([slot.x, slot.y, STAND_H], [slot.x, slot.y, STAND_H + 16], P), { tone: "mid" }) + D([at([slot.x, slot.y, STAND_H])], { size: 0.6, tone: "hi" });
    const handle = S(k.cylinder(slot.x, slot.y, 2.5, STAND_H + 16, 11, P, 24, 0.3), { tone: "hi", className: `rc-iso rc-c-${file.ring}` });
    out.push(`<g data-slot="${slot.id}">${shank}${handle}</g>`);
  }
  return out.join("");
}

// ---------- bench pieces ----------
function dish() {
  // Glass dappen dish holding sodium hypochlorite.
  const [x, y] = [34, 44];
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - 9, y: y - 9, w: 18, d: 18, r: 9 }, 0, 8, P)}"/>`];
  out.push(S(k.cylinder(x, y, 9.4, 0, 2, P, 48, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 8.2, 2, 7, P, 48, 0.6), { tone: "hi", inner: L(k.sideArc(x, y, 8.2, 5.2, P, 32), { tone: "faint" }) }));
  out.push(`<path class="rc-hole" d="${k.pathOf(k.circleRing(x, y, 6.6, 40).map(([px, py]) => at([px, py, 9])), true)}"/>`);
  out.push(`<path class="rc-fluid" d="${k.pathOf(k.circleRing(x, y + 0.6, 5.6, 40).map(([px, py]) => at([px, py, 9])), true)}"/>`);
  out.push(L(k.ring(x, y, 6.6, 9, P, 40), { tone: "lo" }));
  return out.join("");
}
function pointBox() {
  // Gutta-percha points in a grooved tray, tips to the front.
  const box = { x: -42, y: 36, w: 34, d: 20, r: 1.6 };
  const out = [`<path class="iso-halo" d="${k.haloOf(box, 0, 5, P)}"/>`];
  out.push(S(k.slabOf(box, 0, 5, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(box, 2, P, 3), { tone: "faint" }) }));
  for (let i = 0; i < 5; i++) {
    const x = box.x + 5 + i * 6;
    const slot = { x: x - 1.6, y: box.y + 3, w: 3.2, d: 14, r: 1.6 };
    out.push(`<path class="rc-hole" d="${k.planOutline(slot, 5, P)}Z"/>`);
    out.push(L(k.planOutline(slot, 5, P), { tone: "lo" }));
    const len = 12.4, w0 = 0.35, w1 = 0.6 + i * 0.12;
    out.push(`<path class="rc-gp" d="${k.onTop([[x - w0, box.y + 3.8 + len], [x + w0, box.y + 3.8 + len], [x + w1, box.y + 3.8], [x - w1, box.y + 3.8]], 5.05, P, true)}Z"/>`);
  }
  return out.join("");
}
function blockSide() {
  // Specimen label and registration dowels on the block's +x face.
  const x = BLOCK.x + BLOCK.w;
  const out = [];
  const rect = (y0, y1, z0, z1) => k.pathOf([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]].map(at), true);
  out.push(`<path class="rc-plate" d="${rect(-29, -5, 58, 78)}"/>`, L(rect(-29, -5, 58, 78), { tone: "lo" }), L(rect(-27.4, -6.6, 59.6, 76.4), { tone: "faint" }));
  out.push(L([[72, 14], [68, 10], [64, 7]].map(([z, len]) => k.segment([x, -24.5, z], [x, -24.5 + len, z], P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([x, -8.6, 73]), at([x, -8.6, 63])], { size: 0.45 }));
  out.push(L([[-27, 88], [-7, 88]].map(([y, z]) => k.sideRing([x, y, z], 1.8, "x", P, 18)).join(""), { tone: "lo" }));
  out.push(D([[-27, 88], [-7, 88]].map(([y, z]) => at([x, y, z])), { size: 0.6, tone: "lo" }));
  return out.join("");
}

// ---------- cables ----------
const LIP = { x: 47, y: -16, w: 9, d: 8, r: 0.8 };
function lipClip() {
  const out = [];
  out.push(S(k.slabOf({ x: 55, y: -16, w: 2.4, d: 8, r: 0.5 }, 93, Z.cej + 1.6 - 93, P, 2, 0.2), { tone: "mid" }));
  out.push(S(k.slabOf(LIP, Z.cej, 1.6, P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([51, -12, Z.cej + 1.6])], { size: 0.45 }));
  return out.join("");
}
function lipCable() {
  const route = G.fillet([[57.4, -12, 97], [78, -12, 97], [78, -12, 1.2], [78, 30, 1.2], [80, 44, 5], [92, 44, 5]], 3, 7, { P, tube: 0.9 });
  return tubePieces(route, 0.9, P, { maxLength: 400 }).map((piece) => tubeSvg(piece, { tone: "mid" })).join("");
}
function lipPort() {
  return S(G.disc(0, 3, 2.8, xFrame([92, 44, 5], -1), P), { tone: "mid" });
}

// ---------- assemble ----------
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "A sectioned premolar held in a bench vise, cut through its root canal, under a contra-angle handpiece on a vertical slide with a depth scale. An apex locator and a stand of ISO files sit on the bench.",
  body: [
    base(),
    flange(),
    `<g data-col>${columnSvg()}</g>`,
    `<g data-carriage>${carriage()}</g>`,
    `<g clip-path="url(#rc-upper)"><clipPath id="rc-upper"><path data-upper d="${upperClip}"/></clipPath>${columnSvg()}</g>`,
    viseBack(),
    blockSvg(),
    crownBack(),
    `<path class="rc-void" data-hole d=""/><path class="rc-core" data-hole-core d="" opacity="0"/><path class="iso-line" data-tone="lo" data-hole-rim d=""/>`,
    `<g data-cap-back opacity="0">${halfLathe(capR, capSlope, 0, CAP_H, Z.cej, "rc-cap-half", { tone: "hi" })}<path class="rc-cap-in" transform="${FACE}" d="${fp(closed(crownRight()), true)}"/></g>`,
    `<g transform="${FACE}">`,
    faceBack(),
    `<ellipse class="rc-lesion" data-lesion cx="0" cy="${-(Z.apex - 3)}" rx="${M.LESION}" ry="${M.LESION * 0.82}"/>`,
    faceTooth(),
    `<path class="rc-void" data-void-canal d=""/><path class="rc-void" data-void-chamber d=""/>`,
    `<path class="rc-pulp" data-pulp-chamber d=""/><path class="rc-pulp" data-pulp-canal d=""/>`,
    `<path class="rc-fluid" data-fluid d=""/>`,
    `<path class="rc-sealer" data-sealer d=""/>`,
    `<path class="rc-gp" data-gp d=""/>`,
    `<path class="rc-core" data-core d=""/>`,
    `<g class="rc-debris" data-debris>${Array.from({ length: 16 }, () => `<circle r="0.55" cx="0" cy="0"/>`).join("")}</g>`,
    `<path class="rc-void" data-notch d=""/>`,
    `<path class="iso-line" data-tone="lo" data-space-edge d=""/>`,
    `<path class="iso-line" data-tone="lo" data-notch-edge d=""/>`,
    `</g>`,
    `<g data-cap opacity="0"><g transform="${FACE}"><path class="rc-crown" d="${fp([...closed(crownRight(capR, CAP_H)), ...closed(crownRight()).reverse()], true)}"/>${L(fp(closed(crownRight(capR, CAP_H))), { tone: "hi" })}${L(fp(closed(crownRight())), { tone: "lo" })}${L(fp([[-M.crownR(0) - 1.4, Z.cej], [-M.crownR(0), Z.cej]]) + fp([[M.crownR(0), Z.cej], [M.crownR(0) + 1.4, Z.cej]]), { tone: "mid" })}</g></g>`,
    blockSide(),
    jawRight(),
    lipClip(),
    lipCable(),
    lipPort(),
    locator(),
    `<path class="iso-line" data-tone="lit" data-free="" data-needle d="" style="stroke-width:1.1"/>`,
    pointBox(),
    dish(),
    standSvg(),
    `<g data-tools>${Object.keys(TOOL_SPEC).map(toolSvg).join("")}</g>`,
    `<g data-head>${head()}</g>`,
    `<path class="rc-cable-o" data-cable d=""/><path class="rc-cable-i" data-cable-in d=""/>`,
  ].join(""),
});

const STEPS = M.STAGES.map((stage, i) => `<button type="button" class="rc-step" data-step="${i}" aria-pressed="false"><span>0${i + 1}</span>${stage.label}</button>`).join("");
let plate = k.plateHtml({
  fig: "Fig 1",
  title: "Root canal treatment",
  hint: "Hover to scrub · 1–7 for steps",
  readout: M.stateAt(0).text,
  keys: [
    { mark: "lit", label: "The instrument in the canal, carried down by the slide" },
    { mark: "raised", label: "Premolar sectioned through its canal, 5:1" },
    { mark: "red", label: "Inflamed pulp; past the apex on the locator" },
  ],
  caption: `The tooth is cut through its long axis so the canal shows on the face. Access opens the pulp chamber; an apex locator reads 0.0 when a #10 file reaches the apical constriction, which sets the working length (${M.WL_MM.toFixed(1)} mm from the cavity rim here). Files from 15/.02 to 40/.06 cut the canal to a tapered shape, sodium hypochlorite dissolves the remaining tissue, and a gutta-percha cone with sealer, compacted with heat, seals it from the constriction to the orifice. A core and crown close the tooth, and over the following months bone fills the apical lesion.`,
  body: `<div class="iso-stage rc-stage" tabindex="0" role="slider" aria-label="Root canal treatment: arrow keys step through the seven stages, or hover to scrub through the procedure" aria-valuemin="1" aria-valuemax="7" aria-valuenow="1" aria-valuetext="Diagnose">${svg}</div>`,
});
plate = plate.replace(`<span class="iso-caption">`, `<span class="rc-steps" role="group" aria-label="Treatment steps">${STEPS}</span><span class="iso-caption">`);

const CSS = readFileSync(join(HERE, "root-canal.css"), "utf8");
const strip = (src) => src.replace(/^export /gm, "");
const DATA = {
  P,
  FACE,
  CARR,
  COL,
  CARR_TOP,
  DIAL,
  DIAL_R,
  LOC_H,
  DIAL_FROM,
  DIAL_ZERO,
  DIAL_OVER,
  NEEDLE_REST,
  CLIP: [98, 9.2, NUT + 1],
  PORT: [143, 25, LOC_H + 3.6],
  WIDTH,
};
const live = `${strip(readFileSync(join(HERE, "model.mjs"), "utf8"))}\nconst DATA = ${JSON.stringify(DATA)};\n${readFileSync(join(HERE, "live.js"), "utf8")}`;
// index.html (served by GitHub Pages) follows the viewer's system theme; --dark writes a fixed dark copy for checks.
const name = theme === "light" ? "index.html" : "root-canal-dark.html";
const page = k.pageHtml({ title: "Root canal treatment", theme, body: `<style>${CSS}</style>${plate}`, script: kitScript() + "\n" + live, width: 680 });
const AUTO_THEME = `<script>(()=>{const mq=matchMedia("(prefers-color-scheme: dark)");const set=()=>{document.body.dataset.theme=mq.matches?"dark":"light";document.documentElement.style.colorScheme=mq.matches?"dark":"light";};set();mq.addEventListener("change",set);})()</script>`;
writeFileSync(join(HERE, name), theme === "light" ? page.replace('<body class="iso" data-theme="light">', `<body class="iso" data-theme="light">${AUTO_THEME}`) : page);
console.log("wrote", name, (page.length / 1024).toFixed(0) + " KB");

// Artifact version: no document skeleton, theme follows the viewer (system setting or explicit toggle).
if (theme === "light") {
  const style = page.match(/<style>([\s\S]*?)<\/style><\/head>/)[1];
  const main = page.match(/<main class="iso-page">([\s\S]*?)<\/main>/)[1];
  const script = page.match(/<script type="module">([\s\S]*)<\/script><\/body>/)[1];
  const tokens = `:root{--rc-page:#f2f2ef}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--rc-page:#0b0b0b;color-scheme:dark}}:root[data-theme="dark"]{--rc-page:#0b0b0b;color-scheme:dark}body{background:var(--rc-page)}`;
  const themeJs = `<script>(()=>{const root=document.documentElement,box=document.getElementById("rc-root"),mq=matchMedia("(prefers-color-scheme: dark)");const set=()=>{const t=root.dataset.theme||(mq.matches?"dark":"light");box.dataset.theme=t;};set();mq.addEventListener("change",set);new MutationObserver(set).observe(root,{attributes:true,attributeFilter:["data-theme"]});})()</script>`;
  const art = `<title>Root canal treatment</title><style>${tokens}${style.split("body{margin:0;background:var(--anatomy-page);").join(".iso-wrap{background:var(--anatomy-page);").split("html{color-scheme:dark}").join("").split('body[data-theme="light"]{color-scheme:light}').join("")}</style><div class="iso iso-wrap" id="rc-root" data-theme="light"><main class="iso-page">${main}</main></div>${themeJs}<script type="module">${script}</script>`;
  writeFileSync(join(HERE, "root-canal-artifact.html"), art);
  console.log("wrote root-canal-artifact.html", (art.length / 1024).toFixed(0) + " KB");
}
