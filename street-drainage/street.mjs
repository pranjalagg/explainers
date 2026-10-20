// The street block: every surface and section that depends on the cross slope and the grade.
// Pure string building on the kit (passed in as K), so the build and the page share one source:
// the build draws it once at the default slopes, the page redraws it when a slope slider moves.

// World units: 40 per metre along the floor and underground. Heights at the street surface
// (slopes, curb, water depth) are drawn at 100 per metre, 2.5× taller than built, so they can be seen.
export const GEO = {
  H: 40,
  V: 100,
  L: 240, // 6 m of street
  XIN: 180, // the curb opening runs from here to the cut face
  YB: -66, // back of the sidewalk
  YF: 144, // the front cut, 3.6 m from the curb, along the storm main
  CURB_T: 6, // curb top width
  PAN: 24, // gutter pan width (0.6 m)
  CURB: 15, // curb face, 0.15 m drawn ×2.5
  DROP: 3.8, // pan depression, 0.038 m drawn ×2.5
  WALK: 0.02, // sidewalk cross slope toward the street
  LANE: 120, // edge of the traffic lane (3.0 m)
  B: -84, // bottom of the block
  ASPH: 4,
  BASE: 12,
  ch: { x0: 166, y0: -46, y1: -6, z0: -55, z1: -4, wall: 6, lintel: 4, sump: 12 },
  lat: { r: 6, wall: 2, slope: 0.02 },
  main: { y: 144, z: -66, r: 9, wall: 3 },
  mh: { x: 60, r: 24, wall: 6, neck: 12, cone: 22 },
};

export function surfaceOf(Sx, SL, g = GEO) {
  const up = (x) => ((g.L - x) / g.H) * SL * g.V;
  const flow = (x) => up(x) - g.CURB;
  const lip = (x) => flow(x) + (g.PAN / g.H) * Sx * g.V + g.DROP;
  const z = (x, y) => {
    if (y <= -g.CURB_T) return up(x) + ((-g.CURB_T - y) / g.H) * g.WALK * g.V;
    if (y < 0) return up(x);
    if (y <= g.PAN) return flow(x) + (y / g.PAN) * (lip(x) - flow(x));
    return lip(x) + ((y - g.PAN) / g.H) * Sx * g.V;
  };
  return { up, flow, lip, z };
}

// Lateral centreline in the cut plane, (y, z): out of the chamber, down at 2 %, then a 45° drop into the main.
export function lateralOf(g = GEO) {
  const { ch, lat, main } = g;
  const z0 = ch.z0 + ch.sump + lat.r; // invert sits a sump above the floor
  const yBend = main.y - 30;
  const zBend = z0 - lat.slope * g.H * ((yBend - ch.y1) / g.H);
  const ro = main.r + main.wall;
  const into = [main.y - main.r * Math.SQRT1_2, main.z + main.r * Math.SQRT1_2];
  return { z0, pts: [[ch.y1, z0], [yBend, zBend], into], invert: z0 - lat.r };
}

// A polyline offset sideways by d, mitred at its corners.
export const offsetLine = (pts, d) => pts.map(([y, z], i) => {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
  const ty = b[0] - a[0], tz = b[1] - a[1], m = Math.hypot(ty, tz);
  let ny = -tz / m, nz = ty / m;
  if (i > 0 && i < pts.length - 1) {
    const t1 = [pts[i][0] - a[0], pts[i][1] - a[1]], t2 = [b[0] - pts[i][0], b[1] - pts[i][1]];
    const n1 = [-t1[1] / Math.hypot(...t1), t1[0] / Math.hypot(...t1)], n2 = [-t2[1] / Math.hypot(...t2), t2[0] / Math.hypot(...t2)];
    const mm = [n1[0] + n2[0], n1[1] + n2[1]], ml = Math.hypot(...mm), c = (mm[0] * n1[0] + mm[1] * n1[1]) / ml;
    ny = mm[0] / ml / c; nz = mm[1] / ml / c;
  }
  return [y + ny * d, z + nz * d];
});

// The chamber and throat void in the end section, (y, z).
export function voidOf(Sx, SL, g = GEO) {
  const S = surfaceOf(Sx, SL, g);
  const { ch } = g;
  return [[ch.y0, S.up(g.L) - ch.lintel], [0, S.up(g.L) - ch.lintel], [0, S.flow(g.L)], [ch.y1, S.flow(g.L)], [ch.y1, ch.z0], [ch.y0, ch.z0]];
}

export function blockSvg(K, P, Sx, SL, g = GEO) {
  const S = surfaceOf(Sx, SL, g);
  const at = (p) => K.iso(p, P);
  const poly = (pts, cls, extra = "") => `<path class="${cls}" d="${K.pathOf(pts.map(at), true)}"${extra}/>`;
  const line = (pts, tone = "faint", extra = {}) => K.lineSvg(K.pathOf(pts.map(at)), { tone, ...extra });
  const XE = g.L;
  const xs = (n = 12) => Array.from({ length: n + 1 }, (_, i) => (g.L * i) / n);
  const out = [];

  // ---- tops, back to front
  const walk = [[0, g.YB, S.z(0, g.YB)], [XE, g.YB, S.z(XE, g.YB)], [XE, -g.CURB_T, S.z(XE, -g.CURB_T)], [0, -g.CURB_T, S.z(0, -g.CURB_T)]];
  out.push(poly(walk, "sd-top sd-concrete-top"));
  for (const x of [30, 90, 150, 210]) out.push(line([[x, g.YB, S.z(x, g.YB)], [x, -g.CURB_T, S.z(x, -g.CURB_T)]], "lo"));
  // the inlet's access lid over the chamber
  const lid = { x: 186, y: -40, w: 40, d: 26 };
  const lz = (x, y) => S.z(x, y) + 0.6;
  const lidPts = [[lid.x, lid.y], [lid.x + lid.w, lid.y], [lid.x + lid.w, lid.y + lid.d], [lid.x, lid.y + lid.d]];
  out.push(poly(lidPts.map(([x, y]) => [x, y, lz(x, y)]), "sd-iron"));
  out.push(line([...lidPts, lidPts[0]].map(([x, y]) => [x, y, lz(x, y)]), "mid"));
  const inner = [[lid.x + 2.5, lid.y + 2.5], [lid.x + lid.w - 2.5, lid.y + 2.5], [lid.x + lid.w - 2.5, lid.y + lid.d - 2.5], [lid.x + 2.5, lid.y + lid.d - 2.5]];
  out.push(line([...inner, inner[0]].map(([x, y]) => [x, y, lz(x, y)]), "lo"));
  for (let i = 1; i < 8; i++) {
    const x = lid.x + 2.5 + ((lid.w - 5) * i) / 8;
    out.push(line([[x, lid.y + 2.5, lz(x, lid.y + 2.5)], [x, lid.y + lid.d - 2.5, lz(x, lid.y + lid.d - 2.5)]], "faint"));
  }
  out.push(K.dotsSvg([[lid.x + 6, lid.y + lid.d / 2], [lid.x + lid.w - 6, lid.y + lid.d / 2]].map(([x, y]) => at([x, y, lz(x, y)])), { size: 0.7, tone: "hi" }));
  // the stencil on the sidewalk, the figure's one engraved label
  const tx = 150, ty = -18;
  out.push(K.faceTextSvg(K.topMatrix([tx, ty], S.z(tx, ty), P, "x"), "DRAINS TO RIVER", { size: 3.4, tone: "lo", anchor: "middle" }));

  // curb top and its face
  out.push(poly([[0, -g.CURB_T, S.up(0)], [XE, -g.CURB_T, S.up(XE)], [XE, 0, S.up(XE)], [0, 0, S.up(0)]], "sd-top sd-concrete-top"));
  out.push(line([[0, -g.CURB_T, S.up(0)], [XE, -g.CURB_T, S.up(XE)]], "lo"));
  out.push(poly([[0, 0, S.up(0)], [XE, 0, S.up(XE)], [XE, 0, S.flow(XE)], [0, 0, S.flow(0)]], "sd-face sd-concrete-face"));
  // the curb opening: a throat under a lintel, its floor the gutter flowline
  const lt = g.ch.lintel;
  const throat = [[g.XIN, 0, S.up(g.XIN) - lt], [XE, 0, S.up(XE) - lt], [XE, 0, S.flow(XE)], [g.XIN, 0, S.flow(g.XIN)]];
  out.push(poly(throat, "sd-void"));
  out.push(line([[g.XIN, 0, S.up(g.XIN) - lt + 0.8], [XE, 0, S.up(XE) - lt + 0.8]], "mid"));
  out.push(line([throat[1], throat[0], throat[3]], "mid"), line([throat[0], [g.XIN, 0, S.up(g.XIN)]], "lo"));
  out.push(line([[0, 0, S.up(0)], [XE, 0, S.up(XE)]], "mid"));

  // gutter pan and road
  out.push(poly([[0, 0, S.flow(0)], [XE, 0, S.flow(XE)], [XE, g.PAN, S.lip(XE)], [0, g.PAN, S.lip(0)]], "sd-top sd-pan-top"));
  out.push(poly([[0, g.PAN, S.lip(0)], [XE, g.PAN, S.lip(XE)], [XE, g.YF, S.z(XE, g.YF)], [0, g.YF, S.z(0, g.YF)]], "sd-top sd-road-top"));
  out.push(line([[0, g.PAN, S.lip(0)], [XE, g.PAN, S.lip(XE)]], "lo"));
  out.push(line([[0, 0, S.flow(0)], [XE, 0, S.flow(XE)]], "lo"));
  // pan construction joints, every 3 m
  for (const x of [60, 180]) out.push(line([[x, 0, S.flow(x)], [x, g.PAN, S.lip(x)]], "faint"));
  // lane edge line, painted
  const stripe = [[0, g.LANE - 2], [XE, g.LANE - 2], [XE, g.LANE + 2], [0, g.LANE + 2]].map(([x, y]) => [x, y, S.z(x, y) + 0.05]);
  out.push(poly(stripe, "sd-paint"));
  // manhole frame and cover, cut in half by the front section
  const { mh } = g;
  const half = (r, lift = 0.3, n = 40) => Array.from({ length: n + 1 }, (_, i) => {
    const a = Math.PI + (Math.PI * i) / n;
    const x = mh.x + r * Math.cos(a), y = g.YF + r * Math.sin(a);
    return [x, y, S.z(x, y) + lift];
  });
  out.push(poly(half(mh.neck + 3), "sd-iron"));
  out.push(line(half(mh.neck + 3), "mid"));
  out.push(line(half(mh.neck), "lo"));
  out.push(line(half(mh.neck - 4), "faint"));
  const studs = [];
  for (let ix = -3; ix <= 3; ix++) for (let iy = 1; iy <= 3; iy++) {
    const x = mh.x + ix * 3.2, y = g.YF - iy * 3.2 + 1.2;
    if (Math.hypot(x - mh.x, y - g.YF) < mh.neck - 5.5) studs.push(at([x, y, S.z(x, y) + 0.3]));
  }
  out.push(K.dotsSvg(studs, { size: 0.45, tone: "mid" }));

  // ---- front section, y = YF, in (x, z)
  const F = (x, z) => [x, g.YF, z];
  const fz = (x) => S.z(x, g.YF);
  const topF = xs().map((x) => F(x, fz(x)));
  out.push(poly([...topF, F(XE, g.B), F(0, g.B)], "sd-cut sd-backfill sd-yface"));
  const band = (z0, z1, cls) => poly([...xs().map((x) => F(x, z0(x))), ...xs().reverse().map((x) => F(x, z1(x)))], `sd-cut ${cls} sd-yface`);
  const zMain = g.main.z, ro = g.main.r + g.main.wall, ri = g.main.r;
  out.push(band(() => zMain + ro + 6, () => g.B, "sd-bedding"));
  out.push(band((x) => fz(x) - g.ASPH, (x) => fz(x) - g.ASPH - g.BASE, "sd-base"));
  out.push(band((x) => fz(x), (x) => fz(x) - g.ASPH, "sd-asphalt"));
  // the main, cut along its axis
  const mx0 = mh.x - mh.r, mx1 = mh.x + mh.r;
  out.push(band(() => zMain + ro, () => zMain - ro, "sd-pipe"));
  out.push(poly([F(0, zMain + ri), F(XE, zMain + ri), F(XE, zMain - ri), F(0, zMain - ri)], "sd-cut sd-void"));
  // manhole riser: base slab, walls, cone, neck to the frame
  const coneTop = fz(mh.x) - g.ASPH - 2;
  const coneBot = coneTop - mh.cone;
  out.push(poly([F(mx0 - mh.wall, zMain - ro), F(mx1 + mh.wall, zMain - ro), F(mx1 + mh.wall, g.B), F(mx0 - mh.wall, g.B)], "sd-cut sd-pipe sd-yface"));
  const shaftOuter = [F(mx0 - mh.wall, zMain + ri), F(mx0 - mh.wall, coneBot), F(mh.x - mh.neck - mh.wall, coneTop), F(mh.x - mh.neck - mh.wall, fz(mh.x - mh.neck - mh.wall) - 1.6), F(mh.x + mh.neck + mh.wall, fz(mh.x + mh.neck + mh.wall) - 1.6), F(mh.x + mh.neck + mh.wall, coneTop), F(mx1 + mh.wall, coneBot), F(mx1 + mh.wall, zMain + ri)];
  out.push(poly(shaftOuter, "sd-cut sd-pipe sd-yface"));
  const shaftInner = [F(mx0, zMain + ri), F(mx0, coneBot), F(mh.x - mh.neck, coneTop), F(mh.x - mh.neck, fz(mh.x - mh.neck) - 1.6), F(mh.x + mh.neck, fz(mh.x + mh.neck) - 1.6), F(mh.x + mh.neck, coneTop), F(mx1, coneBot), F(mx1, zMain + ri)];
  out.push(poly(shaftInner, "sd-cut sd-void"));
  // the far half of the shaft, seen inside: steps up the wall and a bench at the bottom
  for (let z = zMain + ri + 8; z < coneBot - 2; z += 9) {
    out.push(line([F(mh.x - 5, z), F(mh.x + 5, z)], "mid"));
    out.push(K.dotsSvg([at(F(mh.x - 5, z)), at(F(mh.x + 5, z))], { size: 0.55, tone: "mid" }));
  }
  // frame and cover in section
  const fw = mh.neck + mh.wall;
  const frame = [F(mh.x - fw, fz(mh.x - fw) + 0.3), F(mh.x + fw, fz(mh.x + fw) + 0.3), F(mh.x + fw, fz(mh.x + fw) - 1.6), F(mh.x - fw, fz(mh.x - fw) - 1.6)];
  out.push(poly(frame, "sd-cut sd-iron"));
  // material joints and the trench, edge to edge
  out.push(line(topF, "mid"));
  out.push(line(xs().map((x) => F(x, fz(x) - g.ASPH)), "lo"));
  out.push(line(xs().map((x) => F(x, fz(x) - g.ASPH - g.BASE)), "faint"));
  out.push(line([F(0, zMain + ro + 6), F(XE, zMain + ro + 6)], "faint"));
  for (const z of [zMain + ro, zMain + ri]) {
    out.push(line([F(0, z), F(mx0 - mh.wall, z)], "lo"));
    out.push(line([F(mx1 + mh.wall, z), F(XE, z)], "lo"));
  }
  for (const z of [zMain - ri, zMain - ro]) out.push(line([F(0, z), F(XE, z)], "lo"));
  // where the main's crown meets the manhole walls
  for (const x of [mx0 - mh.wall, mx1 + mh.wall]) out.push(line([F(x, zMain + ri), F(x, zMain + ro)], "lo"));
  out.push(line([...frame, frame[0]], "mid"));
  for (const x of [18, 150, 210]) out.push(line([F(x, zMain + ro), F(x, zMain + ri)], "faint"), line([F(x, zMain - ri), F(x, zMain - ro)], "faint"));
  out.push(line(shaftOuter.slice(0, 4), "lo"), line(shaftOuter.slice(4), "lo"));
  out.push(line([F(mx0 - mh.wall, zMain + ri), ...shaftInner.slice(0, 3), F(mh.x - mh.neck, fz(mh.x - mh.neck) - 1.6)], "lo"), line([F(mh.x + mh.neck, fz(mh.x + mh.neck) - 1.6), ...shaftInner.slice(5), F(mx1 + mh.wall, zMain + ri)], "lo"));
  out.push(line([F(mx0 - mh.wall, zMain - ro), F(mx0 - mh.wall, g.B)], "lo"), line([F(mx1 + mh.wall, zMain - ro), F(mx1 + mh.wall, g.B)], "lo"));

  // ---- end section, x = L, in (y, z): through the curb opening, the chamber, the lateral and the main
  const E = (y, z) => [XE, y, z];
  const ez = (y) => S.z(XE, y);
  const { ch } = g;
  const prof = [E(g.YB, ez(g.YB)), E(-g.CURB_T, ez(-g.CURB_T)), E(0, S.up(XE)), E(0, S.flow(XE)), E(g.PAN, S.lip(XE)), E(g.YF, ez(g.YF))];
  out.push(poly([...prof, E(g.YF, g.B), E(g.YB, g.B)], "sd-cut sd-soil sd-xface"));
  const eband = (y0, y1, z0, z1, cls) => poly([E(y0, z0(y0)), E(y1, z0(y1)), E(y1, z1(y1)), E(y0, z1(y0))], `sd-cut ${cls} sd-xface`);
  // trench around the main, base course, asphalt, gutter and curb concrete, sidewalk
  out.push(poly([E(g.main.y - 26, ez(g.main.y - 26) - g.ASPH - g.BASE), E(g.YF, ez(g.YF) - g.ASPH - g.BASE), E(g.YF, g.B), E(g.main.y - 26, g.B)], "sd-cut sd-backfill sd-xface"));
  out.push(poly([E(g.main.y - 26, zMain + ro + 6), E(g.YF, zMain + ro + 6), E(g.YF, g.B), E(g.main.y - 26, g.B)], "sd-cut sd-bedding sd-xface"));
  // base course: under the road and on under the gutter, up to the chamber wall
  out.push(poly([E(0, ez(0) - g.ASPH - g.BASE), E(g.YF, ez(g.YF) - g.ASPH - g.BASE), E(g.YF, ez(g.YF) - g.ASPH), E(0, S.flow(XE))], "sd-cut sd-base sd-xface"));
  out.push(eband(g.PAN, g.YF, (y) => ez(y), (y) => ez(y) - g.ASPH, "sd-asphalt"));
  out.push(eband(g.YB, -g.CURB_T, (y) => ez(y) - 4, (y) => ez(y) - 9, "sd-base"));
  const gutBot = S.flow(XE) - 9;
  const box = { y0: ch.y0 - ch.wall, y1: 0, z0: ch.z0 - ch.wall };
  out.push(poly([E(g.YB, ez(g.YB)), E(-g.CURB_T, ez(-g.CURB_T)), E(0, S.up(XE)), E(0, S.flow(XE)), E(g.PAN, S.lip(XE)), E(g.PAN + 4, S.lip(XE) - 2), E(g.PAN + 4, gutBot), E(0, gutBot), E(0, box.z0), E(box.y0, box.z0), E(box.y0, ez(box.y0) - 4), E(g.YB, ez(g.YB) - 4)], "sd-cut sd-concrete sd-xface"));
  // chamber and throat: one void, open to the street
  const voidPts = voidOf(Sx, SL, g).map(([y, z]) => E(y, z));
  out.push(poly(voidPts, "sd-cut sd-void", ` data-window`));
  // lateral, cut along its axis
  const LAT = lateralOf(g);
  const off = offsetLine;
  const rO = g.lat.r + g.lat.wall, rI = g.lat.r;
  const strip = (d0, d1, cls) => poly([...off(LAT.pts, d0), ...off(LAT.pts, d1).reverse()].map(([y, z]) => E(y, z)), `sd-cut ${cls} sd-xface`);
  out.push(strip(rO, -rO, "sd-pipe"));
  out.push(strip(rI, -rI, "sd-void"));
  out.push(line(off(LAT.pts, rO).map(([y, z]) => E(y, z)), "lo"), line(off(LAT.pts, -rO).map(([y, z]) => E(y, z)), "lo"));
  out.push(line(off(LAT.pts, rI).map(([y, z]) => E(y, z)), "faint"), line(off(LAT.pts, -rI).map(([y, z]) => E(y, z)), "faint"));
  // the main, half of it
  const arc = (r, a0, a1, n = 36) => Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return E(g.main.y + r * Math.cos(a), zMain + r * Math.sin(a));
  });
  out.push(poly(arc(ro, Math.PI / 2, (3 * Math.PI) / 2), "sd-cut sd-pipe sd-xface"));
  out.push(poly(arc(ri, Math.PI / 2, (3 * Math.PI) / 2), "sd-cut sd-void"));
  // edges in the end section
  out.push(line(prof.slice(0, 3), "mid"), line([E(0, S.up(XE)), E(0, S.up(XE) - ch.lintel)], "mid"), line(prof.slice(3), "mid"));
  out.push(line([E(g.PAN + 4, ez(g.PAN + 4) - g.ASPH), E(g.YF, ez(g.YF) - g.ASPH)], "lo"));
  out.push(line([E(0, ez(0) - g.ASPH - g.BASE), E(g.YF, ez(g.YF) - g.ASPH - g.BASE)], "faint"));
  out.push(line([E(g.YB, ez(g.YB) - 4), E(box.y0, ez(box.y0) - 4)], "lo"));
  out.push(line([E(g.YB, ez(g.YB) - 9), E(box.y0, ez(box.y0) - 9)], "faint"));
  out.push(line([E(g.PAN, S.lip(XE)), E(g.PAN + 4, S.lip(XE) - 2), E(g.PAN + 4, gutBot), E(0, gutBot), E(0, box.z0), E(box.y0, box.z0), E(box.y0, ez(box.y0) - 4)], "lo"));
  out.push(line([...voidPts, voidPts[0]], "lo"));
  out.push(line(arc(ro, Math.PI / 2, (3 * Math.PI) / 2), "lo"), line(arc(ri, Math.PI / 2, (3 * Math.PI) / 2), "lo"));
  out.push(line([E(g.main.y - 26, ez(g.main.y - 26) - g.ASPH - g.BASE), E(g.main.y - 26, g.B)], "faint"));
  out.push(line([E(g.main.y - 26, zMain + ro + 6), E(g.YF, zMain + ro + 6)], "faint"));
  // block silhouette
  out.push(line([E(g.YB, ez(g.YB)), E(g.YB, g.B), E(g.YF, g.B), F(0, g.B), F(0, fz(0))], "mid"));
  out.push(line([E(g.YF, ez(g.YF)), E(g.YF, g.B)], "mid"));
  out.push(line([[0, g.YB, S.z(0, g.YB)], [XE, g.YB, S.z(XE, g.YB)]], "mid"));
  out.push(line([[0, g.YB, S.z(0, g.YB)], [0, -g.CURB_T, S.z(0, -g.CURB_T)], [0, 0, S.up(0)], [0, 0, S.flow(0)], [0, g.PAN, S.lip(0)], [0, g.YF, S.z(0, g.YF)]], "mid"));
  return out.join("");
}

// The chamber interior, seen through the cut: far wall, back wall and floor, in the end section's window.
export function chamberSvg(K, P, Sx, SL, g = GEO) {
  const S = surfaceOf(Sx, SL, g);
  const at = (p) => K.iso(p, P);
  const { ch } = g;
  const XE = g.L;
  const top = S.up(XE) - ch.lintel;
  const poly = (pts, cls) => `<path class="${cls}" d="${K.pathOf(pts.map(at), true)}"/>`;
  const out = [];
  out.push(poly([[ch.x0, ch.y0, ch.z0], [ch.x0, ch.y1, ch.z0], [ch.x0, ch.y1, top], [ch.x0, ch.y0, top]], "sd-in sd-in-far"));
  out.push(poly([[ch.x0, ch.y0, ch.z0], [XE, ch.y0, ch.z0], [XE, ch.y0, top], [ch.x0, ch.y0, top]], "sd-in sd-in-side"));
  out.push(poly([[ch.x0, ch.y0, ch.z0], [XE, ch.y0, ch.z0], [XE, ch.y1, ch.z0], [ch.x0, ch.y1, ch.z0]], "sd-in sd-in-floor"));
  out.push(K.lineSvg(K.pathOf([[ch.x0, ch.y0, ch.z0], [ch.x0, ch.y0, top]].map(at)), { tone: "lo" }));
  out.push(K.lineSvg(K.pathOf([[ch.x0, ch.y0, ch.z0], [XE, ch.y0, ch.z0]].map(at)), { tone: "lo" }));
  out.push(K.lineSvg(K.pathOf([[ch.x0, ch.y0, ch.z0], [ch.x0, ch.y1, ch.z0]].map(at)), { tone: "lo" }));
  // steps down the back wall
  for (let z = ch.z0 + 10; z < top - 4; z += 9) {
    out.push(K.lineSvg(K.pathOf([[200, ch.y0, z], [212, ch.y0, z]].map(at)), { tone: "mid" }));
    out.push(K.dotsSvg([at([200, ch.y0, z]), at([212, ch.y0, z])], { size: 0.55, tone: "mid" }));
  }
  return out.join("");
}
