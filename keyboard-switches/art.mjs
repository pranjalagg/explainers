// Keyboard switches: the geometry. Everything here is built once, at the origin of a specimen, in world units
// (U = 5 per millimetre of key travel). A specimen is a row of layers painted back to front; the parts that move
// are separate groups so the live script can write one transform to them.
//
// The five switches that share the Cherry MX housing (linear, tactile, clicky, optical, Hall) are drawn as a corner
// cutaway: the front wall and the right wall are taken off, so the mechanism faces the camera.
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { vcoil } from "./shared.mjs";
import { U } from "./model.mjs";

export const PITCH = 95;
export const GEO = {
  pcb: [-8, 0],
  floor: 6,
  plate: [17, 24],
  step: 24,
  ring: [52, 58],
  capBottom: 78,
  capTop: 118,
  hx: 35, // half width of the lower housing
  ux: 39, // half width of the upper housing
  seat: 10, // top of the spring seat
  bossTop: 42, // underside of the stem boss at rest
  legBottom: 26,
  leafZ: 7,
  coilR: 12,
  coilTurns: 7,
};
// Where the contact point sits on the back leaf, so the wedge on the stem pushes it exactly when the model says.
export const CONTACT_Z = { linear: 20, tactile: 20, clicky: 18 };
export const BUCKLE = { R: 22, r: 17.5, z0: 20, z1: 59, pivotY: -24, pivotZ: 5, rest: (10 * Math.PI) / 180, plunger: 54, coilR: 7, turns: 9, amp: 10.5 };
export const FLEX = { at: 1.8, amp: 2.6, width: 0.32 };
export const JACKET_DROP = 4;
export const LEAF_GAP = 1;

export function makeArt(P) {
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const at = (point) => k.iso(point, P);

  const box = (x0, x1, y0, y1, z0, z1, { tone = "mid", r = 0.8, steps = 3, bevel = 0.35, crease, lit, inner, flat } = {}) => {
    const rr = Math.min(r, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01);
    return S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: Math.max(rr, 0.05) }, z0, z1 - z0, P, steps, bevel), { tone, crease, lit, inner, flat });
  };
  // A prism whose profile lies in the x-z plane, extruded along y; and one in the y-z plane, extruded along x.
  const FY = G.frameOf([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const FX = G.frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const wedge = (poly, y0, y1, { tone = "hi", crease, lit } = {}) => S(G.prismOf(FY, poly, y0, y1, P), { tone, crease, lit });
  const wedgeX = (poly, x0, x1, { tone = "hi", crease, lit } = {}) => S(G.prismOf(FX, poly, x0, x1, P), { tone, crease, lit });
  const cyl = (x, y, r, z0, z1, { tone = "mid", steps = 20, bevel = 0, crease, lit } = {}) => S(k.cylinder(x, y, r, z0, z1 - z0, P, steps, bevel), { tone, crease, lit });
  const plus = (a, b, z0, z1, opts = {}) => {
    const ring = [[-a, -b], [-b, -b], [-b, -a], [b, -a], [b, -b], [a, -b], [a, b], [b, b], [b, a], [-b, a], [-b, b], [-a, b]];
    return S(k.extrude(ring, z0, z1 - z0, P, { convex: false, bevel: 0.3 }), { tone: "hi", ...opts });
  };
  const line = (a, b, z, style = {}) => L(k.lineOnTop(a, b, z, P), { tone: "faint", ...style });
  const rise = (x, y, z0, z1, style = {}) => L(k.rise([x, y], z0, z1, P), { tone: "faint", ...style });
  const screws = (list, z) => D(list.map(([x, y]) => at([x, y, z])), { size: 0.5, tone: "mid" });

  // ---------- the pieces every MX-style specimen has ----------
  function board() {
    const out = [];
    out.push(box(-47.5, 47.5, -46, 46, GEO.pcb[0], GEO.pcb[1], { tone: "lo", r: 0.6, bevel: 0 }));
    // Silk outline and the diode that keeps the matrix honest, on the visible front margin of the board.
    out.push(L(k.planOutline({ x: -44, y: 33, w: 88, d: 11, r: 1 }, 0, P, 3), { tone: "faint" }));
    out.push(box(-34, -26, 37, 41, 0, 1.6, { tone: "hi", r: 0.4, steps: 2, bevel: 0 }));
    out.push(box(-31.4, -30.6, 37, 41, 1.6, 1.62, { tone: "lo", r: 0.05, steps: 1, bevel: 0, flat: true }));
    out.push(L(k.lineOnTop([-26, 39], [-14, 39], 0, P), { tone: "faint", free: false }));
    out.push(L(k.lineOnTop([-34, 39], [-44, 39], 0, P), { tone: "faint" }));
    out.push(D([at([-14, 39, 0]), at([-44, 39, 0])], { size: 0.55, tone: "mid" }));
    return out.join("");
  }

  function plateBack() {
    return [
      box(-47.5, 47.5, -46, -35, GEO.plate[0], GEO.plate[1], { tone: "mid", r: 0.6 }),
      box(-47.5, -35, -35, 35, GEO.plate[0], GEO.plate[1], { tone: "mid", r: 0.6 }),
      screws([[-42, -41], [-42, 30]], GEO.plate[1]),
    ].join("");
  }
  function plateFront() {
    return [
      box(35, 47.5, -35, 35, GEO.plate[0], GEO.plate[1], { tone: "mid", r: 0.6 }),
      box(-47.5, 47.5, 35, 46, GEO.plate[0], GEO.plate[1], { tone: "mid", r: 0.6 }),
      screws([[42, -30], [42, 41], [-42, 41]], GEO.plate[1]),
    ].join("");
  }

  // Floor, lower and upper housing: back wall and left wall, top ring on the same two sides.
  function housingLower() {
    const { hx, floor, step } = GEO;
    return [
      box(-hx, hx, -hx, hx, 0, floor, { tone: "mid", r: 1.2 }),
      box(-hx, hx, -hx, -hx + 6, floor, step, { tone: "mid", r: 0.6 }),
      box(-hx, -hx + 6, -hx + 6, hx, floor, step, { tone: "mid", r: 0.6 }),
    ].join("");
  }
  function housingUpper() {
    const { ux, step, ring } = GEO;
    const out = [];
    out.push(box(-ux, ux, -ux, -ux + 6, step, ring[1], { tone: "mid", r: 0.8 }));
    out.push(box(-ux, -ux + 6, -ux + 6, ux, step, ring[1], { tone: "mid", r: 0.8 }));
    // The guide channels the stem runs in and the seam where the two housings meet. They run on up under the ring, which hides their ends.
    out.push(rise(-17, -ux + 6, step, ring[0] + 4));
    out.push(line([-ux + 6, -ux + 6], [ux, -ux + 6], step + 0.01, { tone: "faint" }));
    out.push(box(-ux + 6, ux - 6, -ux + 6, -13, ring[0], ring[1], { tone: "mid", r: 0.5 }));
    out.push(box(-ux + 6, -13, -13, ux, ring[0], ring[1], { tone: "mid", r: 0.5 }));
    out.push(screws([[-ux + 3, -ux + 3]], ring[1]));
    return out.join("");
  }
  const housing = () => housingLower() + housingUpper();

  // The buckling spring's parts that do not move: backplate, three membrane sheets, the barrel plate and the barrel,
  // both cut through their middle, and the pivot the hammer rocks on.
  function buckleBase() {
    const out = [];
    out.push(box(-47.5, 47.5, -46, 46, GEO.pcb[0], 0, { tone: "lo", r: 0.6, bevel: 0 }));
    out.push(L(k.planOutline({ x: -44, y: 38, w: 88, d: 6, r: 1 }, 0, P, 3), { tone: "faint" }));
    out.push(box(-46.5, 46.5, -45.5, 45.5, 0, 1, { tone: "lo", r: 0.4, bevel: 0 }));
    out.push(box(-46, 46, -45, 45, 1, 2, { tone: "mid", r: 0.4, bevel: 0 }));
    out.push(box(-45.5, 45.5, -44.5, 44.5, 2, 3, { tone: "lo", r: 0.4, bevel: 0 }));
    // The contact pads on the top sheet that the hammer lands on.
    for (const x of [-9, 9]) out.push(L(k.ring(x, 22, 4.5, 3, P, 18), { tone: "mid" }));
    return out.join("");
  }
  const BARREL = { R: 22, r: 17.5, z0: 20, z1: 59 };
  function buckleBarrel() {
    const out = [];
    out.push(box(-47.5, 47.5, -46, 0, 12, 20, { tone: "mid", r: 0.8 }));
    for (const x of [-17, 17]) out.push(box(x - 2, x + 2, -28, -20, 3, 12, { tone: "mid", r: 0.5, bevel: 0 }));
    out.push(S(G.disc(-17, 17, 1.8, G.frameAlong([0, -24, 7], [1, 0, 0]), P), { tone: "hi", crease: "none" }));
    const ring = [];
    const n = 28;
    for (let i = 0; i <= n; i++) { const a = Math.PI + (Math.PI * i) / n; ring.push([BARREL.R * Math.cos(a), BARREL.R * Math.sin(a)]); }
    for (let i = n; i >= 0; i--) { const a = Math.PI + (Math.PI * i) / n; ring.push([BARREL.r * Math.cos(a), BARREL.r * Math.sin(a)]); }
    out.push(S(k.extrude(ring, BARREL.z0, BARREL.z1 - BARREL.z0, P, { convex: false, bevel: 0.3 }), { tone: "mid" }));
    return out.join("");
  }

  // The stem's rest geometry. Each piece is a small function so the variants can mix them.
  const legL = (z1 = 46) => box(-24, -18, -12, 12, GEO.legBottom, z1, { tone: "hi", r: 0.6 });
  const legR = (z1 = 46) => box(18, 24, -12, 12, GEO.legBottom, z1, { tone: "hi", r: 0.6 });
  // The rear lug that carries the tail, and the tail itself: a wedge on its back face is what pushes the moving leaf.
  const lug = (z0 = 46, z1 = 52) => box(16, 26, -24, -16, z0, z1, { tone: "hi", r: 0.6 });
  const tail = (z0 = GEO.legBottom, z1 = 46) =>
    box(16, 26, -24, -18, z0, z1, { tone: "hi", r: 0.5 }) +
    wedgeX([[-24, z0 + 2], [-26.6, z0 + 4], [-26.6, z1], [-24, z1]], 16, 26, { tone: "hi" });
  const collar = () => box(-26, 26, -16, 16, 46, 52, { tone: "hi", r: 1 });
  const column = () => box(-12, 12, -9, 9, 52, 72, { tone: "hi", r: 0.8 }) + line([-12, 0], [12, 0], 72, { tone: "faint" }) ;
  const cross = () => plus(10, 3, 72, 88);
  const boss = (z0 = GEO.bossTop, z1 = 46) => cyl(0, 0, GEO.coilR + 0.5, z0, z1, { tone: "hi", steps: 28 });
  const seat = () => cyl(0, 0, GEO.coilR + 0.5, GEO.floor, GEO.seat, { tone: "mid", steps: 28 }) + L(k.ring(0, 0, GEO.coilR, GEO.seat, P, 36), { tone: "faint" });

  // The two leaves on the back wall. The moving one is pushed rearwards into the fixed one.
  const leafFixed = (zc) => box(12, 30, -28.6, -27.6, GEO.leafZ, 36, { tone: "mid", r: 0.3, bevel: 0 }) + D([at([21, -27.6, zc])], { size: 0.5, tone: "lo" });
  const leafMoving = (zc) => box(12, 30, -26.6, -25.6, GEO.leafZ, 34, { tone: "hi", r: 0.3, bevel: 0 });
  const contactDot = (zc) => `<g data-spark>${D([at([21, -25.6, zc])], { size: 0.7, tone: "lit" })}</g>`;

  // The cap: a full top plate for the probe to press on, with the right and front walls taken off like the housing's.
  function cap() {
    const { capBottom: b, capTop: t } = GEO;
    const out = [];
    out.push(box(-45, -40, -45, 45, b, t - 8, { tone: "lo", r: 0.8 }));
    out.push(box(-40, 45, -45, -40, b, t - 8, { tone: "lo", r: 0.8 }));
    for (const [x0, x1, y0, y1] of [[-14, -11, -14, 14], [-11, 14, -14, -11]]) out.push(box(x0, x1, y0, y1, b, t - 8, { tone: "lo", r: 0.3, bevel: 0 }));
    out.push(box(-45, 45, -45, 45, t - 8, t, { tone: "lo", r: 3, steps: 5 }));
    // The dish in the top, and the ring that stands for the legend.
    out.push(L(k.planOutline({ x: -36, y: -36, w: 72, d: 72, r: 8 }, t, P, 5), { tone: "faint" }));
    return out.join("");
  }

  return { S, L, D, at, box, wedge, wedgeX, cyl, plus, line, rise, screws, FY, FX, board, plateBack, plateFront, housing, housingLower, housingUpper, buckleBase, buckleBarrel, legL, legR, lug, tail, collar, column, cross, boss, seat, leafFixed, leafMoving, contactDot, cap };
}
