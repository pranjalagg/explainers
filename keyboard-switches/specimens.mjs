// The specimens. Each builder returns markup for one switch at the origin, painted back to front, with the parts that
// move in their own groups. The live script finds them by data attribute:
//   data-stem   moves with the key (value is a name, "cap" is the keycap)
//   data-jacket also drops when the click jacket fires
//   data-flex   the tactile leg that bends aside
//   data-leaf   the moving contact leaf, data-sig the parts that light when the circuit is made
//   data-spring the two halves of the coil, redrawn every frame
import * as k from "../kit/iso-kit.mjs";
import { vcoil, hammerSvg, seatTop, domeShell, domeAt, DOME } from "./shared.mjs";
import { GEO, CONTACT_Z, FLEX, BUCKLE } from "./art.mjs";

const ZR = 21; // where the ridge on the housing wall sits, so the leg's bump rides over it at FLEX.at mm
export const CLICKY = { shoulder: [40, 44], jacket: [48, 52], boss: [36, 40], tailBottom: 28 };

export function buildMX(A, P, kind) {
  const { L, D, at, box, wedge, cyl } = A;
  const zc = CONTACT_Z[kind];
  const contact = kind === "linear" || kind === "tactile" || kind === "clicky";
  const springTop = kind === "clicky" ? CLICKY.boss[0] : GEO.bossTop;
  const springFloor = GEO.seat;
  const spring = vcoil(0, 0, springFloor, springTop, GEO.coilR, GEO.coilTurns, P);
  const coil = (which, d) => `<path data-spring="${which}" class="iso-line" data-tone="${which === "front" ? "hi" : "mid"}" style="stroke-width:1.15" d="${d}"/>`;
  const stem = (name, inner, extra = "") => `<g data-stem="${name}"${extra}>${inner}</g>`;
  const out = [];

  // 1. what never moves and sits behind the mechanism
  const back = [A.board(), A.plateBack(), A.housing()];
  if (kind === "tactile") back.push(wedge([[-29, ZR - 3], [-25, ZR - 0.8], [-25, ZR + 0.8], [-29, ZR + 3]], -8, 8, { tone: "mid" }));
  if (contact) back.push(`<g data-sig="fixed">${A.leafFixed(zc)}</g>`);
  if (kind === "optical") {
    back.push(box(-28.5, -24.5, 19, 25, GEO.floor, 24, { tone: "hi", r: 0.8 }));
    back.push(D([at([-24.5, 22, 20])], { size: 0.8, tone: "lit" }));
    back.push(L(k.ring(-26.5, 22, 1.3, 24, P, 10), { tone: "lo" }));
  }
  if (kind === "hall") {
    back.push(A.seat());
    back.push(box(-6, 6, -6, 6, GEO.seat, 12, { tone: "hi", r: 0.8, bevel: 0.3 }));
    back.push(D([[-4, -4], [4, -4], [-4, 4], [4, 4]].map(([x, y]) => at([x, y, 12])), { size: 0.4, tone: "mid" }));
  } else back.push(A.seat());
  out.push(`<g data-layer="back">${back.join("")}</g>`);
  if (kind === "optical") out.push(`<path data-beam="left" class="iso-line" data-tone="lit" style="stroke-width:1.05" d=""/>`);

  // 2. the mechanism, left to right
  if (contact) out.push(`<g data-leaf data-sig="moving">${A.leafMoving(zc)}${A.contactDot(zc)}</g>`);
  if (kind === "tactile") {
    const zb = ZR + 5 * FLEX.at;
    out.push(stem("a", A.legL() + wedge([[-24, zb - 3], [-27.5, zb - 0.8], [-27.5, zb + 0.8], [-24, zb + 3]], -8, 8, { tone: "hi" }), " data-flex"));
  } else out.push(stem("a", A.legL(kind === "clicky" ? CLICKY.shoulder[0] : 46)));
  if (contact && kind !== "clicky") out.push(stem("tail", A.lug() + A.tail()));
  out.push(coil("back", spring.back));
  if (kind === "clicky") {
    const [s0, s1] = CLICKY.shoulder;
    const [j0, j1] = CLICKY.jacket;
    out.push(stem("b", A.boss(CLICKY.boss[0], CLICKY.boss[1]) + box(-26, 26, -16, 16, s0, s1, { tone: "hi", r: 1 })));
    out.push(stem("j", A.lug(j0, j1) + A.tail(CLICKY.tailBottom, j0) + box(-26, -12, -16, 16, j0, j1, { tone: "mid", r: 1 }) + box(-12, 12, -16, -9, j0, j1, { tone: "mid", r: 0.6 }), " data-jacket"));
    out.push(stem("b2", box(-12, 12, -9, 9, s1, 72, { tone: "hi", r: 0.8 })));
    out.push(stem("j2", box(-12, 12, 9, 16, j0, j1, { tone: "mid", r: 0.6 }) + box(12, 26, -16, 16, j0, j1, { tone: "mid", r: 1 }), " data-jacket"));
  } else {
    const magnet = kind === "hall" ? cyl(0, 0, 6.5, 36.5, 39.25, { tone: "lo", steps: 24 }) + cyl(0, 0, 6.5, 39.25, GEO.bossTop, { tone: "hi", steps: 24 }) : "";
    out.push(stem("b", A.collar() + A.boss() + magnet + A.column()));
  }
  out.push(coil("front", spring.front));
  if (kind === "hall") out.push(`<g data-field></g>`);
  const vane = kind === "optical" ? box(-1.5, 1.5, 16, 27, 27.5, 52, { tone: "hi", r: 0.4, steps: 2 }) : "";
  out.push(stem("c", A.legR(kind === "clicky" ? CLICKY.shoulder[0] : 46) + A.cross() + vane));
  if (kind === "optical") out.push(`<path data-beam="right" class="iso-line" data-tone="lit" style="stroke-width:1.05" d=""/>`);

  // 3. what stands in front
  const front = [A.plateFront()];
  if (kind === "optical") {
    front.push(`<g data-sig="pd">${box(24.5, 28.5, 19, 25, GEO.floor, 24, { tone: "hi", r: 0.8 })}</g>`);
    front.push(L(k.ring(26.5, 22, 1.3, 24, P, 10), { tone: "lo" }));
  }
  out.push(`<g data-layer="front">${front.join("")}</g>`);

  // 4. the cap rides on the stem
  out.push(stem("cap", A.cap()));
  return out.join("");
}

// ---------- buckling spring ----------
export function buildBuckling(A, P) {
  const { L, box } = A;
  const b = BUCKLE;
  const out = [];
  out.push(`<g data-layer="back">${A.buckleBase()}${A.buckleBarrel()}</g>`);
  out.push(`<g data-sig="pads">${L(k.ring(-9, 22, 4.5, 3, P, 18) + k.ring(9, 22, 4.5, 3, P, 18), { tone: "lo" })}</g>`);
  out.push(`<g data-hammer>${hammerSvg(P, b.rest, b)}</g>`);
  const sp = vcoil(0, 0, seatTop(b.rest, b), b.plunger, b.coilR, b.turns, P);
  out.push(`<path data-spring="back" class="iso-line" data-tone="mid" style="stroke-width:1.15" d="${sp.back}"/>`);
  out.push(`<g data-stem="plunger">${A.cyl(0, 0, 9, b.plunger, 112, { tone: "hi", steps: 28 })}</g>`);
  out.push(`<path data-spring="front" class="iso-line" data-tone="hi" style="stroke-width:1.15" d="${sp.front}"/>`);
  out.push(`<path data-impact class="iso-line" data-tone="lit" style="stroke-width:1.2;opacity:0" d=""/>`);
  out.push(`<g data-layer="front">${A.plateFront ? "" : ""}</g>`);
  out.push(`<g data-stem="cap">${A.cap()}</g>`);
  return out.join("");
}

// ---------- Topre ----------
export function buildTopre(A, P) {
  const { L, box, S } = A;
  const out = [];
  const back = [A.board(), A.plateBack(), A.housingUpper()];
  // The two D-shaped electrodes under a thin film: half discs either side of a narrow gap.
  const d = (sign) => Array.from({ length: 19 }, (_, i) => { const a = -Math.PI / 2 + (Math.PI * i) / 18; return [sign * (1.2 + 17 * Math.cos(a)), 17 * Math.sin(a)]; });
  back.push(`<g data-sig="pads">${S(k.extrude(d(-1), 0, 1, P, { convex: false }), { tone: "lo", crease: "none" })}${S(k.extrude(d(1), 0, 1, P, { convex: false }), { tone: "lo", crease: "none" })}</g>`);
  back.push(L(k.ring(0, 0, 16, DOME.foot, P, 40), { tone: "faint" }));
  out.push(`<g data-layer="back">${back.join("")}</g>`);
  const dm = domeAt(0, 5);
  out.push(`<g data-dome class="kb-rubber">${S(domeShell(P, 0, dm.H, dm.ro, DOME.wall), { tone: "hi" })}</g>`);
  const sp = vcoil(0, 0, dm.spring.z0, dm.spring.z1, dm.spring.r, dm.spring.turns, P);
  out.push(`<path data-spring="back" class="iso-line" data-tone="mid" style="stroke-width:1.15" d="${sp.back}"/>`);
  out.push(`<g data-stem="b">${A.collar()}${A.column()}</g>`);
  out.push(`<path data-spring="front" class="iso-line" data-tone="hi" style="stroke-width:1.15" d="${sp.front}"/>`);
  out.push(`<g data-stem="c">${A.cross()}</g>`);
  out.push(`<g data-stem="cap">${A.cap()}</g>`);
  return out.join("");
}
