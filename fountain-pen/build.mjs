import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { kitScript } from "../kit/inline.mjs";
import * as M from "./model.mjs";
import * as Pen from "./pen.mjs";
import { buildPen, ORDER } from "./pen-art.mjs";
import { PARTS, ORDER_APART } from "./parts-text.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const { U } = M;

const WIDTH = 640;
const HEIGHT = 600;

// ---------- plan ----------
const PLATE = { x: -205, y: -104, w: 410, d: 196, r: 10 };
const PLATE_H = 12;
const FOOT_H = 5;
const PZ = 6.8;                       // paper surface
const PLATEN = { x: -112, y: -56, w: 224, d: 112, r: 3 };
const PLATEN_H = PZ - 0.8;
const TAPE_W = 96;
const SPOOL_X = 158;
const R_ROLL = 24;
const R_FLANGE = 27;
const SPOOL_Z = PZ + R_ROLL;
const YOKE_S = 52;                    // where the pen is held, mm from the tip
const LENS = { x: 96, y: 24, z: 112, rOut: 62, rIn: 54 };
const WEIGHTS = { count: 12, step: 25, h: 5, r: 16 };

const FR = Pen.penFrame([0, 0, PZ]);
const YOKE = FR.w(YOKE_S, 0, 0);
const POST = [YOKE[0], -92];
const PEN_TOP = FR.w(Pen.LEN, 0, 0);
const TRAY_Z = YOKE[2] + 18;
const TOWER_TOP = TRAY_Z + WEIGHTS.count * WEIGHTS.h + 22;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [PEN_TOP[0] - 28, 0, PEN_TOP[2] + 14],
    [PEN_TOP[0] + 28, 0, PEN_TOP[2] + 14],
    [POST[0], POST[1], TOWER_TOP],
    [LENS.x + LENS.rOut + 8, LENS.y, LENS.z + LENS.rOut + 8],
  ],
  WIDTH,
  HEIGHT,
  { pad: 24, azimuth: 60, elevation: 30 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const yFrame = (o, sign = 1) => G.frameOf(o, [0, sign, 0], [1, 0, 0], [0, 0, 1]);

// Pen frame to screen. Everything cut by the plane sits at y = 0.
const stPt = ([s, t], y = 0) => at(FR.w(s, t, y));
const stPath = (pts, close = false, y = 0) => k.pathOf(pts.map((p) => stPt(p, y)), close);
const stPoly = (pts) => stPath(pts, true);
const st3 = ([s, t, y]) => at(FR.w(s, t, y));

// ---------- base ----------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 24))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3.5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Millimetre ruler along the front edge: four world units a millimetre at this scale.
  const strip = { x: -140, y: 70, w: 280, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 6, strip.x + strip.w - 6, U, 5, strip.y + 0.01, 0.8, [2.2, 4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2.6, strip.y + 4, 0.8]), at([strip.x + strip.w - 2.6, strip.y + 4, 0.8])], { size: 0.45 }));
  // Label plate.
  const label = { x: -196, y: 64, w: 46, d: 20, r: 1.4 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.8), 0.8, P), { tone: "faint" }));
  out.push(L([[6, 22], [6, 16], [6, 11]].map(([dx, len], i) => k.lineOnTop([label.x + dx, label.y + 6 + i * 4.2], [label.x + dx + len, label.y + 6 + i * 4.2], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + label.w - 4, label.y + 4, 0.8]), at([label.x + label.w - 4, label.y + label.d - 4, 0.8])], { size: 0.45 }));
  return out.join("");
}

// ---------- the paper bed ----------
function bed() {
  const out = [];
  out.push(S(k.slabOf(PLATEN, 0, PLATEN_H, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(PLATEN, 2.4, P, 4), { tone: "faint" }) }));
  // Edge guides, a hair taller than the tape, with screws.
  for (const y of [-54, 50]) {
    const guide = { x: PLATEN.x + 6, y, w: PLATEN.w - 12, d: 4, r: 1 };
    out.push(S(k.slabOf(guide, PLATEN_H, 2.6, P, 3, 0.3), { tone: "mid" }));
    out.push(D([guide.x + 8, guide.x + guide.w - 8].map((x) => at([x, y + 2, PLATEN_H + 2.6])), { size: 0.4 }));
  }
  // The paper tape, lying flat from one spool's tangent to the other's.
  const tape = { x: -SPOOL_X, y: -TAPE_W / 2, w: 2 * SPOOL_X, d: TAPE_W, r: 0.3 };
  out.push(S(k.slabOf(tape, PZ - 0.8, 0.8, P, 2, 0.2), { tone: "hi", crease: "lo", className: "fp-paper" }));
  out.push(`<path class="fp-hole" data-holes-path d=""/>`);
  out.push(`<g data-trace>${[0, 1, 2, 3, 4, 5].map((i) => `<path class="fp-trace" data-trace-b="${i}" style="fill-opacity:${(0.2 + 0.8 * (i / 5)).toFixed(2)}" d=""/>`).join("")}<path class="fp-trace" data-blots style="fill-opacity:.92" d=""/></g>`);
  return out.join("");
}

// ---------- spools ----------
// A reel on a horizontal axle along y: back flange, wound roll, front rim with spokes that turn.
const REEL_FACE = 48 + 3;             // y of the front flange face
function reelBack(xc) {
  const out = [];
  const F = yFrame([xc, -48, SPOOL_Z]);
  const post = { x: xc - 8, y: -70, w: 16, d: 14, r: 2 };
  out.push(S(k.slabOf(post, 0, SPOOL_Z + 9, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(post, 14, P, 3), { tone: "faint" }) }));
  out.push(D([at([xc, post.y + post.d, 5]), at([xc, post.y + post.d, SPOOL_Z + 9 - 5])], { size: 0.45 }));
  out.push(S(G.disc(-8, -3, 3.2, F, P), { tone: "hi" }));
  out.push(S(G.disc(-3, 0, R_FLANGE, F, P, { bevel: 0.3 }), { tone: "mid" }));
  return out.join("");
}
function reelFront(xc, crank) {
  const out = [];
  const F = yFrame([xc, -48, SPOOL_Z]);
  // Wound paper: its end face carries the layer edges.
  out.push(S(G.disc(0, 96, R_ROLL, F, P), { tone: "hi", className: "fp-paper" }));
  out.push(L([10.5, 13.5, 16.5, 19.5, 22.5].map((r) => G.circleOf(F, 96, r, P)).join(""), { tone: "lo" }));
  out.push(L([16, 32, 48, 64, 80].map((s) => G.arcOf(F, s, R_ROLL, P)).join(""), { tone: "faint" }));
  // The rim of the front flange: a ring, so the spokes and the wound paper show through it.
  out.push(S(G.ringBand(96, 99, R_FLANGE - 4, R_FLANGE, F, P, { bevel: 0.3 }), { tone: "mid" }));
  out.push(`<g data-spokes="${crank}"><path class="fp-spoke" d=""/><circle class="fp-mark" r="1.3" cx="0" cy="0"/></g>`);
  out.push(S(G.disc(96, 101, 8, F, P, { bevel: 0.3 }), { tone: "mid" }));
  out.push(D([at(G.pointOf(F, 101, 0, 0))], { size: 0.6, tone: "hi" }));
  // Axle stub and knob on the front.
  out.push(S(G.disc(101, 110, 3.2, F, P), { tone: "hi" }));
  out.push(S(G.disc(110, 118, 7, F, P, { bevel: 0.4 }), { tone: "mid", inner: k.fadedSvg(G.ribsOf(F, 110, 118, 7, 28, P, { fade: [0.1, 0.55] }), { tone: "lo" }) }));
  out.push(L(G.circleOf(F, 118, 2.4, P), { tone: "faint" }));
  return out.join("");
}

// ---------- the load carrier: post, block, arm and the weights ----------
function tower() {
  const out = [];
  const [px, py] = POST;
  const foot = { x: px - 16, y: py - 16, w: 32, d: 32, r: 4 };
  out.push(S(k.slabOf(foot, 0, 5, P, 4, 0.6), { tone: "mid" }));
  out.push(D(k.corners(foot, 4.2).map(([x, y]) => at([x, y, 5])), { size: 0.45 }));
  out.push(S(k.cylinder(px, py, 6, 5, TOWER_TOP - 5, P, 32), { tone: "mid", crease: "none", inner: L([60, 120, 200].map((z) => k.sideArc(px, py, 6, z, P, 16)).join(""), { tone: "faint" }) }));
  out.push(S(k.cylinder(px, py, 7.4, TOWER_TOP, 4, P, 32, 0.4), { tone: "mid" }));
  return out.join("");
}
function carrier() {
  const out = [];
  const [px, py] = POST;
  const zp = YOKE[2];
  // The block that rides the post, and the arm out to the pen.
  const block = { x: px - 11, y: py - 11, w: 22, d: 22, r: 3 };
  out.push(S(k.slabOf(block, zp - 18, 36, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(block, zp, P, 3), { tone: "faint" }) }));
  out.push(D([at([px - 5, py + 11 + 0.01, zp - 12]), at([px + 5, py + 11 + 0.01, zp - 12])], { size: 0.45 }));
  const arm = { x: px - 5, y: py + 11, w: 10, d: -24 - (py + 11) - 3, r: 1 };
  void arm;
  const armPlan = { x: px - 5, y: py + 11, w: 10, d: -26 - (py + 11), r: 1.2 };
  out.push(S(k.slabOf(armPlan, zp - 6, 12, P, 3, 0.4), { tone: "mid" }));
  const pad = { x: px - 9, y: -28, w: 18, d: 4, r: 1 };
  out.push(S(k.slabOf(pad, zp - 15, 30, P, 3, 0.4), { tone: "mid" }));
  // The tray at the block's top, with a web under it.
  const tray = { x: px + 11, y: py - 11, w: 56, d: 22, r: 2 };
  out.push(S(k.slabOf({ x: px + 11, y: py - 6, w: 4, d: 12, r: 0.8 }, zp - 2, 16, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf(tray, TRAY_Z - 3, 3, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([tray.x + tray.w - 4, tray.y + 4, TRAY_Z]), at([tray.x + tray.w - 4, tray.y + tray.d - 4, TRAY_Z])], { size: 0.4 }));
  // The weights, bottom to top. Each is a brass disc that sits on the one below.
  const cx = px + 11 + 30;
  for (let i = 0; i < WEIGHTS.count; i++) {
    const z = TRAY_Z + i * WEIGHTS.h;
    const disc = S(k.cylinder(cx, py, WEIGHTS.r, z, WEIGHTS.h, P, 40, 0.3), { tone: "hi", inner: L(k.sideArc(cx, py, WEIGHTS.r, z + WEIGHTS.h / 2, P, 24), { tone: "faint" }) });
    const slot = L(k.ring(cx, py, 11, z + WEIGHTS.h, P, 28), { tone: "faint" });
    out.push(`<g data-weight="${i}">${disc}${slot}</g>`);
  }
  return out.join("");
}

// ---------- the pen ----------
const rig = buildPen({ FR, P, idp: "fp1", live: true });
const pen = () => `<g id="fp-pen" data-pen>${ORDER.map((name) => `<g data-part="${name}">${rig.parts[name].svg}</g>`).join("")}</g>`;

// ---------- the loupe ----------
const F_LENS = yFrame([LENS.x, LENS.y, LENS.z]);
const LENS_C = at([LENS.x, LENS.y + 3, LENS.z]);
const LENS_Q = stPt([5.4, 2.4]);
const LENS_M = 2.4;
function loupeStand() {
  const out = [];
  const px = LENS.x;
  const post = [px, -92];
  const foot = { x: px - 14, y: post[1] - 14, w: 28, d: 28, r: 4 };
  out.push(S(k.slabOf(foot, 0, 5, P, 4, 0.6), { tone: "mid" }));
  out.push(D(k.corners(foot, 4).map(([x, y]) => at([x, y, 5])), { size: 0.45 }));
  out.push(S(k.cylinder(post[0], post[1], 5, 5, LENS.z + 8 - 5, P, 28), { tone: "mid", crease: "none", inner: L([40, 70].map((z) => k.sideArc(post[0], post[1], 5, z, P, 16)).join(""), { tone: "faint" }) }));
  const knob = { x: px - 8, y: post[1] - 8, w: 16, d: 16, r: 2.5 };
  out.push(S(k.slabOf(knob, LENS.z - 8, 16, P, 3, 0.5), { tone: "mid" }));
  const arm = { x: px - 3.5, y: post[1] + 8, w: 7, d: LENS.y - 3 - (post[1] + 8), r: 1.2 };
  out.push(S(k.slabOf(arm, LENS.z - 3.5, 7, P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([px, post[1] + 12, LENS.z + 3.5]), at([px, LENS.y - 8, LENS.z + 3.5])], { size: 0.4 }));
  return out.join("");
}
function loupe() {
  const out = [];
  out.push(S(G.ringBand(-3, 3, LENS.rIn, LENS.rOut, F_LENS, P, { bevel: 0.4 }), { tone: "mid", inner: k.fadedSvg(G.ribsOf(F_LENS, -3, 3, LENS.rOut, 96, P, { fade: [0.1, 0.55] }), { tone: "lo" }) }));
  out.push(`<clipPath id="fp-lens"><path d="${G.circleOf(F_LENS, 3, LENS.rIn - 0.4, P, 72)}"/></clipPath>`);
  out.push(`<g clip-path="url(#fp-lens)"><rect class="fp-glass" x="0" y="0" width="${WIDTH}" height="${HEIGHT}"/><g transform="translate(${f1(LENS_C[0])} ${f1(LENS_C[1])}) scale(${LENS_M}) translate(${f1(-LENS_Q[0])} ${f1(-LENS_Q[1])})"><use href="#fp-bed"/><use href="#fp-pen"/></g></g>`);
  out.push(L(G.circleOf(F_LENS, 3, LENS.rIn, P, 72), { tone: "lo" }));
  out.push(L(G.circleOf(F_LENS, 3, LENS.rIn - 2.6, P, 72), { tone: "faint" }));
  return out.join("");
}

// ---------- assemble ----------
const body = [
  base(),
  reelBack(-SPOOL_X),
  reelBack(SPOOL_X),
  tower(),
  `<g data-carrier>${carrier()}</g>`,
  `<g id="fp-bed">${bed()}</g>`,
  reelFront(-SPOOL_X, "take"),
  reelFront(SPOOL_X, "feed"),
  loupeStand(),
  pen(),
  loupe(),
].join("");

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "A fountain pen cut along its length, tilted over a moving paper tape on a test rig. A stack of weights presses the pen down, a loupe magnifies the nib, and the cut shows the feed, the comb of fins, the air channel and the cartridge.",
  body,
});

// ---------- Fig 2: the pen taken apart ----------
const APART = {
  nib: { s: -40, t: 14 },
  feed: { s: -40, t: 0 },
  section: { s: 0, t: 0 },
  cartridge: { s: 9, t: 0 },
  barrel: { s: 54, t: 0 },
  cap: { s: 62, t: 0 },
};
Pen.setPose(28, -1);
const W2 = 640;
const H2 = 400;
const FR2 = Pen.penFrame([0, 0, 52]);
const shift2 = (name) => {
  const o = APART[name];
  return [(o.s * Pen.AX[0] + o.t * Pen.NM[0]) * U, 0, (o.s * Pen.AX[2] + o.t * Pen.NM[2]) * U];
};
const PLATE2 = { x: -190, y: -58, w: 710, d: 116, r: 8 };
const provisional = buildPen({ FR: FR2, P: { origin: [0, 0], scale: 1, azimuth: 60, elevation: 30 }, idp: "tmp", live: false });
const extent = [];
for (const name of ORDER) {
  const [dx, , dz] = shift2(name);
  for (const [s, t] of provisional.parts[name].poly) {
    for (const f of [0, 1]) {
      const p = FR2.w(s, t, 0);
      extent.push([p[0] + dx * f, p[1] - 24, p[2] + dz * f], [p[0] + dx * f, p[1] + 0, p[2] + dz * f]);
    }
  }
}
const base2 = k.boxCorners(PLATE2, -PLATE_H - FOOT_H, 0);
const P2 = k.fitProjection([...extent, ...base2], W2, H2, { pad: 22, azimuth: 60, elevation: 30 });
const at2 = (p) => k.iso(p, P2);
const art2 = buildPen({ FR: FR2, P: P2, idp: "fp2", live: false });

function base2Svg() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE2, -PLATE_H - FOOT_H, PLATE_H, P2)}"/>`];
  const feet = k.corners(PLATE2, 22).sort((a, b) => k.depthOf([a[0], a[1], 0], P2) - k.depthOf([b[0], b[1], 0], P2));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P2, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P2, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE2, -PLATE_H, PLATE_H, P2, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE2, -PLATE_H + 3.5, P2, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE2, 5), 0, P2), { tone: "lo" }));
  const screws = k.corners(PLATE2, 10);
  out.push(D(screws.map(([x, y]) => at2([x, y, 0])), { size: 0.5 }));
  const strip2 = { x: -160, y: 36, w: 650, d: 8, r: 1 };
  out.push(S(k.slabOf(strip2, 0, 0.8, P2, 3), { tone: "lo", crease: "none" }));
  const ticks2 = k.topTicks(strip2.x + 6, strip2.x + strip2.w - 6, U * 5, 4, strip2.y + 0.01, 0.8, [2.2, 4], P2);
  out.push(L(ticks2.minor, { tone: "lo" }), L(ticks2.major, { tone: "mid" }));
  return out.join("");
}

const shadows = ORDER.map((name) => {
  const pts = art2.parts[name].poly.map(([s, t]) => {
    const w = FR2.w(s, t, 0);
    return at2([w[0], w[1], 0.2]);
  });
  const hull = k.pathOf(G.hullOf(pts), true);
  const [dx, dy] = k.axisVector(P2, [shift2(name)[0], 0, 0]);
  const [fx, fy] = [dx, dy];
  return { name, hull, vec: [fx, fy] };
});
const apartVec = Object.fromEntries(ORDER.map((name) => [name, k.axisVector(P2, shift2(name))]));
const boxes = {};
for (const name of ORDER) {
  const box = (f) => {
    const [dx, dy] = apartVec[name];
    const part = art2.parts[name];
    const pts = name === "nib" && f > 0.5 ? part.faceScreen : part.poly.flatMap(([s, t]) => [0, -Pen.R_BAR * 0.5, -Pen.R_BAR].map((y) => at2(FR2.w(s, t, y))));
    const xs = pts.map((p) => p[0] + dx * f);
    const ys = pts.map((p) => p[1] + dy * f);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  };
  boxes[name] = { closed: box(0), open: box(1) };
}

const body2 = [
  base2Svg(),
  shadows.map((s) => `<g data-shadow="${s.name}"><path class="iso-halo fp-shadow" d="${s.hull}"/></g>`).join(""),
  ORDER.map((name) => `<g data-part="${name}" class="fp-part">${art2.parts[name].svg}</g>`).join(""),
].join("");
const svg2 = k.figureSvg({
  width: W2,
  height: H2,
  label: "The fountain pen taken apart along its axis: nib, feed, section, cartridge, barrel and end cap, drawn cut open so the inside of each part shows. Select a part to zoom in and read what it does.",
  body: body2,
  className: "fp-x",
});
const DATA2 = { W: W2, H: H2, apart: apartVec, boxes, shadows: Object.fromEntries(shadows.map((s) => [s.name, s.vec])), order: ORDER, text: PARTS, list: ORDER_APART };

const plate2 = k.plateHtml({
  fig: "Fig 2",
  title: "Taken apart",
  hint: "Select a part to zoom in",
  readout: "All six parts",
  keys: [
    { mark: "lit", label: "Nib" },
    { mark: "raised", label: "Feed, section, barrel, cap and cartridge shell" },
    { mark: "flat", label: "Ink" },
  ],
  caption:
    "The same pen, pulled apart along its axis in the order you would take it apart: the nib and feed come out of the front of the section, the barrel unscrews and slides back off the cartridge, and the end cap comes away last. Every part is cut along the same plane as above. Select one to zoom in and read what it does and why the pen needs it.",
  body: `<div class="fp-x-stage" tabindex="0" role="group" aria-label="Exploded fountain pen">${svg2}</div>`,
});

const EXPLORER = `
<section class="fp-explorer" aria-label="Parts of the pen">
  <div class="fp-controls">
    <button type="button" class="fp-btn" data-blast aria-pressed="true">Assemble</button>
    <button type="button" class="fp-btn" data-overview>All parts</button>
  </div>
  <div class="fp-picker" role="group" aria-label="Choose a part">${ORDER_APART.map((name, i) => `<button type="button" class="fp-pick" data-pick="${name}" aria-pressed="false"><span>0${i + 1}</span>${PARTS[name].name}</button>`).join("")}</div>
  <article class="fp-info" aria-live="polite">
    <h3 data-info-title></h3>
    <p class="fp-role" data-info-role></p>
    <p data-info-body></p>
    <div class="fp-chips" data-info-chips></div>
    <p class="fp-feature" data-info-feature></p>
    <ul class="fp-facts" data-info-facts></ul>
  </article>
</section>`;

const HOW = `
<section class="fp-how" aria-label="How a fountain pen works">
  <h2>How it works</h2>
  <ol>
    <li><b>The pin opens the cartridge.</b> The feed ends in a hollow pin that pierces the cartridge's plug. It gives ink a way out and air a way in.</li>
    <li><b>Capillary action draws ink forward.</b> Along the feed's ink channel the gap is only ${M.FEED.inkGap} mm, and a gap that small pulls liquid with about ${Math.round(M.P_INK)} Pa, enough to lift ink against gravity.</li>
    <li><b>The paper takes it from the nib.</b> The slit carries ink to the tipping. Paper pores, about 10 µm across, pull with about ${Math.round(M.P_PAPER)} Pa, far harder than the slit, so ink moves into the page as the nib drags over it.</li>
    <li><b>Air has to come back.</b> Every microlitre of ink that leaves thins the air above the ink, so the pressure in the cartridge falls. At ${Math.round(M.P_AIR)} Pa below the room a bubble forces in at the breather hole, runs back along the wider air channel and rises to the top of the cartridge. Seal that channel and the suction builds toward ${Math.round(M.P_INK)} Pa until the feed can no longer pull.</li>
    <li><b>The fins are a reserve and a catch basin.</b> The channel delivers at most ${M.FEED.supply} µL/s, so a bold, fast stroke would starve; the fins hold about ${M.FEED.buffer} µL to draw on and refill when you pause. They also soak up the ink that a warming cartridge pushes forward, instead of letting it blot the page.</li>
    <li><b>The nib flexes.</b> Press and the two tines spread, the slit opens and the line gets wider, ${M.NIB.tipping} mm at rest and up to ${(M.NIB.tipping + M.NIB.maxSpread).toFixed(1)} mm in this soft nib. A wider line asks for more ink, which loops back to step 5.</li>
  </ol>
  <p class="fp-try"><b>Try:</b> press 12 weights at 55 mm/s and watch the fins drain, then ease off and watch them refill. Press <i>Remove the fins</i> and repeat. Press <i>Warm the pen</i> with the fins on and off.</p>
</section>`;

const CSS = readFileSync(join(HERE, "fountain-pen.css"), "utf8");

const DATA = { P, PZ, TAPE_W, SPOOL_X, SPOOL_Z, R_ROLL, R_FLANGE, FACE_Y: REEL_FACE, WEIGHTS, CONTACT: [0, 0, PZ] };

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Fountain pen",
  hint: "Hover to add weight",
  readout: "",
  keys: [
    { mark: "lit", label: "The nib: two tines that open under load" },
    { mark: "raised", label: "The feed: ink channel, comb of fins and air channel" },
    { mark: "flat", label: "Ink, in the cartridge and in the feed" },
  ],
  caption:
    `A fountain pen cut along its length and held at 55° over a moving paper tape, drawn at ${U}:1. Weights on the tray press it down; the loupe magnifies the nib. Ink is pulled forward along a narrow channel by capillary action, and each time the cartridge has lost about ${M.BURP_VOLUME.toFixed(1)} µL a bubble of air is let in through the breather hole and travels back along the wider air channel. The numbers come from a simplified model of a soft nib and a water-based ink, not from a measured pen.`,
  body: `<div class="fp-stage" tabindex="0" role="group" aria-label="Fountain pen test rig: arrow keys add or remove weights, V seals the air channel, space pauses">${svg}</div>`,
});

const PANEL = `
<section class="fp-panel" aria-label="Pen controls and readings">
  <div class="fp-controls">
    <button type="button" class="fp-btn" data-play aria-pressed="true">Pause</button>
    <label class="fp-slide"><span>Weights</span><input type="range" data-pressure min="0" max="${WEIGHTS.count}" step="1" value="1"><b data-pressure-out>25 gf</b></label>
    <label class="fp-slide"><span>Speed</span><input type="range" data-speed min="${M.SPEED.min}" max="${M.SPEED.max}" step="1" value="30"><b data-speed-out>30 mm/s</b></label>
    <button type="button" class="fp-btn" data-vent aria-pressed="false">Seal the air channel</button>
    <button type="button" class="fp-btn" data-fins aria-pressed="false">Remove the fins</button>
    <button type="button" class="fp-btn" data-warm aria-pressed="false">Warm the pen (+4 K)</button>
  </div>
  <div class="fp-cards">
    <figure class="fp-card">
      <figcaption>Line width</figcaption>
      <p class="fp-big" data-width>0.4 mm</p>
      <svg class="fp-chart" viewBox="0 0 200 60" preserveAspectRatio="none" role="img" aria-label="Line width over the last twenty seconds"><polyline data-width-line points=""/></svg>
      <p class="fp-note" data-width-note></p>
    </figure>
    <figure class="fp-card">
      <figcaption>Ink supply</figcaption>
      <p class="fp-big" data-buffer-out>6 of 6 µL in the fins</p>
      <div class="fp-bar" role="img" aria-label="Ink left in the fins"><i data-buffer-bar></i></div>
      <svg class="fp-chart" viewBox="0 0 200 60" preserveAspectRatio="none" role="img" aria-label="Ink the paper takes and the feed delivers"><polyline class="fp-demand" data-flow-demand points=""/><polyline class="fp-supply" data-flow-supply points=""/></svg>
      <p class="fp-note" data-flow-note></p>
      <p class="fp-note" data-heat-note></p>
    </figure>
    <figure class="fp-card">
      <figcaption>Reservoir</figcaption>
      <p class="fp-big" data-vac-out>0 Pa below air</p>
      <svg class="fp-chart" viewBox="0 0 200 60" preserveAspectRatio="none" role="img" aria-label="Suction in the cartridge over the last twenty seconds"><polyline data-vac-line points=""/></svg>
      <p class="fp-note"><span data-burp-out></span>. <span data-vac-note></span></p>
    </figure>
  </div>
  <ul class="fp-scale" aria-label="Capillary pressures in the model">
    <li>Air channel lets a bubble in at <b>${Math.round(M.P_AIR)} Pa</b></li>
    <li>Ink channel pulls ink with <b>${Math.round(M.P_INK)} Pa</b></li>
    <li>Paper pores (10 µm) pull with <b>${Math.round(M.P_PAPER)} Pa</b></li>
  </ul>
</section>`;

const strip = (src) => src.replace(/^export /gm, "").replace(/^import .*$/gm, "");
const model = strip(readFileSync(join(HERE, "model.mjs"), "utf8"));
const penSrc = strip(readFileSync(join(HERE, "pen.mjs"), "utf8"));
const live = `${model}\n${penSrc}\nconst DATA = ${JSON.stringify(DATA)};\n${readFileSync(join(HERE, "live.js"), "utf8")}\n(() => {\nconst DATA2 = ${JSON.stringify(DATA2)};\n${readFileSync(join(HERE, "explode.js"), "utf8")}\n})();`;
const page = k.pageHtml({ title: "Fountain pen", theme, body: `<style>${CSS}</style>${plate}${PANEL}${HOW}${plate2}${EXPLORER}`, script: kitScript() + "\n" + live, width: 680 });
const AUTO_THEME = `<script>(()=>{const mq=matchMedia("(prefers-color-scheme: dark)");const set=()=>{document.body.dataset.theme=mq.matches?"dark":"light";document.documentElement.style.colorScheme=mq.matches?"dark":"light";};set();mq.addEventListener("change",set);})()</script>`;
const name = theme === "light" ? "index.html" : "fountain-pen-dark.html";
writeFileSync(join(HERE, name), theme === "light" ? page.replace('<body class="iso" data-theme="light">', `<body class="iso" data-theme="light">${AUTO_THEME}`) : page);
console.log("wrote", name, (page.length / 1024).toFixed(0) + " KB");
