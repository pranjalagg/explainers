// Helpers used both when the page is built and while it runs. Names from the kit (iso, depthOf) are global in the page,
// where the kit is inlined, and imported here, so this file is inlined with its imports and exports removed.
import { iso, depthOf, solidSvg, cylinder } from "../kit/iso-kit.mjs";
import { frameOf, prismOf, viewOf, lightOf, bandOf, dot3, unit3 } from "../kit/lathe.mjs";

const r1 = (v) => Math.round(v * 10) / 10;
const pathOfPoints = (points) => points.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join("");

// A coil spring standing on the z axis at (cx, cy), seen from the camera. `radius` and `lateral` are functions of the
// share t (0 at z0, 1 at z1): a cone has a radius that shrinks, a buckled spring has a centreline that bows sideways.
// Returns the half nearer the camera and the half further away, so the caller can paint back, then the part inside, then front.
export function vcoil(cx, cy, z0, z1, radius, turns, P, { perTurn = 22, lateral = null, phase = 0 } = {}) {
  const count = Math.max(2, Math.round(turns * perTurn));
  const back = [];
  const front = [];
  let run = [];
  let near = null;
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const a = phase + t * turns * Math.PI * 2;
    const r = typeof radius === "function" ? radius(t) : radius;
    const off = lateral ? lateral(t) : [0, 0];
    const flat = iso([cx + off[0] + r * Math.cos(a), cy + off[1] + r * Math.sin(a), z0 + (z1 - z0) * t], P);
    const facing = depthOf([Math.cos(a), Math.sin(a), 0], P) > 0;
    if (near === null) near = facing;
    if (facing !== near) {
      run.push(flat);
      (near ? front : back).push(pathOfPoints(run));
      run = [flat];
      near = facing;
      continue;
    }
    run.push(flat);
  }
  if (run.length > 1) (near ? front : back).push(pathOfPoints(run));
  return { back: back.join(""), front: front.join("") };
}

// ---------- the buckling spring's hammer ----------
// A flat plate that rocks about a pin along x at (pivotY, pivotZ). alpha lifts its front end. The spring seat is a small boss
// on top, one third of the way along from the pin.
const FXH = frameOf([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const SEAT_AT = 24;
export function hammerSvg(P, alpha, b) {
  const c = Math.cos(alpha), s = Math.sin(alpha);
  const rot = ([u, v]) => [b.pivotY + u * c - v * s, b.pivotZ + u * s + v * c];
  const plate = solidSvg(prismOf(FXH, [[-6, -2], [52, -2], [52, 2], [-6, 2]].map(rot), -12, 12, P), { tone: "hi" });
  const seat = rot([SEAT_AT, 2]);
  const nub = solidSvg(cylinder(0, seat[0], 7.5, seat[1], 2, P, 24), { tone: "hi" });
  return plate + nub;
}
export const seatTop = (alpha, b) => b.pivotZ + SEAT_AT * Math.sin(alpha) + 2 * Math.cos(alpha) + 2;

// ---------- a rubber dome, cut through its middle ----------
// A shell of revolution about the z axis, kept only on the back half (y <= 0), so the inside can be seen. ro(s) is the outer
// radius at height share s (0 at the foot, 1 at the apex), wall is its thickness, H its height. The inner surface is shaded
// by the way it faces, the two cut faces are the lightest tone, and the outer surface shows only as a sliver at the limb.
export function domeShell(P, z0, H, ro, wall, { rows = 22, around = 26 } = {}) {
  const V = viewOf(P), L = lightOf(P);
  const sIn = 1 - wall / H;
  const ri = (s) => (s < sIn ? Math.max(0.5, ro(s) - wall) : 0);
  const zAt = (s) => z0 + H * s;
  const dr = (f, s) => (f(Math.min(1, s + 1e-3)) - f(Math.max(0, s - 1e-3))) / (2e-3 * H);
  const buckets = [[], [], [], [], []];
  const all = [];
  const pt = (r, a, s) => iso([r * Math.cos(a), r * Math.sin(a), zAt(s)], P);
  // Every polygon is wound the same way, so overlapping pieces of one tone never cancel into a hole.
  const poly = (pts) => {
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; area += x0 * y1 - x1 * y0; }
    const list = area < 0 ? [...pts].reverse() : pts;
    return `M${list.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L")}Z`;
  };
  const place = (pts, normal, bucket = null) => {
    const d = poly(pts);
    all.push(d);
    buckets[bucket ?? bandOf(dot3(unit3(normal), L))].push(d);
  };
  const as = Array.from({ length: around + 1 }, (_, j) => Math.PI + (Math.PI * j) / around);
  const ss = Array.from({ length: rows + 1 }, (_, i) => i / rows);
  // inner surface
  for (let i = 0; i < rows; i++) {
    const sA = ss[i], sB = ss[i + 1];
    if (sB > sIn + 1e-6) break;
    for (let j = 0; j < around; j++) {
      const a = as[j], b = as[j + 1], m = (a + b) / 2, sm = (sA + sB) / 2;
      const slope = dr(ri, sm);
      const n = [-Math.cos(m), -Math.sin(m), slope];
      if (dot3(n, V) <= 0) continue;
      place([pt(ri(sA), a, sA), pt(ri(sA), b, sA), pt(ri(sB), b, sB), pt(ri(sB), a, sB)], n);
    }
  }
  // the ceiling of the inner cavity does not face the viewer; the cut faces do
  for (const [sign, a] of [[-1, Math.PI], [1, 2 * Math.PI]]) {
    for (let i = 0; i < rows; i++) {
      const sA = ss[i], sB = ss[i + 1];
      const q = [[ri(sA), sA], [ro(sA), sA], [ro(sB), sB], [ri(sB), sB]].map(([r, s]) => iso([sign * r, 0, zAt(s)], P));
      place(q, [0, 1, 0], 4); // the lightest tone marks a cut face
    }
  }
  // the outer sliver near the right limb, and the top of the apex
  for (let i = 0; i < rows; i++) {
    const sA = ss[i], sB = ss[i + 1];
    for (let j = 0; j < around; j++) {
      const a = as[j], b = as[j + 1], m = (a + b) / 2, sm = (sA + sB) / 2;
      const n = [Math.cos(m), Math.sin(m), -dr(ro, sm)];
      if (dot3(n, V) <= 0) continue;
      place([pt(ro(sA), a, sA), pt(ro(sA), b, sA), pt(ro(sB), b, sB), pt(ro(sB), a, sB)], n);
    }
  }
  const apex = ro(1);
  place(as.map((a) => pt(apex, a, 1)).concat([pt(0, 0, 1)]), [0, 0, 1]);
  // outline: both profile edges of the cut, the apex arc, the base arcs
  const edge = (sign, f) => ss.map((s) => iso([sign * f(s), 0, zAt(s)], P));
  const line = (pts) => pts.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join("");
  const outline = [
    line(edge(-1, ro)), line(edge(1, ro)),
    line(as.map((a) => pt(apex, a, 1))),
    line(as.map((a) => pt(ri(0), a, 0))), line(as.map((a) => pt(ro(0), a, 0))),
    line([iso([-ro(0), 0, z0], P), iso([-ri(0), 0, z0], P)]), line([iso([ro(0), 0, z0], P), iso([ri(0), 0, z0], P)]),
  ].join("");
  return { fill: all.join(""), outline, crease: "", top: buckets[4].join(""), shades: buckets.slice(0, 4).map((l) => l.join("")), seamless: true };
}

// ---------- the Topre dome ----------
export const DOME = { H0: 46, base: 27, apex: 10, wall: 3, foot: 1.8 };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// The dome for a key travel of x mm: the apex follows the slider down and, once the dome passes its peak, the walls bulge out.
export function domeAt(x, unit) {
  const H = DOME.H0 - unit * x;
  const bulge = 0.5 * sstep(1.1, 2.4, x);
  const ro = (s) => (DOME.apex + (DOME.base - DOME.apex) * (1 - s) ** 1.35) * (1 + bulge * Math.sin(Math.PI * s) ** 0.9);
  return { H, ro, spring: { z0: DOME.foot, z1: H - 3, r: (t) => 16 - 11 * t, turns: 6 } };
}
