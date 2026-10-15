// Geometry of the sectioned pen, in the pen's own frame, in millimetres.
//   s   along the axis, from the nib tip toward the rear of the barrel
//   t   across the axis in the cut plane, positive on the nib's top side
//   y   out of the cut plane (the cut plane is y = 0; the half of the pen behind it stays)
// The pen leans back at TILT with its tip on the paper. Shared by the build and the live page.
import { U, CART } from "./model.mjs";

// The pose: how far the pen leans, and which way its rear points (dir 1: toward -x, dir -1: toward +x).
export let TILT, SIN, COS, DIR, AX, NM;
export function setPose(deg, dir = 1) {
  TILT = (deg * Math.PI) / 180;
  SIN = Math.sin(TILT);
  COS = Math.cos(TILT);
  DIR = dir;
  AX = [-dir * COS, 0, SIN];           // from the tip toward the rear, in the world
  NM = [dir * SIN, 0, COS];            // across the axis, toward the nib's top side
}
setPose(55, 1);

export const LEN = 86;

// Radii of the shells.
export const R_NIB = 3.3;              // the nib is an arch of this radius, sitting in a bore of the same radius
export const R_GRIP = 5.3;
export const R_RING = 5.75;
export const R_BAR = 6.0;
export const R_BAR_IN = 4.55;
export const S_FRONT = 15;             // front face of the grip
export const S_FLARE = 26;
export const S_JOINT = 41;             // grip meets barrel
export const S_RING = 42.8;
export const S_CAP = 82.5;

// Nib and feed.
export const NIB_TOP = 3.2;            // crown of the nib at the cut plane
export const NIB_UNDER = 2.7;
export const FEED_TOP = 2.25;          // the ink channel is the gap between this and the nib
export const COMB = { s0: 17, count: 11, tooth: 0.7, slot: 0.8, floor: -0.45 };
export const COMB_PITCH = COMB.tooth + COMB.slot;
export const SLIT = 0.06;              // mm, the slit at rest
export const BREATHER = { s: 9.9, r: 0.55 };
export const NIB_FREE = 14.5;          // the nib bends as a cantilever over this length
export const TIP = { s: 0.5, r: 0.5 }; // the tipping ball
export const CURL = 0.5;               // how far the tines curl toward the paper at the tip

// The air tunnel runs inside the feed from under the breather hole to the pin; the ink lumen runs beside it in the pin.
export const AIR = { s0: 9.4, s1: 52, t0: -2.35, t1: -1.15 };
export const INK_LUMEN = { s0: S_JOINT, s1: 52, t0: 0.4, t1: 1.1 };
export const PORT = { s0: 9.4, s1: 10.4 };
export const PIN_END = 52;

// Cartridge.
export const CARTRIDGE = { s0: 47.5, plug: 50, nose: 51.8, s1: 80.6, wall: 0.35, r: 4.0 };
export const CART_IN = CART.inner;
export const C_IN0 = 50, C_IN1 = 80.25;

export function nibWidth(s) {
  const u = Math.min(1, Math.max(0, s / 10));
  const ease = u * u * (3 - 2 * u);
  return 0.55 + (3.0 - 0.55) * ease;
}

// Bend of the nib as a cantilever clamped at the grip: lift (mm at the tip) falls off as the square of the distance to the clamp.
export const bendAt = (s, lift) => (s >= NIB_FREE ? 0 : lift * Math.pow((NIB_FREE - s) / NIB_FREE, 2));
export const curlAt = (s) => (s >= 4 ? 0 : -CURL * Math.pow(1 - s / 4, 2));

// The pen frame, placed so that the tipping's lowest point is at `contact` (world) when the nib carries no load.
export function penFrame(contact) {
  const ax = AX, nm = NM, sin = SIN, cos = COS;
  const centre = { s: TIP.s, t: NIB_UNDER + curlAt(TIP.s) - 0.15 };
  const sC = centre.s - TIP.r * sin;
  const tC = centre.t - TIP.r * cos;
  const w = (s, t, y = 0) => [
    contact[0] + ((s - sC) * ax[0] + (t - tC) * nm[0]) * U,
    contact[1] + y * U,
    contact[2] + ((s - sC) * ax[2] + (t - tC) * nm[2]) * U,
  ];
  return { w, sC, tC, centre };
}

// The world height of a point in the pen frame, in the same units as the frame.
export const upOf = (s, t) => s * AX[2] + t * NM[2];

// Polygon helpers ---------------------------------------------------------------------------------

export function arc(cs, ct, r, a0, a1, n = 10) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cs + r * Math.cos(a), ct + r * Math.sin(a)];
  });
}
export const rect = (s0, s1, t0, t1) => [[s0, t0], [s1, t0], [s1, t1], [s0, t1]];
export const mirrorT = (pts) => pts.map(([s, t]) => [s, -t]);

// Keep the part of a polygon below a horizontal plane (upOf <= level). Sutherland-Hodgman against one half-plane.
export function clipBelow(poly, level) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const fa = level - upOf(a[0], a[1]);
    const fb = level - upOf(b[0], b[1]);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const k = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    }
  }
  return out;
}
// The part above the plane: the air pocket above the ink.
export function clipAbove(poly, level) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const fa = upOf(a[0], a[1]) - level;
    const fb = upOf(b[0], b[1]) - level;
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const k = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    }
  }
  return out;
}
export function area(poly) {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [s0, t0] = poly[i];
    const [s1, t1] = poly[(i + 1) % poly.length];
    sum += s0 * t1 - s1 * t0;
  }
  return Math.abs(sum) / 2;
}

// Outer profile of the shell, for the turned parts and the cut walls.
export const flareR = (s) => 4.0 + (R_GRIP - 4.0) * Math.sin((Math.PI / 2) * Math.min(1, Math.max(0, (s - S_FRONT) / (S_FLARE - S_FRONT))));
export const flareSlope = (s) => (s >= S_FLARE ? 0 : (R_GRIP - 4.0) * (Math.PI / 2 / (S_FLARE - S_FRONT)) * Math.cos((Math.PI / 2) * ((s - S_FRONT) / (S_FLARE - S_FRONT))));
export const capR = (s) => R_BAR * Math.sqrt(Math.max(0, 1 - Math.pow((s - S_CAP) / (LEN - S_CAP), 2)));
export const capSlope = (s) => {
  const u = (s - S_CAP) / (LEN - S_CAP);
  return -R_BAR * u / ((LEN - S_CAP) * Math.sqrt(Math.max(1e-3, 1 - u * u)));
};
export const boreR = (s) => (s < 36.5 ? R_NIB : s < S_JOINT ? 3.8 : 3.0);

// Static cut material ----------------------------------------------------------------------------

// Walls of the grip (the "section"), upper half; the lower half is its mirror image.
export function gripWall() {
  const outer = [];
  for (let i = 0; i <= 24; i++) {
    const s = S_FRONT + ((S_FLARE - S_FRONT) * i) / 24;
    outer.push([s, flareR(s)]);
  }
  outer.push([S_JOINT, R_GRIP]);
  return [
    [S_FRONT, R_NIB],
    ...outer,
    [S_JOINT, 4.5],
    [47, 4.5],
    [47, 3.0],
    [S_JOINT, 3.0],
    [S_JOINT, 3.8],
    [36.5, 3.8],
    [36.5, R_NIB],
  ];
}

export function barrelWall() {
  return [
    [S_JOINT, R_BAR_IN],
    [S_JOINT, R_RING],
    [S_RING, R_RING],
    [S_RING, R_BAR],
    [S_CAP, R_BAR],
    [S_CAP, R_BAR_IN],
  ];
}

export function endCap() {
  const upper = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const s = S_CAP + ((LEN - S_CAP) * i) / n;
    upper.push([s, capR(s)]);
  }
  return [...mirrorT(upper.slice().reverse()), ...upper.slice(0, -1)];
}

// Thread teeth where the grip's spigot meets the barrel.
export function threads() {
  const out = [];
  for (const sign of [1, -1]) {
    const pts = [];
    pts.push([S_JOINT, sign * 4.5]);
    for (let s = 43.2; s < 46.5; s += 0.6) {
      pts.push([s, sign * 4.5]);
      pts.push([s + 0.3, sign * 4.82]);
    }
    pts.push([47, sign * 4.5]);
    out.push(pts);
  }
  return out;
}

// The feed and its collector, with the comb on top and the pin at the rear.
export function feedShape() {
  const run = [];
  run.push([COMB.s0, FEED_TOP]);
  for (let i = 0; i < COMB.count - 1; i++) {
    const a = COMB.s0 + i * COMB_PITCH;
    run.push([a + COMB.tooth, FEED_TOP], [a + COMB.tooth, COMB.floor], [a + COMB_PITCH, COMB.floor], [a + COMB_PITCH, FEED_TOP]);
  }
  run.push([COMB.s0 + (COMB.count - 1) * COMB_PITCH + COMB.tooth, FEED_TOP]);
  return [
    [4.0, 1.4],
    [4.0, FEED_TOP - 0.5],
    [4.15, FEED_TOP - 0.15],
    [4.5, FEED_TOP],
    ...run,
    [36.5, FEED_TOP],
    [36.5, 0.35],
    [S_JOINT, 0.35],
    [S_JOINT, 3.0],
    [47, 3.0],
    [47, 1.4],
    [PIN_END, 1.4],
    [PIN_END, -1.4],
    [47, -1.4],
    [47, -3.0],
    [S_JOINT, -3.0],
    [S_JOINT, -3.8],
    [36.5, -3.8],
    [36.5, -R_NIB],
    [14, -R_NIB],
    [8.5, -2.4],
    [4.0, -1.0],
  ];
}

// Comb slots, each a thin pocket that holds ink between the teeth.
export function slots() {
  return Array.from({ length: COMB.count - 1 }, (_, i) => {
    const a = COMB.s0 + i * COMB_PITCH + COMB.tooth;
    return rect(a, a + COMB.slot, COMB.floor, FEED_TOP);
  });
}

// Voids in the feed: the air tunnel (with the port to the breather hole) and the pin's ink lumen.
export function airTunnel() {
  // Drilled low in the feed, then angled up into the lower lumen of the pin.
  return [
    [PORT.s0, FEED_TOP],
    [PORT.s0, AIR.t0],
    [S_JOINT, AIR.t0],
    [47, -1.3],
    [PIN_END, -1.3],
    [PIN_END, -0.4],
    [47, -0.4],
    [S_JOINT, AIR.t1],
    [PORT.s1, AIR.t1],
    [PORT.s1, FEED_TOP],
  ];
}
export const inkLumen = () => rect(INK_LUMEN.s0, INK_LUMEN.s1, INK_LUMEN.t0, INK_LUMEN.t1);

// The collector chamber: the pocket at the foot of the nib where the pin's ink lumen opens.
export const collector = () => rect(36.5, S_JOINT, 0.35, 3.8);

// Cartridge ----------------------------------------------------------------------------------------

export function cartridgeShell() {
  const { plug, nose, s1, r } = CARTRIDGE;
  return [[plug, -2.4], [nose, -r], [s1, -r], [s1, r], [nose, r], [plug, 2.4]];
}
export function cartridgeInterior() {
  return [[C_IN0, -2.05], [51.6, -3.65], [C_IN1, -3.65], [C_IN1, 3.65], [51.6, 3.65], [C_IN0, 2.05]];
}
export const plug = () => rect(CARTRIDGE.s0, CARTRIDGE.plug, -2.05, 2.05);

// Ink volume (uL) in the cartridge when the free surface stands at world level `level` (pen-frame units, see upOf).
export function inkVolume(level) {
  let sum = 0;
  const n = 120;
  const r = CART_IN;
  for (let i = 0; i < n; i++) {
    const s = C_IN0 + 1.6 + ((C_IN1 - C_IN0 - 1.6) * (i + 0.5)) / n;
    const h = Math.max(-r, Math.min(r, (level - s * AX[2]) / NM[2]));
    sum += (r * r * (Math.PI / 2 + Math.asin(h / r)) + h * Math.sqrt(Math.max(0, r * r - h * h))) * ((C_IN1 - C_IN0 - 1.6) / n);
  }
  return sum;
}
// The level at which the cartridge holds `volume` uL of ink.
export function levelFor(volume) {
  let lo = -10, hi = 90;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (inkVolume(mid) < volume) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Where a bubble travels: down through the breather hole, back along the air tunnel, out of the pin, up through the ink to the air pocket.
// Returns a polyline of pen-frame points; `inkTop` is the free surface level, so the last leg ends where the bubble joins the air.
export function bubblePath(level) {
  const mid = (AIR.t0 + AIR.t1) / 2;
  const pts = [[BREATHER.s, 3.7], [BREATHER.s, 2.9], [BREATHER.s, mid], [S_JOINT, mid], [47, -0.85], [PIN_END, -0.85]];
  // Out of the pin tip, the bubble rises in the world's up direction until it meets the wall, then slides back along it.
  const [s0, t0] = pts[pts.length - 1];
  const wall = 3.4;
  const rise = (wall - t0) / NM[2];
  const sHit = s0 + rise * AX[2];
  pts.push([s0 + 0.6, t0 + 0.4]);
  pts.push([sHit, wall]);
  // Stop at the surface: walk along the wall until the level is reached.
  let sEnd = sHit;
  for (let s = sHit; s <= C_IN1 - 0.8; s += 0.25) {
    sEnd = s;
    if (upOf(s, wall) >= level) break;
  }
  pts.push([Math.max(sHit, sEnd), wall]);
  return pts;
}

// Nib -------------------------------------------------------------------------------------------------

const TOP_R = 3.2;
const UNDER_R = 2.7;
const holeEdge = (s) => {
  const d = Math.abs(s - BREATHER.s);
  return d >= BREATHER.r ? 0 : Math.sqrt(BREATHER.r * BREATHER.r - d * d);
};
const smooth = (u) => u * u * (3 - 2 * u);
export const S_PLATE = BREATHER.s + BREATHER.r;      // the nib is cut material from here back
export const S_PLATE_END = 36.5;
const lerp = (a, b, k) => a + (b - a) * k;

// The tines open about the breather hole like a pair of levers: the slit is widest at the tip.
const shiftAt = (s, spread) => (spread / 2) * Math.max(0, 1 - s / S_PLATE);

// The far tine seen past the cut plane: strips of the nib's arch from the slit edge outward, each with its own tone.
// A point is [s, t, y] in the pen frame. The arch turns away from the viewer, so only its near part shows.
export function nibGeometry(spread, lift) {
  const samples = [];
  for (let s = 0.15; s < S_PLATE; s += s < 4 ? 0.3 : 0.5) samples.push(s);
  samples.push(S_PLATE);
  const edges = [0, 0.38, 0.8, 1.3, 2.0];
  const point = (s, eta, wide) => {
    const rest = SLIT / 2 + Math.min(eta, wide);
    const t = Math.sqrt(Math.max(0, TOP_R * TOP_R - rest * rest)) + curlAt(s) + bendAt(s, lift);
    const y = -(shiftAt(s, spread) + Math.max(rest, holeEdge(s)));
    return [s, t, y];
  };
  const width = (s) => Math.min(nibWidth(s), 2.0);
  const strips = [];
  for (let k = 0; k < edges.length - 1; k++) {
    const a = samples.map((s) => point(s, (edges[k] / 2) * (width(s) / 1) * 1, width(s)));
    void a;
    const near = samples.map((s) => point(s, edges[k] * (width(s) / 2.0), width(s)));
    const far = samples.map((s) => point(s, edges[k + 1] * (width(s) / 2.0), width(s))).reverse();
    strips.push({ tone: 3 - k, pts: [...near, ...far] });
  }
  const slitEdge = samples.map((s) => point(s, 0, width(s)));
  const outerEdge = samples.map((s) => point(s, 2.0 * (width(s) / 2.0), width(s)));
  const outline = [...slitEdge, ...outerEdge.slice().reverse()];
  const plate = { under: [], top: [] };
  for (let s = S_PLATE; s <= S_PLATE_END + 1e-6; s += (S_PLATE_END - S_PLATE) / 26) {
    plate.under.push([s, NIB_UNDER + bendAt(s, lift)]);
    plate.top.push([s, NIB_TOP + bendAt(s, lift)]);
  }
  const tip = [TIP.s, NIB_UNDER + curlAt(TIP.s) + bendAt(TIP.s, lift) - 0.15];
  return { strips, outline, slitEdge, plate, tip };
}

// The whole nib turned about its own axis by `roll`, so its top faces the viewer: both tines, the slit and the breather hole.
// Strips carry the pen-frame normal of the arch they lie on, rotated the same way, so the caller can shade them.
export function nibFace(roll) {
  const c = Math.cos(roll);
  const sn = Math.sin(roll);
  const rot = ([s, t, y]) => [s, t * c - y * sn, y * c + t * sn];
  const gap = 0.09;
  const rows = [];
  for (let s = 0.15; s < S_PLATE_END; s += s < 12 ? 0.35 : 1.6) rows.push(s);
  rows.push(S_PLATE_END);
  const half = (s) => (s > 12 ? 3.0 : nibWidth(s));
  const at = (s, sgn, k) => {
    const rest = gap + k * (half(s) - gap);
    const t = Math.sqrt(Math.max(0, TOP_R * TOP_R - rest * rest)) + curlAt(s);
    const y = sgn * Math.max(rest, s > BREATHER.s - BREATHER.r && s < BREATHER.s + BREATHER.r ? gap + holeEdge(s) : 0);
    return { p: rot([s, t, y]), n: rot([0, t / TOP_R, (sgn * rest) / TOP_R]) };
  };
  const cuts = [0, 0.3, 0.55, 0.78, 1];
  const strips = [];
  for (const sgn of [-1, 1]) {
    for (let i = 0; i < cuts.length - 1; i++) {
      const near = rows.map((s) => at(s, sgn, cuts[i]));
      const far = rows.map((s) => at(s, sgn, cuts[i + 1])).reverse();
      const mid = at(rows[Math.floor(rows.length / 3)], sgn, (cuts[i] + cuts[i + 1]) / 2);
      strips.push({ pts: [...near, ...far].map((q) => q.p), normal: mid.n });
    }
  }
  const outerSide = (sgn) => rows.map((s) => at(s, sgn, 1).p);
  const outline = [...outerSide(-1), ...outerSide(1).reverse()];
  const hole = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    const y = BREATHER.r * Math.sin(a);
    return rot([BREATHER.s + BREATHER.r * Math.cos(a), Math.sqrt(TOP_R * TOP_R - y * y), y]);
  });
  const slit = [...rows.filter((s) => s < BREATHER.s).map((s) => at(s, -1, 0).p), ...rows.filter((s) => s < BREATHER.s).reverse().map((s) => at(s, 1, 0).p)];
  const tips = [-1, 1].map((sgn) => Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const y = sgn * (gap + 0.4) + TIP.r * 0.8 * Math.sin(a);
    return rot([TIP.s + TIP.r * 0.8 * Math.cos(a), Math.sqrt(Math.max(0, TOP_R * TOP_R - y * y)) + curlAt(TIP.s) - 0.1, y]);
  }));
  const shoulders = [-1, 1].map((sgn) => rows.filter((s) => s > 6 && s < 14).map((s) => at(s, sgn, 1).p));
  return { strips, outline, hole, slit, tips, shoulders };
}

// The ink that fills the gap under the nib from `front` (mm from the tip) back to the collector.
export function channelInk(front, lift) {
  const under = (s) => NIB_UNDER + curlAt(s) + bendAt(s, lift);
  const lower = (s) => (s < 4 ? under(s) - 0.45 : FEED_TOP);
  const up = [];
  const down = [];
  for (let s = Math.max(0.5, front); s <= S_PLATE_END; s += s < 12 ? 0.35 : 1.5) {
    up.push([s, under(s)]);
    down.push([s, lower(s)]);
  }
  up.push([S_PLATE_END, under(S_PLATE_END)]);
  down.push([S_PLATE_END, lower(S_PLATE_END)]);
  if (up.length < 2) return [];
  return [...up, ...down.reverse()];
}

// Ink standing in comb slot i, filled to `frac` of the slot's height measured along the world's vertical.
export function slotInk(i, frac) {
  const slot = slots()[i];
  const lows = slot.map(([s, t]) => upOf(s, t));
  const lo = Math.min(...lows);
  const hi = Math.max(...lows);
  return clipBelow(slot, lo + (hi - lo) * Math.max(0, Math.min(1, frac)));
}

// Ink in the cartridge, below the free surface.
export const cartInk = (level) => clipBelow(cartridgeInterior(), level);

// The route ink takes: out of the pin, into the collector, then forward along the channel under the nib.
export const FLOW_PATH = [[51, 0.75], [S_JOINT + 0.5, 0.75], [38.2, 1.9], [35.5, FEED_TOP + 0.225], [5, FEED_TOP + 0.225]];
