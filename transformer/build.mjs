import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { kitScript } from "../kit/inline.mjs";
import * as M from "./model.mjs";
import * as L from "./layout.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const WIDTH = 620;
const HEIGHT = 580;

// ---- camera -----------------------------------------------------------------------------------------------
const BASE = L.BASE;
const frame = [
  ...k.boxCorners(BASE, -16, 0),
  ...k.boxCorners({ x: -100, y: L.MODS[0] - 10, w: 200, d: L.READ_Y - L.MODS[0] + 20, r: 0 }, 0, L.TOP), // cords arch over the portals
  ...k.boxCorners({ x: -98, y: L.CASE_Y - 12, w: 196, d: 30, r: 0 }, 0, 16), // type case and stick
];
const P = k.fitProjection(frame, WIDTH, HEIGHT, { pad: 22, azimuth: 66, elevation: 48 });
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, steps = 3, bevel = 0) => k.slabOf(plan, z, h, P, steps, bevel);
const key = (p, bias = 0) => k.depthOf(p, P) + bias;
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// A line of text printed on a vertical face that looks toward +y (the left face in the kit).
function faceText(origin, zTop, u, v, text, { size = 4, tone = "hi", data = "" } = {}) {
  const m = k.sideMatrix(origin, zTop, P, "left");
  return `<text class="iso-face-text tf-text" data-tone="${tone}" transform="${m}" x="${u}" y="${v}" font-size="${size}" text-anchor="middle"${data}>${attr(text)}</text>`;
}

// ---- initial state for the static page: the default prompt, all lanes finished -----------------------------------
const PROMPT = M.parse(M.PRESETS[0].tokens);
const RUN = M.forward(PROMPT);

// ---- base -------------------------------------------------------------------------------------------------
function base() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(BASE, -16, 12, P)}"/>`);
  const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of byDepth(k.corners(BASE, 16))) {
    out.push(S(k.cylinder(x, y, 6, -16, 1.6, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.6, -14.4, 5.4, P, 24), { tone: "mid" }));
  }
  out.push(S(slab(BASE, -L.BASE_H, L.BASE_H, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(BASE, -4.5, P, 8), { tone: "faint" }) }));
  out.push(Ln(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
  out.push(D(k.corners(BASE, 9).map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
  return out.join("");
}

// ---- belts: one per lane, with dividers --------------------------------------------------------------------
function belts() {
  const out = [];
  const len = L.BELT_Y1 - L.BELT_Y0;
  for (let i = 0; i < L.N; i++) {
    const x = L.laneX(i);
    const plan = { x: x - 7.8, y: L.BELT_Y0, w: 15.6, d: len, r: 2 };
    out.push(S(slab(plan, 0, 1.2, 4, 0.3), { tone: "lo" }));
    out.push(Ln(k.planOutline(k.insetPlan(plan, 2.2), 1.2, P, 3), { tone: "faint" }));
  }
  for (let i = 0; i <= L.N; i++) {
    const x = (i - L.N / 2) * L.PITCH;
    out.push(S(slab({ x: x - 0.7, y: L.BELT_Y0, w: 1.4, d: len, r: 0.4 }, 0, 3.2, 2), { tone: "lo", crease: "none" }));
  }
  return out.join("");
}

// ---- plate faces: three banks of bars ----------------------------------------------------------------------
// Face coordinates: u across, v down from the top of the plate. Banks T and A grow up from their baselines,
// bank O (the logit lens) grows up for positive votes and down for negative ones.
const FACE = L.FACE;
function slotMarks() {
  // a small mark under every slot, so an empty bank still reads as a display
  let d = "";
  for (const [row, n] of [[FACE.rowT, 9], [FACE.rowA, 9], [FACE.rowO, 8]]) {
    const u0 = (FACE.pitch * (9 - n)) / 2 + (FACE.pitch - FACE.bar) / 2 + 0.55;
    for (let i = 0; i < n; i++) d += `M${(u0 + i * FACE.pitch).toFixed(2)} ${row + 0.25}h${FACE.bar}v0.22h${-FACE.bar}Z`;
  }
  return d;
}
function plateFace(lane, ref) {
  const rules = [FACE.rowT, FACE.rowA, FACE.rowO].map((v) => `M0 ${v}H${L.PLATE.w}`).join("");
  const bars = ["T", "A", "O"].map((b) => `<path class="tf-bar" data-bank="${b}" data-part="base" d=""/><path class="tf-bar tf-grow" data-bank="${b}" data-part="grow" d=""/><path class="tf-bar tf-cut" data-bank="${b}" data-part="cut" d=""/>`).join("");
  return `<rect class="tf-screen" x="0" y="0" width="${L.PLATE.w}" height="${L.PLATE.h}" rx="0.5"/><path class="tf-rule" d="${rules}"/><path class="tf-slotmark" d="${slotMarks()}"/>${bars}`;
}

// A tray is built around (x, 0) and moved along the line with a translate.
function tray(lane) {
  const x = L.laneX(lane);
  const T = L.TRAY, PL = L.PLATE;
  const out = [];
  const slabPlan = { x: x - T.w / 2, y: -T.d / 2, w: T.w, d: T.d, r: 1.5 };
  out.push(S(slab(slabPlan, T.z, T.h, 4, 0.4), { tone: "mid", className: "tf-tray-slab" }));
  out.push(D(k.corners(slabPlan, 2).map(([px, py]) => at([px, py, T.z + T.h])), { size: 0.4 }));
  const plateY = -T.d / 2;
  const plateTop = T.z + T.h + PL.h;
  out.push(S(slab({ x: x - PL.w / 2, y: plateY, w: PL.w, d: PL.d, r: 0.5 }, T.z + T.h, PL.h, 2), { tone: "mid", crease: "none", className: "tf-plate" }));
  const matrix = k.sideMatrix([x - PL.w / 2, plateY + PL.d], plateTop, P, "left");
  out.push(`<g transform="${matrix}">${plateFace(lane)}</g>`);
  return `<g class="tf-tray" data-tray="${lane}">${out.join("")}</g>`;
}

// ---- portals ----------------------------------------------------------------------------------------------
// back: the far leg. front: the near leg and the deck. A tray passes between the two.
function portalBack(m, lane) {
  const x = L.laneX(lane), yc = L.MODS[m], Mo = L.MOD;
  const leg = { x: x - Mo.w / 2, y: yc - Mo.d / 2 + 1, w: Mo.leg, d: Mo.d - 2, r: 0.6 };
  const foot = { x: x - Mo.w / 2 - 0.9, y: yc - Mo.d / 2, w: Mo.leg + 1.8, d: Mo.d, r: 0.8 };
  return S(slab(foot, 0, 0.9, 2), { tone: "lo", crease: "none" }) + S(slab(leg, 0.9, Mo.z - 0.9, 2), { tone: "mid", crease: "none" });
}

function portalFront(m, lane) {
  const x = L.laneX(lane), yc = L.MODS[m], Mo = L.MOD;
  const kind = L.MOD_KIND[m];
  const out = [];
  const leg = { x: x + Mo.w / 2 - Mo.leg, y: yc - Mo.d / 2 + 1, w: Mo.leg, d: Mo.d - 2, r: 0.6 };
  const foot = { x: x + Mo.w / 2 - Mo.leg - 0.9, y: yc - Mo.d / 2, w: Mo.leg + 1.8, d: Mo.d, r: 0.8 };
  out.push(S(slab(foot, 0, 0.9, 2), { tone: "lo", crease: "none" }));
  out.push(S(slab(leg, 0.9, Mo.z - 0.9, 2), { tone: "mid", crease: "none" }));
  const deck = { x: x - Mo.w / 2, y: yc - Mo.d / 2, w: Mo.w, d: Mo.d, r: 1.4 };
  const zTop = Mo.z + Mo.h;
  out.push(S(slab(deck, Mo.z, Mo.h, 4, 0.5), { tone: "mid", inner: Ln(k.sideSeam(deck, Mo.z + Mo.h / 2, P, 4), { tone: "faint" }), className: "tf-deck" }));
  if (kind === "attn") {
    for (const [h, dx] of [[0, -5], [1, 5]]) {
      const slot = { x: x + dx - 3.6, y: yc - 2.2, w: 7.2, d: 4.4, r: 0.8 };
      out.push(Ln(k.planOutline(slot, zTop, P, 3), { tone: "lo" }));
      const card = slab({ x: x + dx - 3, y: yc - 0.7, w: 6, d: 1.4, r: 0.4 }, zTop, 6.5, 2, 0);
      out.push(`<g class="tf-card" data-card="${m},${lane},${h}">${S(card, { tone: h ? "mid" : "hi", crease: "none" })}<circle class="tf-lamp" data-lamp="${m},${lane},${h}" cx="${at([x + dx, yc + 0.7, zTop + 5.2])[0].toFixed(1)}" cy="${at([x + dx, yc + 0.7, zTop + 5.2])[1].toFixed(1)}" r="0.9"/></g>`);
    }
    out.push(D(k.corners(deck, 2).map(([px, py]) => at([px, py, zTop])), { size: 0.4 }));
  } else {
    for (let v = 0; v < 3; v++) out.push(Ln(k.planOutline({ x: x - 5, y: yc - 3.8 + v * 2.8, w: 10, d: 1.2, r: 0.5 }, zTop, P, 3), { tone: "lo" }));
    // front face: cavities for the memories (drawn open by the live script)
    const cells = L.drawerCells(M.MEMORIES[L.MOD_LAYER[m]].length);
    const face = k.sideMatrix([x - Mo.w / 2, yc + Mo.d / 2], zTop, P, "left");
    const cav = cells.map((c) => `M${c.u.toFixed(2)} ${c.v.toFixed(2)}h${c.w.toFixed(2)}v${c.h.toFixed(2)}h${(-c.w).toFixed(2)}Z`).join("");
    out.push(`<g transform="${face}"><path class="tf-cavity" d="${cav}"/></g>`);
    out.push(`<g class="tf-drawers" data-drawers="${m},${lane}"></g>`);
    out.push(D(k.corners(deck, 2).map(([px, py]) => at([px, py, zTop])), { size: 0.4 }));
  }
  return `<g class="tf-front" data-portal="${m},${lane}">${out.join("")}</g>`;
}

function readerFront(lane) {
  const x = L.laneX(lane), y = L.READ_Y;
  const beam = { x: x - 11, y: y - 4, w: 22, d: 8, r: 0.6 };
  const mark = k.sideTicks(x - 11, x - 11, 22, 1, y + 4, 26, [2.6, 2.6], P);
  return S(slab(beam, 19, 7, 2, 0.3), { tone: "mid", crease: "none", inner: Ln(mark.major, { tone: "lo" }) });
}

// ---- lanes -------------------------------------------------------------------------------------------------
function lane(i) {
  const parts = [];
  // slots are ordered far to near (ascending y); the live script slots the tray in by its y
  for (let m = 0; m < L.MODS.length; m++) {
    parts.push(`<g class="tf-slot" data-slot="b${m}" data-y="${L.MODS[m]}">${portalBack(m, i)}</g>`);
    parts.push(`<g class="tf-slot" data-slot="f${m}" data-y="${L.MODS[m]}">${portalFront(m, i)}</g>`);
  }
  parts.push(`<g class="tf-slot" data-slot="r" data-y="${L.READ_Y}">${readerFront(i)}</g>`);
  const hit = `<path class="tf-hit" d="${k.onTop(k.ringOf({ x: L.laneX(i) - 11, y: L.BELT_Y0, w: 22, d: L.BELT_Y1 - L.BELT_Y0, r: 0 }, 1), 0, P, true)}"/>`;
  return `<g class="tf-lane" data-lane="${i}">${hit}${parts.join("")}${tray(i)}</g>`;
}

// ---- input: composing stick, slugs, type case -------------------------------------------------------------
const SLUG = { w: 17, d: 9, h: 8 };
function stick() {
  const out = [];
  const plan = { x: -98, y: L.STICK_Y - 8, w: 196, d: 16, r: 3 };
  out.push(S(slab(plan, 0, 5, 5, 0.6), { tone: "mid" }));
  for (let i = 0; i < L.N; i++) {
    const x = L.laneX(i);
    out.push(Ln(k.planOutline({ x: x - 9.3, y: L.STICK_Y - 5.4, w: 18.6, d: 10.8, r: 1.2 }, 5, P, 3), { tone: "lo" }));
  }
  out.push(D(k.corners(plan, 3).map(([x, y]) => at([x, y, 5])), { size: 0.5 }));
  for (let i = 0; i < L.N; i++) out.push(faceText([L.laneX(i), L.STICK_Y + 8], 5, 0, 3.6, String(i), { size: 2.8, tone: "mid" }));
  return out.join("");
}
function slugs() {
  const out = [];
  for (let i = 0; i < L.N; i++) {
    const x = L.laneX(i), y = L.STICK_Y;
    const plan = { x: x - SLUG.w / 2, y: y - SLUG.d / 2, w: SLUG.w, d: SLUG.d, r: 1 };
    const zTop = 5 + SLUG.h;
    const body = S(slab(plan, 5, SLUG.h, 3, 0.4), { tone: "hi", className: "tf-slug-body" });
    const text = faceText([x - SLUG.w / 2, y + SLUG.d / 2], zTop, SLUG.w / 2, 5.2, "", { size: 4.6, tone: "hi", data: ` data-slug="${i}"` });
    out.push(`<g class="tf-slug" data-slug-group="${i}">${body}${text}</g>`);
  }
  return out.join("");
}

const CASE = { x: -98, y: L.CASE_Y - 11, w: 196, d: 22 };
function typeCase() {
  const out = [];
  out.push(S(slab({ ...CASE, r: 3 }, 0, 7, 5, 0.6), { tone: "mid" }));
  const n = M.N_WORDS;
  const cw = (CASE.w - 8) / n;
  for (let w = 0; w < n; w++) {
    const x0 = CASE.x + 4 + w * cw;
    out.push(Ln(k.planOutline({ x: x0 + 0.6, y: CASE.y + 3, w: cw - 1.2, d: CASE.d - 6, r: 1 }, 7, P, 3), { tone: "lo" }));
  }
  out.push(D(k.corners({ ...CASE }, 3).map(([x, y]) => at([x, y, 7])), { size: 0.5 }));
  return out.join("");
}
function tiles() {
  const out = [];
  const n = M.N_WORDS;
  const cw = (CASE.w - 8) / n;
  for (let w = 0; w < n; w++) {
    const x0 = CASE.x + 4 + w * cw;
    const plan = { x: x0 + 1.6, y: CASE.y + 5, w: cw - 3.2, d: 7, r: 0.8 };
    const zTop = 7 + 6;
    const body = S(slab(plan, 7, 6, 3, 0.3), { tone: "hi" });
    const text = faceText([plan.x, plan.y + plan.d], zTop, plan.w / 2, 4.1, M.VOCAB[w + 1], { size: 3.9, tone: "hi" });
    out.push(`<g class="tf-tile" data-tile="${w + 1}" role="button" tabindex="0" aria-label="Add the word ${attr(M.VOCAB[w + 1])}">${body}${text}</g>`);
  }
  return out.join("");
}

// ---- reading bridge, probability dock, return rail --------------------------------------------------------
function bridgeEnds() {
  const out = [];
  const y = L.READ_Y;
  for (const sx of [-1, 1]) {
    const x0 = sx * 88;
    out.push(S(slab({ x: sx < 0 ? -100 : 88, y: y - 4, w: 12, d: 8, r: 0.6 }, 19, 7, 2, 0.3), { tone: "mid", crease: "none" }));
  }
  for (const sx of [-1, 1]) {
    out.push(S(k.cylinder(sx * 100, y, 3.4, 0, 3, P, 20), { tone: "lo" }));
    out.push(S(k.cylinder(sx * 100, y, 2.4, 3, 23, P, 20), { tone: "mid", crease: "none" }));
    out.push(Ln(k.sideArc(sx * 100, y, 2.4, 14, P, 14), { tone: "faint" }));
  }
  return out.join("");
}

const DOCK = { x: -92, y: L.RULER_Y - 13, w: 184, d: 26, r: 4 };
function dock() {
  const out = [];
  out.push(S(slab(DOCK, 0, 3, 5, 0.5), { tone: "mid" }));
  out.push(Ln(k.planOutline(k.insetPlan(DOCK, 3), 3, P, 4), { tone: "faint" }));
  out.push(D(k.corners(DOCK, 3).map(([x, y]) => at([x, y, 3])), { size: 0.5 }));
  const strip = { x: -82, y: L.RULER_Y - 6, w: 164, d: 12, r: 1.4 };
  const t = k.sideTicks(-80, 80, 8, 5, L.RULER_Y + 6, 4.2, [0.8, 1.2], P);
  out.push(S(slab(strip, 3, 1.2, 3, 0), { tone: "lo", crease: "none", inner: Ln(t.minor, { tone: "mid" }) + Ln(t.major, { tone: "hi" }) }));
  return out.join("");
}

const RAIL_W = 9;
function rail() {
  const out = [];
  const bits = [
    { x: 86, y: L.RULER_Y - RAIL_W / 2, w: L.RAIL_X + RAIL_W / 2 - 86, d: RAIL_W, r: 1.2 },
    { x: L.RAIL_X - RAIL_W / 2, y: L.STICK_Y - RAIL_W / 2, w: RAIL_W, d: L.RULER_Y - L.STICK_Y + RAIL_W, r: 1.2 },
    { x: 94, y: L.STICK_Y - RAIL_W / 2, w: L.RAIL_X + RAIL_W / 2 - 94, d: RAIL_W, r: 1.2 },
  ];
  for (const plan of bits) {
    out.push(S(slab(plan, 0, 2.4, 3, 0.3), { tone: "lo" }));
    out.push(Ln(k.planOutline(k.insetPlan(plan, 1.8), 2.4, P, 3), { tone: "faint" }));
  }
  return out.join("");
}

// ---- controls: temperature knob, context gauge, stage lamps, spec plate ------------------------------------
const KNOB = { x: -97, y: 203.5, R: 11, r: 6.2, from: (-135 * Math.PI) / 180, span: (270 * Math.PI) / 180 };
const GAUGE = { x: 84, y: 203.5, R: 9.6 };
const LAMPS = Array.from({ length: 8 }, (_, i) => ({ x: -49 + i * 14, y: 210 }));
function controls() {
  const out = [];
  const kp = { x: KNOB.x - 15, y: 191, w: 30, d: 25, r: 3 };
  out.push(S(slab(kp, 0, 1.6, 4, 0.3), { tone: "lo" }));
  out.push(D(k.corners(kp, 2.6).map(([x, y]) => at([x, y, 1.6])), { size: 0.45 }));
  const kt = k.radialTicks(KNOB.x, KNOB.y, KNOB.R, 18, 2, 1.6, [1.2, 2.4], P, KNOB.from, KNOB.span);
  out.push(Ln(k.ring(KNOB.x, KNOB.y, KNOB.R, 1.6, P, 48), { tone: "faint" }), Ln(kt.minor, { tone: "mid" }), Ln(kt.major, { tone: "hi" }));
  out.push(S(k.cylinder(KNOB.x, KNOB.y, KNOB.r + 0.8, 1.6, 1.4, P, 32), { tone: "lo" }));
  out.push(S(k.cylinder(KNOB.x, KNOB.y, KNOB.r, 3, 6.4, P, 36, 0.5), { tone: "hi", inner: Ln(k.knurl(KNOB.x, KNOB.y, KNOB.r, 3, 9.4, 36, P), { tone: "lo" }) }));
  out.push(Ln(k.ring(KNOB.x, KNOB.y, KNOB.r - 1.4, 9.4, P, 28), { tone: "faint" }));
  out.push(`<path class="iso-line tf-pointer" data-tone="lit" data-knob-pointer data-free="" d=""/>`);
  out.push(`<path class="tf-hit tf-knob-hit" data-knob-hit d="${k.ring(KNOB.x, KNOB.y, KNOB.R + 1, 9.4, P, 28)}"/>`);

  const gp = { x: GAUGE.x - 22, y: 191, w: 44, d: 25, r: 3 };
  out.push(S(slab(gp, 0, 1.6, 4, 0.3), { tone: "lo" }));
  out.push(D(k.corners(gp, 2.6).map(([x, y]) => at([x, y, 1.6])), { size: 0.45 }));
  out.push(S(k.cylinder(GAUGE.x, GAUGE.y, GAUGE.R, 1.6, 3.6, P, 40, 0.5), { tone: "hi", inner: Ln(k.sideArc(GAUGE.x, GAUGE.y, GAUGE.R, 3.2, P, 24), { tone: "faint" }) }));
  const top = 5.2;
  const gt = k.radialTicks(GAUGE.x, GAUGE.y, GAUGE.R - 1.6, 8, 2, top, [1.2, 2.4], P, KNOB.from, KNOB.span);
  out.push(Ln(k.ring(GAUGE.x, GAUGE.y, GAUGE.R - 1.6, top, P, 40), { tone: "faint" }), Ln(gt.minor, { tone: "mid" }), Ln(gt.major, { tone: "hi" }));
  out.push(`<path class="iso-line tf-needle" data-tone="lit" data-gauge-needle data-free="" d=""/>`);
  out.push(Ln(k.ring(GAUGE.x, GAUGE.y, 1.3, top, P, 14), { tone: "hi" }));

  const lp = { x: -33, y: 192, w: 66, d: 11, r: 1.4 };
  out.push(S(slab(lp, 0, 0.9, 3, 0), { tone: "lo", crease: "none" }));
  out.push(Ln(k.planOutline(k.insetPlan(lp, 1.4), 0.9, P, 3), { tone: "faint" }));
  out.push(`<text class="iso-face-text tf-text" data-tone="mid" transform="${k.topMatrix([0, 198.6], 0.9, P, "x")}" font-size="3.4" text-anchor="middle">2 LAYERS · 2 HEADS · d26</text>`);
  LAMPS.forEach((l, i) => {
    out.push(S(k.cylinder(l.x, l.y, 2.5, 0, 1.6, P, 18), { tone: "lo", crease: "none" }));
    const [cx, cy] = at([l.x, l.y, 1.6]);
    out.push(Ln(k.ring(l.x, l.y, 1.7, 1.6, P, 14), { tone: "mid" }), `<circle class="tf-stage-lamp" data-stage-lamp="${i}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1"/>`);
  });
  return out.join("");
}

// ---- station signs: small engraved plates at the left of each row ------------------------------------------
function signs() {
  const rows = [
    [1, "EMBED", L.SPAWN_Y + 10],
    [2, "ATTENTION 1", L.MODS[0] + 4],
    [3, "MEMORY 1", L.MODS[1] + 4],
    [4, "ATTENTION 2", L.MODS[2] + 4],
    [5, "MEMORY 2", L.MODS[3] + 4],
    [6, "UNEMBED", L.READ_Y + 4],
  ];
  return rows.map(([stage, text, y]) => {
    const x0 = -128, w = 28;
    const foot = S(slab({ x: x0 - 0.5, y: y - 2.2, w: w + 1, d: 4.4, r: 0.8 }, 0, 1, 2), { tone: "lo", crease: "none" });
    const plan = { x: x0, y: y - 0.8, w, d: 1.6, r: 0.4 };
    const body = S(slab(plan, 1, 8, 2, 0), { tone: "mid", crease: "none", className: "tf-sign-body" });
    const label = faceText([x0, y + 0.8], 9, w / 2, 5.4, text, { size: 3.5, tone: "hi" });
    return `<g class="tf-sign" data-sign="${stage}">${foot}${body}${label}</g>`;
  }).join("");
}

// ---- assemble -----------------------------------------------------------------------------------------------
const lanesSvg = Array.from({ length: L.N }, (_, i) => lane(i)).join("");

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "A production line with one lane per word. Each lane carries a tray holding the word's running numbers through attention and memory modules, and the last lane's result drops a marble onto a probability ruler to pick the next word.",
  body: [
    base(), belts(), rail(), controls(), signs(), typeCase(), tiles(), stick(), `<g class="tf-slugs">${slugs()}</g>`,
    `<g class="tf-lanes">${lanesSvg}</g>`, bridgeEnds(), dock(),
    `<g data-layer="ruler"></g><g data-layer="carriage"></g><g data-layer="cords"></g><g data-layer="marble"></g><g data-layer="return"></g>`,
  ].join(""),
});

const plate = k.plateHtml({
  fig: "Fig 4",
  title: "Transformer",
  hint: "Hover a lane · click a word to add it",
  readout: "",
  keys: [
    { mark: "lit", label: "The lane you are reading: its word, its tray and its attention" },
    { mark: "raised", label: "Portals: attention (cards and cords) and memory (drawers)" },
    { mark: "flat", label: "Trays carry the residual stream: banks T, A and O" },
  ],
  caption:
    "A real two-layer, two-head language model, small enough to read: RMSNorm, rotary positions, causal attention, SwiGLU memories, a residual stream and softmax sampling, all computed live in this page. Its weights are set by hand rather than trained, so it only knows one tiny language of eight words. A real model has the same parts with learned weights, thousands of numbers per lane and dozens of layers.",
  body: `<div class="tf-stage" tabindex="0" role="group" aria-label="Transformer line. Space plays or pauses, left and right choose a lane, up and down change the step, backspace removes the last word.">${svg}</div>`,
});

const STAGE_NAMES = ["Words", "Embed", "Attention 1", "Memory 1", "Attention 2", "Memory 2", "Unembed", "Sample"];
const stepButtons = STAGE_NAMES.map((n, i) => `<button type="button" class="tf-step" data-stage="${i}" aria-pressed="false"><span>0${i + 1}</span>${n}</button>`).join("");
const presetButtons = M.PRESETS.map((p, i) => `<button type="button" class="tf-btn" data-preset="${i}" title="${attr(p.note)}">${p.label}</button>`).join("");
const wordButtons = M.VOCAB.slice(1).map((w, i) => `<button type="button" class="tf-btn tf-word" data-word="${i + 1}">${attr(w)}</button>`).join("");

const SOURCES = [
  ["Attention Is All You Need", "arxiv.org/abs/1706.03762", "the transformer, scaled dot-product attention, multi-head attention"],
  ["RoFormer: rotary position embedding", "arxiv.org/abs/2104.09864", "positions as rotations of queries and keys"],
  ["Root mean square layer normalization", "arxiv.org/abs/1910.07467", "RMSNorm"],
  ["GLU variants improve transformer", "arxiv.org/abs/2002.05202", "SwiGLU feed-forward layers"],
  ["LLaMA: open and efficient foundation models", "arxiv.org/abs/2302.13971", "pre-norm, RMSNorm, SwiGLU and RoPE in a modern decoder"],
  ["Transformer feed-forward layers are key-value memories", "arxiv.org/abs/2012.14913", "the drawers"],
  ["In-context learning and induction heads", "arxiv.org/abs/2209.11895", "the induction head"],
  ["On layer normalization in the transformer architecture", "arxiv.org/abs/2002.04745", "why the norm sits before each sublayer"],
  ["Efficiently scaling transformer inference", "arxiv.org/abs/2211.05102", "the KV cache and why decoding is memory-bound"],
  ["GQA: grouped-query attention", "arxiv.org/abs/2305.13245", "sharing key and value heads to shrink the cache"],
  ["Language models are few-shot learners", "arxiv.org/abs/2005.14165", "GPT-3's sizes, quoted above"],
];

const PANEL = `
<section class="tf-panel" aria-label="Transformer controls and readings">
  <p class="tf-sr" data-live aria-live="polite"></p>
  <div class="tf-controls">
    <button type="button" class="tf-btn tf-play" data-play aria-pressed="false">Pause</button>
    <div class="tf-steps" role="group" aria-label="Steps of one forward pass">${stepButtons}</div>
    <label class="tf-scrub"><span class="tf-label">Time</span><input type="range" data-scrub min="0" max="8" step="0.01" value="0" aria-label="Position in the forward pass"></label>
  </div>
  <div class="tf-compose">
    <div class="tf-group"><span class="tf-label">Try a prompt</span><div class="tf-btns">${presetButtons}</div></div>
    <div class="tf-group"><span class="tf-label">Add a word</span><div class="tf-btns">${wordButtons}<button type="button" class="tf-btn" data-undo title="Remove the last word">Undo</button></div></div>
    <label class="tf-temp"><span class="tf-label">Temperature</span><input type="range" data-temp min="0.2" max="2" step="0.05" value="1" aria-label="Sampling temperature"><output data-temp-out>1.00</output></label>
  </div>
  <div class="tf-cards">
    <article class="tf-card tf-wide" data-step-card aria-live="off"><h3 data-step-title></h3><p data-step-text></p></article>
    <article class="tf-card"><h4 data-lane-name></h4><div data-lane-bars></div></article>
    <article class="tf-card" data-next></article>
    <article class="tf-card tf-wide" data-attn></article>
    <article class="tf-card" data-mem></article>
    <article class="tf-card"><h4>Every lane predicts its next word</h4><div class="tf-every" data-every></div><p class="tf-note">Only the last lane's prediction is used to continue the text. The others are what the model is trained on.</p></article>
  </div>
  <section class="tf-learn">
    <h2>How to read the machine</h2>
    <dl>
      <dt>Type case and stick</dt><dd>The type case is the vocabulary: click a word to append it. The stick holds the context, at most eight lanes including the start marker.</dd>
      <dt>Lane and tray</dt><dd>Each word runs down its own lane on a tray. The tray is the residual stream: three banks of numbers that steps add to and never overwrite. T says who I am, A says who came before me, O says what I will say next.</dd>
      <dt>Portals with cards</dt><dd>Attention. Each lane keeps a key and a value in two cards per layer, one per head. Cords reach back to the lanes it reads, thick for a high weight. The cards stay put, which is the key-value cache.</dd>
      <dt>Portals with drawers</dt><dd>Memories. A drawer opens when the tray matches its key and writes its votes for the next word into the tray.</dd>
      <dt>Bridge, ruler and marble</dt><dd>The last lane is read out as scores, softmax makes them probabilities, and the ruler lays them out end to end. A marble dropped at a random point picks the word. The word returns by the rail to the end of the stick.</dd>
    </dl>
    <h2>What is real and what is simplified</h2>
    <p>Every number in the figure comes from the arithmetic of a ${M.SPEC.layers}-layer, ${M.SPEC.heads}-head decoder with ${M.SPEC.dModel} numbers per lane: ${M.SPEC.norm}, ${M.SPEC.position}, ${M.SPEC.activation} memories (${M.SPEC.memories.join(" and ")} of them), causal masking and a residual stream. Nothing is faked.</p>
    <p>What is simplified: the weights were written by hand from rules, not learned, so the three banks stay neatly apart. A trained model spreads the same information across all its numbers, with no labels, and uses many more heads, layers and memories. This toy only knows eight words, but the parts and the data flow are the ones in every modern language model.</p>
    <p>For scale: GPT-3 has 96 layers, 96 heads and 12,288 numbers per lane, and reads 2,048 lanes at once. LLaMA 65B has 80 layers, 64 heads and 8,192 numbers per lane. Modern models also share key and value heads between groups of query heads to shrink the cache you see in the portal cards.</p>
    <h2>Where the ideas come from</h2>
    <ul class="tf-sources">${SOURCES.map(([t, u, n]) => `<li><a href="https://${u}" rel="noopener">${t}</a> <span>${n}</span></li>`).join("")}</ul>
  </section>
</section>`;

// Inline a module under a name, so its helpers don't collide with the kit's.
function inlineModule(file, name) {
  const src = readFileSync(join(HERE, file), "utf8");
  const names = [...src.matchAll(/^export (?:const|function|let|class) ([A-Za-z0-9_$]+)/gm)].map((m) => m[1]);
  return `const ${name} = (() => {\n${src.replace(/^export /gm, "")}\nreturn { ${names.join(", ")} };\n})();`;
}

const CSS = readFileSync(join(HERE, "transformer.css"), "utf8");
const live = `${inlineModule("model.mjs", "M")}\n${inlineModule("layout.mjs", "L")}\nconst DATA = ${JSON.stringify({ P, KNOB, GAUGE })};\n${readFileSync(join(HERE, "live.js"), "utf8")}`;
const page = k.pageHtml({ title: "Transformer", theme, body: `<style>${CSS}</style>${plate}${PANEL}`, script: kitScript() + "\n" + live, width: 700 });
const AUTO_THEME = `<script>(()=>{const mq=matchMedia("(prefers-color-scheme: dark)");const set=()=>{document.body.dataset.theme=mq.matches?"dark":"light";document.documentElement.style.colorScheme=mq.matches?"dark":"light";};set();mq.addEventListener("change",set);})()</script>`;
const name = theme === "light" ? "index.html" : "transformer-dark.html";
writeFileSync(join(HERE, name), theme === "light" ? page.replace('<body class="iso" data-theme="light">', `<body class="iso" data-theme="light">${AUTO_THEME}`) : page);
console.log("wrote", name, (page.length / 1024).toFixed(0) + " KB");
