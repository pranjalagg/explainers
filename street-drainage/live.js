// Live layer. solve() (model.mjs) turns the rain and the slopes into flows; this draws them:
// the water along the curb, the spill into the basin, the pipes, the rain and the streaks that move with the flow.
const { P, GEO: g, DEF, NOZZLES, MAN, ROTA, FEED } = DATA;
const KIT = { iso, pathOf, lineSvg, dotsSvg, faceTextSvg, topMatrix };
const stage = document.querySelector(".sd-stage");
const svg = stage.querySelector("svg");
const q = (sel) => svg.querySelector(sel);
const el = {
  block: q("[data-block]"), chamber: q("[data-chamber]"), clip: q("[data-window-clip]"),
  waterIn: q("[data-water-in]"), water: q("[data-water]"), rain: q("[data-rain]"), float: q("[data-float]"),
};
const ui = {
  readout: document.querySelector("[data-readout]"),
  rain: document.querySelector("[data-rain]"), rainOut: document.querySelector("[data-rain-out]"),
  sx: document.querySelector("[data-sx]"), sxOut: document.querySelector("[data-sx-out]"),
  sl: document.querySelector("[data-sl]"), slOut: document.querySelector("[data-sl-out]"),
  clog: document.querySelector("[data-clog]"), reset: document.querySelector("[data-reset]"),
  presets: [...document.querySelectorAll("[data-rain-to]")],
  gutter: document.querySelector("[data-gutter]"), gutterNote: document.querySelector("[data-gutter-note]"),
  spreadBar: document.querySelector("[data-spread-bar]"), allowMark: document.querySelector("[data-allow-mark]"),
  inlet: document.querySelector("[data-inlet]"), inletNote: document.querySelector("[data-inlet-note]"), inletBar: document.querySelector("[data-inlet-bar]"),
  pipes: document.querySelector("[data-pipes]"), pipesNote: document.querySelector("[data-pipes-note]"), mainBar: document.querySelector("[data-main-bar]"),
  bond: document.querySelector("[data-bond]"), bondNote: document.querySelector("[data-bond-note]"),
};
const still = matchMedia("(prefers-reduced-motion: reduce)");
const at = (p) => iso(p, P);
const d3 = (pts, close = true) => pathOf(pts.map(at), close);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const TAU = Math.PI * 2;
const MAXT = 4; // spread bar range, m

// ---------- state
const st = { rain: DEF.rain, rainTo: DEF.rain, Sx: DEF.Sx, SL: DEF.SL, clog: 0, clogTo: 0, touring: true, tourT: 0 };
let S = surfaceOf(st.Sx, st.SL);
let R = solve({ rain: st.rain, Sx: st.Sx, SL: st.SL });
let geoKey = "";

function rebuild() {
  const key = st.Sx.toFixed(4) + "/" + st.SL.toFixed(4);
  if (key === geoKey) return;
  geoKey = key;
  S = surfaceOf(st.Sx, st.SL);
  el.block.innerHTML = blockSvg(KIT, P, st.Sx, st.SL);
  el.chamber.innerHTML = chamberSvg(KIT, P, st.Sx, st.SL);
  el.clip.setAttribute("d", d3(voidOf(st.Sx, st.SL).map(([y, z]) => [g.L, y, z])));
}

// ---------- particles: streaks ride the flow, drops fall from the nozzles
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const streaks = { gutter: [], sheet: [], lateral: [], main: [] };
const drops = [];
const splashes = [];

// a short, thin sliver on a plane: centre c, unit direction u, side v
function sliver(c, u, v, len, wid) {
  const p = (a, b) => [c[0] + u[0] * a + v[0] * b, c[1] + u[1] * a + v[1] * b, c[2] + u[2] * a + v[2] * b];
  return d3([p(-len / 2, 0), p(0, -wid / 2), p(len / 2, 0), p(0, wid / 2)]);
}

function spreadAt(x) { return Math.min(R.profile(x / g.H) * g.H, g.YF); }
function levelAt(x) {
  const T = R.profile(x / g.H);
  return S.flow(x) + sectionOf(T, st.Sx).d * g.V;
}

function stepParticles(dt) {
  const run = st.rain > 0.5;
  // gutter streaks: along +x at the mean velocity, spread across the wetted width
  const vG = R.V * g.H;
  const wantG = run ? 26 : 0;
  while (streaks.gutter.length < wantG) streaks.gutter.push({ x: rnd() * g.L, f: rnd(), life: rnd() });
  if (streaks.gutter.length > wantG) streaks.gutter.length = wantG;
  for (const s of streaks.gutter) {
    s.x += vG * dt * (0.6 + 0.8 * (1 - s.f));
    s.life += dt * 0.9;
    if (s.x > g.L - 2 || s.life > 1) { s.x = rnd() * (g.L - 20); s.f = rnd(); s.life = 0; }
  }
  // sheet flow on the road: slow, straight down the steepest slope, toward the curb and downhill
  const m = Math.hypot(st.SL, st.Sx);
  const dir = [st.SL / m, -st.Sx / m];
  const wantS = run ? Math.round(10 + st.rain / 5) : 0;
  while (streaks.sheet.length < wantS) streaks.sheet.push({ x: rnd() * g.L, y: g.PAN + rnd() * (g.YF - g.PAN), life: rnd() });
  if (streaks.sheet.length > wantS) streaks.sheet.length = wantS;
  for (const s of streaks.sheet) {
    const v = 6 + st.rain / 25; // a few cm/s to about 0.3 m/s, drawn at 40 u per metre
    s.x += dir[0] * v * dt; s.y += dir[1] * v * dt; s.life += dt * 0.5;
    if (s.y < spreadAt(s.x) || s.x > g.L - 2 || s.life > 1) { s.x = rnd() * g.L; s.y = Math.max(spreadAt(s.x), g.PAN) + rnd() * (g.YF - Math.max(spreadAt(s.x), g.PAN)); s.life = 0; }
  }
  // lateral and main: along their axes at their Manning velocities
  const vL = R.lateral.y > 0.01 ? 40 * 1.6 : 0;
  const vM = R.main.y > 0.01 ? 40 * 1.3 : 0;
  const wantL = R.inlet.Qi > 1e-4 ? 6 : 0, wantM = R.mainQ > 1e-4 ? 10 : 0;
  while (streaks.lateral.length < wantL) streaks.lateral.push({ s: rnd(), life: rnd() });
  if (streaks.lateral.length > wantL) streaks.lateral.length = wantL;
  while (streaks.main.length < wantM) streaks.main.push({ x: rnd() * g.L, f: rnd(), life: rnd() });
  if (streaks.main.length > wantM) streaks.main.length = wantM;
  for (const s of streaks.lateral) { s.s += (vL * dt) / 150; s.life += dt * 0.8; if (s.s > 1 || s.life > 1) { s.s = rnd() * 0.3; s.life = 0; } }
  for (const s of streaks.main) { s.x += vM * dt; s.life += dt * 0.6; if (s.x > g.L || s.life > 1) { s.x = rnd() * g.L * 0.6; s.f = rnd(); s.life = 0; } }

  // drops: each nozzle sprays a cone; count follows the rain rate
  const wantD = Math.round(st.rain * 0.55);
  const rate = wantD / 0.42;
  let born = rate * dt;
  while (born > 0 && drops.length < wantD + 4) {
    if (born < 1 && rnd() > born) break;
    born -= 1;
    const n = NOZZLES[Math.floor(rnd() * NOZZLES.length)];
    const to = [clamp(n + (rnd() - 0.5) * 44, 1, g.L - 1), clamp(MAN.y + (rnd() - 0.5) * 2 * 120, g.YB + 1, g.YF - 1)];
    drops.push({ from: [n, MAN.y, MAN.z - MAN.r - 3.6], to: [to[0], to[1], S.z(to[0], to[1])], t: 0 });
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.t += dt / 0.42;
    if (d.t >= 1) { splashes.push({ c: d.to, t: 0 }); drops.splice(i, 1); }
  }
  for (let i = splashes.length - 1; i >= 0; i--) { splashes[i].t += dt / 0.35; if (splashes[i].t >= 1) splashes.splice(i, 1); }
  if (splashes.length > 60) splashes.splice(0, splashes.length - 60);
}

// ---------- drawing
const fade = (life) => Math.sin(Math.PI * clamp(life, 0, 1));
function drawWater() {
  const out = [];
  const xsN = 40;
  const xs = Array.from({ length: xsN + 1 }, (_, i) => (g.L * i) / xsN);
  const wet = clamp(st.rain / 40, 0, 1);
  // a thin sheen on the paving while it rains
  if (wet > 0.01) {
    out.push(`<path class="sd-w" style="fill-opacity:${(0.1 * wet).toFixed(3)}" d="${d3([[0, 0, S.flow(0)], [g.L, 0, S.flow(g.L)], [g.L, g.YF, S.z(g.L, g.YF)], [0, g.YF, S.z(0, g.YF)]])}"/>`);
    out.push(`<path class="sd-w" style="fill-opacity:${(0.07 * wet).toFixed(3)}" d="${d3([[0, g.YB, S.z(0, g.YB)], [g.L, g.YB, S.z(g.L, g.YB)], [g.L, 0, S.up(g.L)], [0, 0, S.up(0)]])}"/>`);
  }
  // the gutter flow: a flat water surface from the curb out to the spread
  if (R.Qin > 1e-6) {
    const lv = xs.map(levelAt);
    const sp = xs.map(spreadAt);
    const curb = xs.map((x, i) => [x, 0, lv[i]]);
    const edge = xs.map((x, i) => [x, sp[i], Math.max(lv[i], S.z(x, sp[i]))]);
    out.push(`<path class="sd-w" d="${d3([...curb, ...edge.slice().reverse()])}"/>`);
    // the water against the curb face, seen through the surface
    out.push(`<path class="sd-w-line" d="${d3(curb, false)}"/>`);
    for (const s of streaks.gutter) {
      const T = spreadAt(s.x);
      if (T < 2) continue;
      const y = Math.max(1, T * (0.12 + 0.75 * s.f));
      const c = [s.x, y, levelAt(s.x) + 0.05];
      out.push(`<path class="sd-streak" style="opacity:${(0.55 * fade(s.life)).toFixed(2)}" d="${sliver(c, [1, 0, 0], [0, 1, 0], 7 + 6 * (1 - s.f), 0.7)}"/>`);
    }
    // where the water runs past the front cut, its section shows on that face
    const over = xs.map((x, i) => [x, lv[i] - S.z(x, g.YF)]);
    if (over.some(([, h]) => h > 0.05)) {
      const top = over.map(([x, h]) => [x, g.YF, S.z(x, g.YF) + Math.max(h, 0)]);
      out.push(`<path class="sd-w-deep" d="${d3([...xs.map((x) => [x, g.YF, S.z(x, g.YF)]), ...top.slice().reverse()])}"/>`);
    }
    // the spread edge: the one lit line
    out.push(`<path class="sd-w-edge" d="${d3(edge, false)}"/>`);
    // section of the flow at the cut, and the spill into the throat
    const T = spreadAt(g.L), lvE = levelAt(g.L);
    const ys = Array.from({ length: 13 }, (_, i) => (T * i) / 12);
    const sec = [[g.L, 0, S.flow(g.L)], ...ys.map((y) => [g.L, y, S.z(g.L, y)]), [g.L, T, lvE], [g.L, 0, lvE]];
    out.push(`<path class="sd-w-deep" d="${d3(sec)}"/>`);
    out.push(`<path class="sd-w-edge" d="${d3([[g.L, 0, lvE], [g.L, T, lvE]], false)}"/>`);
  }
  // sheet flow streaks on the road
  const m = Math.hypot(st.SL, st.Sx), u = [st.SL / m, -st.Sx / m, 0], v = [st.Sx / m, st.SL / m, 0];
  for (const s of streaks.sheet) {
    const c = [s.x, s.y, S.z(s.x, s.y) + 0.05];
    out.push(`<path class="sd-streak" style="opacity:${(0.4 * fade(s.life)).toFixed(2)}" d="${sliver(c, u, v, 5, 0.6)}"/>`);
  }
  // splashes where drops land
  for (const sp of splashes) {
    const r = 0.6 + 2.6 * sp.t;
    const ring = Array.from({ length: 14 }, (_, i) => [sp.c[0] + r * Math.cos((i / 14) * TAU), sp.c[1] + r * Math.sin((i / 14) * TAU), sp.c[2] + 0.1]);
    out.push(`<path class="sd-splash" style="opacity:${(0.7 * (1 - sp.t)).toFixed(2)}" d="${d3(ring)}"/>`);
  }
  drawUnder(out);
  el.water.innerHTML = out.join("");
  drawInside();
}

// water in the end section: the spill, the sump, the lateral and the main
function drawUnder(out) {
  const E = (y, z) => [g.L, y, z];
  const { ch, main } = g;
  const LAT = DATA.LAT;
  const ri = g.lat.r;
  const pool = poolLevel();
  // spill: a jet leaving the throat floor at the gutter velocity, falling to the sump
  if (R.inlet.Qi > 1e-6) {
    const V = Math.max(R.V, 0.15) * g.H, z0 = S.flow(g.L);
    const thick0 = clamp(sectionOf(R.T, st.Sx).d * g.V * 0.8, 1.2, 6);
    const lower = [], upper = [];
    const fall = z0 - pool;
    const tEnd = Math.sqrt((2 * fall) / (9.81 * g.H));
    for (let i = 0; i <= 14; i++) {
      const t = (tEnd * i) / 14;
      const y = ch.y1 - V * t, z = z0 - 0.5 * 9.81 * g.H * t * t;
      const th = thick0 / (1 + 6 * t);
      lower.push(E(Math.max(y, ch.y0 + 1), z));
      upper.push(E(Math.max(y + th * 0.6, ch.y0 + 1), z + th));
    }
    out.push(`<path class="sd-w-deep" style="fill-opacity:.7" d="${d3([E(0, z0), E(0, z0 + thick0), ...upper, ...lower.slice().reverse()])}"/>`);
  }
  // sump: always holds water to the outlet invert, plus the depth in the lead
  out.push(`<path class="sd-w-deep" d="${d3([E(ch.y0, ch.z0), E(ch.y1, ch.z0), E(ch.y1, pool), E(ch.y0, pool)])}"/>`);
  out.push(`<path class="sd-w-edge" style="stroke-width:.6" d="${d3([E(ch.y0, pool), E(ch.y1, pool)], false)}"/>`);
  // lateral: a layer in the bottom of the bore
  if (R.lateral.y > 0.002 || R.main.surcharged) {
    const depth = R.main.surcharged ? 2 * ri : Math.max(0.6, R.lateral.y * 2 * ri);
    const bottom = offsetLine(LAT.pts, -ri);
    const top = offsetLine(LAT.pts, -ri + depth);
    out.push(`<path class="sd-w-deep" d="${d3([...bottom, ...top.slice().reverse()].map(([y, z]) => E(y, z)))}"/>`);
    const pts = LAT.pts;
    const segL = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    const total = segL.reduce((a, b) => a + b, 0);
    for (const s of streaks.lateral) {
      let d = s.s * total, i = 0;
      while (i < segL.length - 1 && d > segL[i]) { d -= segL[i]; i++; }
      const a = pts[i], b = pts[i + 1], f = Math.min(1, d / segL[i]);
      const ty = (b[0] - a[0]) / segL[i], tz = (b[1] - a[1]) / segL[i];
      const yc = a[0] + (b[0] - a[0]) * f - tz * (-ri + depth * 0.5), zc = a[1] + (b[1] - a[1]) * f + ty * (-ri + depth * 0.5);
      out.push(`<path class="sd-streak" style="opacity:${(0.6 * fade(s.life)).toFixed(2)}" d="${sliver(E(yc, zc), [0, ty, tz], [0, -tz, ty], 6, Math.min(0.7, depth * 0.6))}"/>`);
    }
  }
  // main, in both sections
  if (R.mainQ > 1e-6) {
    const r = main.r;
    const lv = main.z - r + 2 * r * R.main.y;
    const segPts = [];
    const a0 = Math.PI / 2 + Math.acos(clamp((lv - main.z) / r, -1, 1));
    for (let i = 0; i <= 24; i++) {
      const a = a0 + ((1.5 * Math.PI - a0) * i) / 24;
      segPts.push(E(main.y + r * Math.cos(a), main.z + r * Math.sin(a)));
    }
    segPts.push(E(main.y, lv));
    out.push(`<path class="sd-w-deep" d="${d3(segPts)}"/>`);
    const F = (x, z) => [x, g.YF, z];
    out.push(`<path class="sd-w-deep" d="${d3([F(0, main.z - r), F(g.L, main.z - r), F(g.L, lv), F(0, lv)])}"/>`);
    out.push(`<path class="sd-w-edge" style="stroke-width:.6" d="${d3([F(0, lv), F(g.L, lv)], false)}"/>`);
    // surcharge: the pressure line rises up the manhole
    if (R.main.surcharged) {
      const Sf = PIPES.main.S * R.main.share ** 2;
      const rise = (Sf - PIPES.main.S) * 100 * g.H; // extra head over 100 m of main
      const top = Math.min(main.z + r + rise, S.z(g.mh.x, g.YF) - g.ASPH - 2 - g.mh.cone);
      out.push(`<path class="sd-w-deep" d="${d3([F(g.mh.x - g.mh.r, main.z + r), F(g.mh.x + g.mh.r, main.z + r), F(g.mh.x + g.mh.r, top), F(g.mh.x - g.mh.r, top)])}"/>`);
    }
    for (const s of streaks.main) {
      const z = main.z - r + (lv - (main.z - r)) * (0.25 + 0.5 * s.f);
      out.push(`<path class="sd-streak" style="opacity:${(0.6 * fade(s.life)).toFixed(2)}" d="${sliver(F(s.x, z), [1, 0, 0], [0, 0, 1], 9, 0.7)}"/>`);
    }
  }
}

function poolLevel() {
  const inv = DATA.LAT.invert;
  const fill = R.main.surcharged ? 1 : R.lateral.y;
  return inv + fill * 2 * g.lat.r;
}

// inside the chamber, through the cut: the pool surface and rings where the spill lands
function drawInside() {
  const { ch } = g;
  const pool = poolLevel();
  const out = [`<path class="sd-w" style="fill-opacity:.32" d="${d3([[ch.x0, ch.y0, pool], [g.L, ch.y0, pool], [g.L, ch.y1, pool], [ch.x0, ch.y1, pool]])}"/>`];
  out.push(`<path class="sd-w-line" d="${d3([[g.L, ch.y0, pool], [ch.x0, ch.y0, pool], [ch.x0, ch.y1, pool]], false)}"/>`);
  if (R.inlet.Qi > 1e-6) {
    // the spill falls along the front wall for the whole opening; its foot churns the pool
    const now = performance.now() / 1000;
    for (let i = 0; i < 5; i++) {
      const t = (now * 0.8 + i / 5) % 1;
      const r = 2 + 9 * t;
      const cx = g.XIN + 10 + i * 11, cy = ch.y1 - 6;
      const ring = Array.from({ length: 18 }, (_, j) => [cx + r * 1.4 * Math.cos((j / 18) * TAU), cy + r * 0.5 * Math.sin((j / 18) * TAU), pool + 0.1]);
      out.push(`<path class="sd-splash" style="opacity:${(0.6 * (1 - t)).toFixed(2)}" d="${d3(ring)}"/>`);
    }
  }
  el.waterIn.innerHTML = out.join("");
}

function drawRain() {
  const out = [];
  for (const d of drops) {
    const t = d.t;
    const e = t * t * 0.35 + t * 0.65; // leaves the nozzle fast, then keeps on
    const p = [d.from[0] + (d.to[0] - d.from[0]) * e, d.from[1] + (d.to[1] - d.from[1]) * e, d.from[2] + (d.to[2] - d.from[2]) * e];
    const dir = [d.to[0] - d.from[0], d.to[1] - d.from[1], d.to[2] - d.from[2]];
    const m = Math.hypot(...dir);
    const u = dir.map((c) => c / m);
    const a = at(p), b = at([p[0] - u[0] * 5, p[1] - u[1] * 5, p[2] - u[2] * 5]);
    const nx = -(b[1] - a[1]), ny = b[0] - a[0], nl = Math.hypot(nx, ny) || 1, w = 0.35;
    out.push(`<path class="sd-drop" style="opacity:${(0.75 * Math.min(1, t * 5)).toFixed(2)}" d="M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${((a[0] + b[0]) / 2 + (nx / nl) * w).toFixed(1)} ${((a[1] + b[1]) / 2 + (ny / nl) * w).toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}L${((a[0] + b[0]) / 2 - (nx / nl) * w).toFixed(1)} ${((a[1] + b[1]) / 2 - (ny / nl) * w).toFixed(1)}Z"/>`);
  }
  el.rain.innerHTML = out.join("");
  // the rotameter float rides up with the flow to the nozzles
  const z = ROTA.z0 + 2 + (st.rain / 150) * (ROTA.z1 - ROTA.z0 - 7);
  el.float.setAttribute("transform", translateAlong(P, [0, 0, z]));
}

// ---------- numbers
const fmt = (v, n = 1) => v.toFixed(n);
function writeNumbers() {
  const r = st.rain, T = R.T, inl = R.inlet;
  const text = r < 0.5 ? "dry" : `${fmt(r, 0)} mm/h · spread ${fmt(T, 2)} m · inlet takes ${fmt(inl.E * 100, 0)} %`;
  if (ui.readout.textContent !== text) ui.readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(r)));
  stage.setAttribute("aria-valuetext", text);
  ui.rainOut.textContent = `${fmt(r, 0)} mm/h`;
  ui.sxOut.textContent = `${fmt(st.Sx * 100)} %`;
  ui.slOut.textContent = `${fmt(st.SL * 100)} %`;
  if (document.activeElement !== ui.rain) ui.rain.value = String(Math.round(st.rainTo));
  ui.gutter.textContent = r < 0.5 ? "Dry" : `${fmt(R.Qin * 1000)} L/s · spread ${fmt(T, 2)} m · ${fmt(R.d * 100)} cm deep at the curb · ${fmt(R.V, 2)} m/s`;
  ui.spreadBar.style.width = `${clamp(T / MAXT, 0, 1) * 100}%`;
  ui.spreadBar.dataset.over = R.within ? "" : "1";
  ui.allowMark.style.left = `${(STREET.allowT / MAXT) * 100}%`;
  ui.gutterNote.textContent = r < 0.5 ? "No flow." : R.overCurb ? "Deeper than the curb: water is over the sidewalk." : R.intoLane ? `Past the ${STREET.allowT} m design limit and into the traffic lane.` : `Within the ${STREET.allowT} m design limit (gutter and parking lane).`;
  ui.inlet.textContent = r < 0.5 ? "Idle" : `takes ${fmt(inl.E * 100, 0)} % · ${fmt(inl.Qi * 1000)} L/s in, ${fmt(inl.Qb * 1000)} L/s past`;
  ui.inletBar.style.width = `${clamp(inl.E, 0, 1) * 100}%`;
  ui.inletNote.textContent = r < 0.5 ? "" : st.clog > 0.5 ? "Two thirds of the opening is blocked, so more water carries on to the next inlet." : inl.E >= 0.999 ? `It would take all of it with only ${fmt(inl.LT, 2)} m of opening; this one is ${STREET.inletL} m.` : `Taking all of it would need ${fmt(inl.LT, 2)} m of opening; the rest carries on to the next inlet.`;
  const share = R.main.share;
  ui.pipes.textContent = r < 0.5 ? "Empty" : `lead ${fmt(R.lateral.y * 100, 0)} % deep · main ${fmt(Math.min(share, 9) * 100, 0)} % of capacity`;
  ui.mainBar.style.width = `${clamp(share, 0, 1) * 100}%`;
  ui.mainBar.dataset.over = share > 1 ? "1" : "";
  ui.pipesNote.textContent = r < 0.5 ? "" : share > 1 ? "The main is surcharged: it runs full under pressure and water rises up the manhole." : `The 450 mm main carries the runoff from ${PIPES.main.area} ha toward the river at ${fmt(R.mainQ * 1000, 0)} L/s.`;
  ui.bond.textContent = r < 0.5 ? "No water to compare" : `gravity ≈ ${Math.round(R.bond)} × surface tension`;
  ui.bondNote.textContent = `Bond number ρgd²/σ at the curb depth. Surface tension only competes in water shallower than about ${fmt(CAPILLARY * 1000)} mm.`;
}

// ---------- loop
let frame = 0, last = 0, visible = false, idle = 0;
const TOUR = [5, 25, 75, 150, 75];
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (st.touring && !calm) {
    st.tourT += dt;
    st.rainTo = TOUR[Math.floor(st.tourT / 6) % TOUR.length];
  }
  st.rain = calm ? st.rainTo : st.rain + (st.rainTo - st.rain) * (1 - Math.exp(-dt / 0.9));
  if (Math.abs(st.rain - st.rainTo) < 0.05) st.rain = st.rainTo;
  st.clog = calm ? st.clogTo : st.clog + (st.clogTo - st.clog) * (1 - Math.exp(-dt / 0.5));
  rebuild();
  R = solve({ rain: st.rain, Sx: st.Sx, SL: st.SL, clogged: st.clog * 0.67 });
  if (!calm) stepParticles(dt); else { drops.length = 0; splashes.length = 0; for (const k of Object.keys(streaks)) streaks[k].length = 0; }
  drawWater();
  drawRain();
  writeNumbers();
  const settled = calm && !st.touring;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const drawOnce = () => { rebuild(); R = solve({ rain: st.rain, Sx: st.Sx, SL: st.SL, clogged: st.clog * 0.67 }); drawWater(); drawRain(); writeNumbers(); };
function steer() {
  st.touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => { st.touring = !still.matches; st.tourT = 0; run(); }, 9000);
  if (still.matches) { st.rain = st.rainTo; drawOnce(); }
  run();
}
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) st.touring = false;

let dragging = false;
const rainFromPointer = (event) => {
  const box = svg.getBoundingClientRect();
  const f = clamp(((event.clientX - box.left) / box.width - 0.15) / 0.7, 0, 1);
  st.rainTo = Math.round(f * 150);
  steer();
};
stage.addEventListener("pointerdown", (e) => { dragging = true; stage.setPointerCapture(e.pointerId); rainFromPointer(e); });
stage.addEventListener("pointermove", (e) => { if (dragging || e.pointerType === "mouse") rainFromPointer(e); });
stage.addEventListener("pointerup", () => { dragging = false; });
stage.addEventListener("pointercancel", () => { dragging = false; });
stage.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 25 : 5;
  let to = null;
  if (e.key === "ArrowRight" || e.key === "ArrowUp") to = st.rainTo + step;
  if (e.key === "ArrowLeft" || e.key === "ArrowDown") to = st.rainTo - step;
  if (e.key === "Home") to = 0;
  if (e.key === "End") to = 150;
  if (to === null) return;
  e.preventDefault();
  st.rainTo = clamp(to, 0, 150);
  steer();
});
ui.rain.addEventListener("input", () => { st.rainTo = Number(ui.rain.value); steer(); });
ui.sx.addEventListener("input", () => { st.Sx = Number(ui.sx.value) / 100; steer(); });
ui.sl.addEventListener("input", () => { st.SL = Number(ui.sl.value) / 100; steer(); });
ui.presets.forEach((b) => b.addEventListener("click", () => { st.rainTo = Number(b.dataset.rainTo); steer(); }));
ui.clog.addEventListener("click", () => { st.clogTo = st.clogTo > 0.5 ? 0 : 1; ui.clog.setAttribute("aria-pressed", String(st.clogTo > 0.5)); steer(); });
ui.reset.addEventListener("click", () => { st.Sx = DEF.Sx; st.SL = DEF.SL; ui.sx.value = String(DEF.Sx * 100); ui.sl.value = String(DEF.SL * 100); steer(); });
drawOnce();
