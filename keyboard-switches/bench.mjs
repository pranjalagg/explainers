// The bench and the gantry that carries the probe. World units are the same as the specimens: 5 per millimetre of travel.
import * as k from "../kit/iso-kit.mjs";
import { PITCH } from "./art.mjs";

export const COUNT = 7;
export const XS = Array.from({ length: COUNT }, (_, i) => (i - 3) * PITCH);
export const BENCH = { x: -358, y: -90, w: 716, d: 180, r: 10, z: -26, h: 18 }; // top at z = -8
export const BEAM = { x0: -350, x1: 350, y0: -82, y1: -62, z0: 160, z1: 178 };
export const POSTS = [[-340, -72], [340, -72]];
export const STAGE = { half: 18, z0: 150, z1: 186 }; // the housing that guides the probe
export const DIAL = { r: 18, z: 186, h: 10, from: 0.78 * Math.PI, span: 1.44 * Math.PI, max: 100 };
export const PROBE = { rest: 118 }; // z of the pad's underside when it sits on a cap at rest

export function corners() {
  const out = [];
  for (const x of [BENCH.x, BENCH.x + BENCH.w]) for (const y of [BENCH.y, BENCH.y + BENCH.d]) out.push([x, y, BENCH.z - 6], [x, y, 200]);
  return out;
}

export function buildBench(A, P) {
  const { box, cyl, L, D, S, at } = A;
  const out = [];
  const plan = { x: BENCH.x, y: BENCH.y, w: BENCH.w, d: BENCH.d, r: BENCH.r };
  out.push(`<path class="iso-halo" d="${k.haloOf(plan, BENCH.z - 6, BENCH.h + 6, P)}"/>`);
  const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of byDepth(k.corners(plan, 24))) {
    out.push(S(k.cylinder(x, y, 9, BENCH.z - 6, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 7, BENCH.z - 4.2, 4.2, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(plan, BENCH.z, BENCH.h, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 6), -8, P), { tone: "lo" }));
  const screws = k.corners(plan, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, -8, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, -8])), { size: 0.5 }));
  return out.join("");
}

// The ruler along the front edge, the numbers and the lamps that show what the controller has registered.
export function buildRuler(A, P) {
  const { L, D, S, at } = A;
  const out = [];
  const strip = { x: -340, y: 52, w: 680, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, -8, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 19, 5, strip.y + 0.8, -7.4, [2, 4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  XS.forEach((x, i) => out.push(k.faceTextSvg(k.topMatrix([x, 64.5], -7.4, P, "x"), String(i + 1), { size: 4.2, tone: "mid", anchor: "middle" })));
  // A lamp for each switch: the controller's view of the key.
  XS.forEach((x, i) => {
    out.push(S(k.slabOf({ x: x - 9, y: 69, w: 18, d: 12, r: 3 }, -8, 2, P, 4, 0.4), { tone: "mid" }));
    out.push(`<g data-lamp="${i}">${S(k.cylinder(x, 75, 3.6, -6, 3.4, P, 20, 0.4), { tone: "hi" })}</g>`);
  });
  return out.join("");
}

// Two posts and a beam behind the row. Nothing here moves.
export function buildFrame(A, P) {
  const { box, cyl, L, D, S, at } = A;
  const out = [];
  for (const [x, y] of POSTS) {
    out.push(S(k.cylinder(x, y, 12, -8, 5, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 8, -3, BEAM.z1 + 3, P, 28), { tone: "mid", crease: "none" }));
    for (const z of [40, 90, 140]) out.push(L(k.sideArc(x, y, 8, z, P, 16), { tone: "faint" }));
    out.push(S(k.cylinder(x, y, 10, BEAM.z1, 3, P, 28), { tone: "mid" }));
  }
  out.push(box(BEAM.x0, BEAM.x1, BEAM.y0, BEAM.y1, BEAM.z0, BEAM.z1, { tone: "mid", r: 2, steps: 3, bevel: 0.6 }));
  // A ruler scale on the beam's top face, rooted on its front edge.
  const t = k.topTicks(BEAM.x0 + 14, BEAM.x1 - 14, 19, 5, BEAM.y1 - 6, BEAM.z1, [2, 4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(L(k.lineOnTop([BEAM.x0, BEAM.y1 - 6], [BEAM.x1, BEAM.y1 - 6], BEAM.z1, P), { tone: "faint" }));
  out.push(D([[BEAM.x0 + 6, -72], [BEAM.x1 - 6, -72]].map(([x, y]) => at([x, y, BEAM.z1])), { size: 0.5, tone: "mid" }));
  // The rail the carriage rides on, along the front face of the beam, and the stops at its ends.
  out.push(L(k.rise([BEAM.x0 + 22, BEAM.y1], BEAM.z0, BEAM.z1, P), { tone: "faint" }));
  out.push(L(k.rise([BEAM.x1 - 22, BEAM.y1], BEAM.z0, BEAM.z1, P), { tone: "faint" }));
  return out.join("");
}

// The carriage, the arm and the stage that guide the probe, and the dial that reads its load. All of it slides along x.
export function buildCarriage(A, P) {
  const { box, cyl, L, D, S, at } = A;
  const out = [];
  out.push(box(-26, 26, BEAM.y1, BEAM.y1 + 14, 154, 184, { tone: "mid", r: 2, steps: 3, bevel: 0.6 }));
  out.push(box(-26, 26, BEAM.y0 - 4, BEAM.y1 + 14, BEAM.z1, 184, { tone: "mid", r: 2, steps: 3, bevel: 0.5 }));
  out.push(D([[-20, BEAM.y1 + 10], [20, BEAM.y1 + 10]].map(([x, y]) => at([x, y, 184])), { size: 0.5, tone: "mid" }));
  out.push(box(-12, 12, BEAM.y1 + 14, -STAGE.half, 164, 178, { tone: "mid", r: 2, bevel: 0.5 }));
  return out.join("");
}

export function buildStage(A, P) {
  const { box, cyl, L, D, S, at } = A;
  const out = [];
  const h = STAGE.half;
  out.push(box(-h, h, -h, h, STAGE.z0, STAGE.z1, { tone: "mid", r: 3, steps: 4, bevel: 0.8 }));
  out.push(L(k.planOutline({ x: -h + 3, y: -h + 3, w: 2 * h - 6, d: 2 * h - 6, r: 2 }, STAGE.z1, P, 3), { tone: "faint" }));
  out.push(D([[-h + 3, -h + 3], [h - 3, -h + 3], [h - 3, h - 3], [-h + 3, h - 3]].map(([x, y]) => at([x, y, STAGE.z1])), { size: 0.45, tone: "mid" }));
  return out.join("");
}

export function buildDial(A, P) {
  const { box, cyl, L, D, S, at } = A;
  const out = [];
  const { r, z, h, from, span } = DIAL;
  const top = z + h;
  out.push(S(k.cylinder(0, 0, r, z, h, P, 56, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(0, 0, r, top - 3.2, top, 72, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(0, 0, r, top - 3.2, P, 36), { tone: "faint" }));
  out.push(L(k.ring(0, 0, r - 2.2, top, P, 56), { tone: "lo" }));
  const t = k.radialTicks(0, 0, r - 3, 50, 5, top, [1.2, 2.6], P, from, span);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(L(k.ring(0, 0, 1.6, top, P, 14), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([0, 9], top, P, "x"), "cN", { size: 2.4, tone: "lo", anchor: "middle" }));
  out.push(`<path data-needle class="iso-line" data-tone="lit" data-free="start" style="stroke-width:1.1" d="${needleAt(0, P)}"/>`);
  return out.join("");
}

export function needleAt(force, P) {
  const { r, z, h, from, span, max } = DIAL;
  const a = from + span * Math.min(1, Math.max(0, force / max));
  const top = z + h + 0.2;
  return k.lineOnTop([-Math.sin(a) * 3.4, Math.cos(a) * 3.4], [Math.sin(a) * (r - 4), -Math.cos(a) * (r - 4)], top, P);
}

// The probe travels in z as one piece. The rod is drawn before the stage so the housing hides the part inside it;
// the load cell, shank and pad hang below. Built with the pad at z = PROBE.rest.
export function buildProbeRod(A, P) {
  return A.S(k.cylinder(0, 0, 3, STAGE.z0 - 8, 40, P, 18), { tone: "mid", crease: "none" });
}
export function buildProbeLow(A, P) {
  const { L, S } = A;
  const out = [];
  const z0 = PROBE.rest;
  out.push(S(k.cylinder(0, 0, 8, z0 + 14, 12, P, 28, 0.5), { tone: "hi" }));
  out.push(L(k.sideArc(0, 0, 8, z0 + 20, P, 20), { tone: "faint" }));
  out.push(L(k.knurl(0, 0, 8, z0 + 14, z0 + 26, 20, P, 0.3), { tone: "lo" }));
  out.push(S(k.cylinder(0, 0, 3.5, z0 + 3, 11, P, 18), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(0, 0, 10, z0, 3, P, 32, 0.4), { tone: "hi" }));
  return out.join("");
}
