// Keyboard switches: the live page. The kit, shared.mjs and model.mjs are inlined before this file, with their imports
// and exports removed, so iso, axisVector, vcoil, SWITCHES, force and sense are all in scope. DATA comes from the build.
(() => {
const D = DATA;
const stage = document.querySelector(".kb-stage");
const svg = stage.querySelector("svg");
const card = stage.closest(".iso-plate");
const readout = card.querySelector("[data-readout]");
const panel = document.querySelector(".kb-panel");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const SW = SWITCHES;
const N = SW.length;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const follow = (cur, target, dt, tau, calm) => (calm ? target : cur + (target - cur) * (1 - Math.exp(-dt / tau)));
const f1 = (v) => Math.round(v * 10) / 10;

// A critically damped spring, in four sub-steps, on { x, v }. True while still moving.
function settleTo(s, target, dt, tau, calm) {
  if (calm) { s.x = target; s.v = 0; return false; }
  const w = 1 / tau;
  for (let i = 0; i < 4; i++) {
    const h = dt / 4;
    s.v += (w * w * (target - s.x) - 2 * w * s.v) * h;
    s.x += s.v * h;
  }
  if (Math.abs(target - s.x) < 1e-4 && Math.abs(s.v) < 1e-4) { s.x = target; s.v = 0; return false; }
  return true;
}

// ---------- what is on the page ----------
const sp = SW.map((sw, i) => {
  const g = svg.querySelector(`[data-sp="${sw.id}"]`);
  return {
    sw, i, g,
    stems: $$("[data-stem]", g),
    back: $('[data-spring="back"]', g),
    front: $('[data-spring="front"]', g),
    leaf: $("[data-leaf]", g),
    sigs: $$("[data-sig]", g),
    sparks: $$("[data-spark]", g),
    beamL: $('[data-beam="left"]', g),
    beamR: $('[data-beam="right"]', g),
    field: $("[data-field]", g),
    hammer: $("[data-hammer]", g),
    dome: $("[data-dome]", g),
    impact: $("[data-impact]", g),
    lamp: svg.querySelector(`[data-lamp="${i}"] .iso-solid`),
    x: 0, st: newSense(), leafP: 0, jacketP: 0, flash: 0, last: "",
    spec: D.specs[i],
  };
});
const gantry = $("[data-gantry]", svg);
const probes = $$("[data-probe]", svg);
const needle = $("[data-needle]", svg);
const lamps = sp.map((s) => s.lamp);

// ---------- state ----------
const S = {
  sel: 0,
  x: 0, target: 0, dir: 0, vel: 0,
  pad: 0,                    // probe position above the cap, in units
  xc: D.XS[0], lift: 0,      // gantry x and probe lift
  cam: { cx: 0, cy: 0, z: 1 }, camT: { cx: 0, cy: 0, z: 1 },
  zoomed: false,
  overview: false,           // the reader chose to see all seven, so the tour keeps the wide view
  hall: { ...HALL },
  held: false,                // the reader has hold of the key
  auto: null,                 // a scripted press: { t, depth, hold, down, up }
  tour: { on: false, step: 0, wait: 0 },
  idle: 0,
  pending: null,
};
const needleAt = (force) => {
  const { r, z, h, from, span, max } = D.DIAL;
  const a = from + span * clamp(force / max, 0, 1);
  return lineOnTop([-Math.sin(a) * 3.4, Math.cos(a) * 3.4], [Math.sin(a) * (r - 4), -Math.cos(a) * (r - 4)], z + h + 0.2, D.P);
};

// ---------- the camera ----------
const scr = (x, z) => iso([x, 0, z], D.P);
function aimCamera() {
  if (!S.zoomed) { S.camT = { cx: D.W / 2, cy: D.H / 2, z: 1 }; return; }
  const [cx, cy] = scr(D.XS[S.sel], 95);
  S.camT = { cx, cy, z: D.ZOOM };
}
function drawCamera(dt, calm) {
  const c = S.cam, t = S.camT;
  c.cx = follow(c.cx, t.cx, dt, 0.28, calm);
  c.cy = follow(c.cy, t.cy, dt, 0.28, calm);
  c.z = follow(c.z, t.z, dt, 0.28, calm);
  const w = D.W / c.z, h = D.H / c.z;
  let vx = c.cx - w / 2, vy = c.cy - h / 2;
  vx = clamp(vx, -D.W * 0.04, D.W * 1.04 - w);
  vy = clamp(vy, -D.H * 0.04, D.H * 1.04 - h);
  const text = `${f1(vx)} ${f1(vy)} ${f1(w)} ${f1(h)}`;
  if (text !== S.vb) { S.vb = text; svg.setAttribute("viewBox", text); }
}

// ---------- selecting ----------
function select(i, { zoom = S.zoomed } = {}) {
  if (i === S.sel && zoom === S.zoomed) return;
  const changed = i !== S.sel;
  S.sel = i;
  S.zoomed = zoom;
  if (changed) { S.target = 0; S.auto = null; S.held = false; }
  aimCamera();
  showSwitch();
  kick();
}

// ---------- charts ----------
const NS = "http://www.w3.org/2000/svg";
const CH = { l: 30, r: 212, t: 10, b: 92 };
const fx = (mmv) => CH.l + (mmv / 4) * (CH.r - CH.l);
const fy = (v, max) => CH.b - (v / max) * (CH.b - CH.t);
const poly = (pts) => pts.map(([a, b], i) => `${i ? "L" : "M"}${f1(a)} ${f1(b)}`).join("");
const curve = (fn, max, steps = 160, to = 4) => poly(Array.from({ length: steps + 1 }, (_, i) => { const v = (to * i) / steps; return [fx(v), fy(fn(v), max)]; }));
const grid = (maxV, stepV, unit) => {
  let out = "";
  for (let m = 0; m <= 4; m++) out += `<path class="kb-grid" d="M${fx(m)} ${CH.t}V${CH.b}"/><text class="kb-tick" x="${fx(m)}" y="${CH.b + 10}" text-anchor="middle">${m}</text>`;
  for (let v = 0; v <= maxV + 1e-6; v += stepV) out += `<path class="kb-grid" d="M${CH.l} ${fy(v, maxV)}H${CH.r}"/><text class="kb-tick" x="${CH.l - 4}" y="${fy(v, maxV) + 2.5}" text-anchor="end">${v}${unit && v === maxV ? "" : ""}</text>`;
  return out;
};
const charts = {
  force: $("[data-chart='force']"),
  signal: $("[data-chart='signal']"),
  edge: $("[data-chart='edge']"),
};
let cur = {};
function buildCharts() {
  const sw = SW[S.sel];
  const hall = sw.sense === "hall";
  // force
  charts.force.innerHTML = `${grid(100, 25)}
    <path class="kb-mark kb-mark-act" d="M${fx(sw.act)} ${CH.t}V${CH.b}"/>
    <path class="kb-up" d="${curve((v) => sw.up(Math.min(v, sw.travel)), 100, 160, sw.travel)}"/>
    <path class="kb-down" d="${curve((v) => sw.down(Math.min(v, sw.travel)), 100, 160, sw.travel)}"/>
    <path class="kb-stop" d="M${fx(sw.travel)} ${CH.t}V${CH.b}"/>
    <circle class="kb-dot" data-dot r="3.4" cx="${fx(0)}" cy="${fy(sw.down(0), 100)}"/>`;
  // signal
  let body = "";
  if (sw.sense === "contact") {
    const a = fx(sw.act), r = fx(sw.release), top = fy(1, 1), bot = fy(0, 1);
    body = `<path class="kb-down" d="M${fx(0)} ${bot}H${a}V${top}H${fx(4)}"/><path class="kb-up" d="M${fx(4)} ${top}H${r}V${bot}H${fx(0)}"/>`;
  } else {
    const fn = (v) => signal(sw, v, S.hall);
    body = `<path class="kb-down" d="${curve(fn, 1)}"/><path class="kb-mark kb-mark-act" data-thresh d="M${CH.l} ${fy(0.5, 1)}H${CH.r}"/>`;
  }
  charts.signal.innerHTML = `${grid(1, 0.5)}${body}<circle class="kb-dot" data-dot r="3.4" cx="${fx(0)}" cy="${fy(0, 1)}"/><text class="kb-state" data-state x="${CH.r}" y="${CH.t + 8}" text-anchor="end"></text>`;
  // the electrical edge
  const e = edge(sw, 3);
  const ex = (t) => 14 + (t / 2) * 196;
  const ey = (v) => 80 - v * 54;
  charts.edge.innerHTML = `<path class="kb-grid" d="M14 ${ey(0)}H210"/><path class="kb-grid" d="M14 ${ey(1)}H210"/>
    <path class="kb-down" d="${poly(e.points.map(([t, v]) => [ex(t), ey(v)]))}"/>
    <text class="kb-tick" x="14" y="94">0 ms</text><text class="kb-tick" x="210" y="94" text-anchor="end">2 ms</text>`;
  const note = $("[data-edge-note]");
  note.textContent = sw.bounce ? `Bounces ${e.bounces} times in about ${e.settles.toFixed(1)} ms before it settles. Firmware waits it out.` : "A clean edge: nothing touches, so nothing bounces.";
  cur = {};
}

function showSwitch() {
  const sw = SW[S.sel];
  const t = D.TEXT[sw.id];
  $$("[data-pick]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.pick === S.sel)));
  $("[data-info-title]").textContent = t.title;
  $("[data-info-class]").textContent = t.class;
  $("[data-info-lede]").textContent = t.lede;
  $("[data-info-feel]").textContent = t.feel;
  $("[data-info-sense]").textContent = t.sense;
  $("[data-info-watch]").textContent = t.watch;
  $("[data-info-note]").textContent = t.note;
  $("[data-info-facts]").innerHTML = D.FACTS[sw.id].map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join("");
  $("[data-hall-controls]").hidden = sw.sense !== "hall";
  $("[data-zoom]").setAttribute("aria-pressed", String(!S.zoomed));
  $("[data-zoom]").textContent = S.zoomed ? "Show all seven" : "Close in";
  stage.setAttribute("aria-valuetext", `${t.title} selected`);
  buildCharts();
  say();
}

// ---------- the bench's own life ----------
function setLit(s, on) {
  for (const g of s.sigs) { g.toggleAttribute("data-on", on); for (const el of $$(".iso-solid", g)) el.toggleAttribute("data-lit", on); }
  for (const el of s.sparks) el.style.opacity = on ? "1" : "0";
}

function onEvent(s, event) {
  s.flash = 1;
  if (event === "make" || event === "break") {
    s.lampOn = event === "make";
    lamps[s.i].toggleAttribute("data-lit", s.lampOn);
    setLit(s, s.lampOn);
  }
  if (event === "make") hit(s.sw.id, "make");
  if (event === "break") hit(s.sw.id, "break");
}

// ---------- drawing one specimen ----------
function drawSpecimen(s, dt, calm) {
  const sw = s.sw, x = s.x, st = s.st;
  const down = st.down;
  s.leafP = follow(s.leafP, down ? 1 : 0, dt, down ? 0.022 : 0.05, calm);
  s.jacketP = follow(s.jacketP, down ? 1 : 0, dt, 0.018, calm);
  s.flash = follow(s.flash, 0, dt, 0.14, calm);
  const key = `${f1(x * 100)}|${f1(s.leafP * 100)}|${f1(s.jacketP * 100)}|${f1(s.flash * 50)}|${S.hallKey}`;
  if (key === s.last && !(sw.id === "hall" || sw.id === "optical")) return;
  s.last = key;
  const dz = -x * D.U;
  const base = translateAlong(D.P, [0, 0, dz]);
  for (const el of s.stems) {
    let t = base;
    if (el.hasAttribute("data-jacket")) t = translateAlong(D.P, [0, 0, dz - D.JACKET_DROP * s.jacketP]);
    else if (el.hasAttribute("data-flex")) t = translateAlong(D.P, [D.FLEX.amp * Math.exp(-0.5 * ((x - D.FLEX.at) / D.FLEX.width) ** 2), 0, dz]);
    if (el.__t !== t) { el.setAttribute("transform", t); el.__t = t; }
  }
  if (s.back && s.spec.floor !== undefined) {
    const c = vcoil(0, 0, s.spec.floor, s.spec.top + dz, D.GEO.coilR, D.GEO.coilTurns, D.P);
    s.back.setAttribute("d", c.back);
    s.front.setAttribute("d", c.front);
  }
  if (s.leaf) s.leaf.setAttribute("transform", translateAlong(D.P, [0, -D.LEAF_GAP * s.leafP, 0]));
  if (sw.id === "buckling") drawBuckle(s);
  if (sw.id === "topre") drawTopre(s);
  if (sw.id === "optical") drawBeam(s);
  if (sw.id === "hall") drawField(s);
}

// The spring buckles: it bows sideways until it strikes the barrel, and the hammer is thrown down onto the membrane.
function drawBuckle(s) {
  const B = D.BUCKLE;
  const bp = s.jacketP;
  const alpha = B.rest * (1 - bp);
  const hk = String(f1(alpha * 1000));
  if (s.hk !== hk) { s.hk = hk; s.hammer.innerHTML = hammerSvg(D.P, alpha, B); }
  const pre = 0.6 * Math.min(1, s.x / 2.2) ** 2;
  const amp = pre + (B.amp - pre) * bp;
  const zb = seatTop(alpha, B), zt = B.plunger - s.x * D.U;
  const c = vcoil(0, 0, zb, zt, B.coilR, B.turns, D.P, { lateral: (t) => [-amp * Math.sin(Math.PI * t), 0] });
  s.back.setAttribute("d", c.back);
  s.front.setAttribute("d", c.front);
  const zm = (zb + zt) / 2;
  s.impact.setAttribute("d", segment([-B.r - 0.2, 0, zm], [-B.r - 4, 0, zm + 5], D.P) + segment([-B.r - 0.2, 0, zm], [-B.r - 5, 0, zm], D.P) + segment([-B.r - 0.2, 0, zm], [-B.r - 4, 0, zm - 5], D.P));
  s.impact.style.opacity = String(Math.max(0, s.flash * (s.st.down ? 1 : 0.5)));
}

// The dome collapses as the slider comes down, and the conical spring inside it flattens.
function drawTopre(s) {
  const dm = domeAt(s.x, D.U);
  s.dome.innerHTML = solidSvg(domeShell(D.P, 0, dm.H, dm.ro, DOME.wall, { rows: 16, around: 20 }), { tone: "hi" });
  const c = vcoil(0, 0, dm.spring.z0, dm.spring.z1, dm.spring.r, dm.spring.turns, D.P);
  s.back.setAttribute("d", c.back);
  s.front.setAttribute("d", c.front);
}

function drawBeam(s) {
  const level = lightLevel(s.x, s.sw.act);
  const y = 22, z = 20;
  s.beamL.setAttribute("d", segment([-24.5, y, z], [-1.5, y, z], D.P));
  s.beamR.setAttribute("d", segment([1.5, y, z], [24.5, y, z], D.P));
  s.beamR.style.opacity = String(level);
  s.beamL.style.opacity = "1";
  const pd = s.g.querySelector('[data-sig="pd"]');
  if (pd) for (const el of $$(".iso-solid", pd)) el.toggleAttribute("data-lit", level > 0.5);
}

function drawField(s) {
  const dz = -s.x * D.U;
  const zMag = 36.5 + dz, zSen = 12;
  const str = hallSignal(s.x);
  let d = "";
  for (let k = 0; k < 5; k++) {
    const x0 = (k - 2) * 2.7;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push(iso([x0 + (k - 2) * 2.4 * Math.sin(Math.PI * t) * (0.4 + 0.6 * (1 - str)), 0, zMag + (zSen - zMag) * t], D.P));
    }
    d += poly(pts);
  }
  const path = s.field.firstChild || s.field.appendChild(document.createElementNS(NS, "path"));
  path.setAttribute("class", "iso-line");
  path.setAttribute("data-tone", "lit");
  path.setAttribute("d", d);
  path.style.strokeWidth = String(0.5 + 1.1 * str);
  path.style.opacity = String(0.18 + 0.82 * str);
}

// ---------- the gantry ----------
function drawGantry() {
  const t = translateAlong(D.P, [S.xc, 0, 0]);
  if (t !== S.gt) { S.gt = t; gantry.setAttribute("transform", t); }
  const pz = translateAlong(D.P, [0, 0, S.lift - S.pad * D.U]);
  if (pz !== S.pt) { S.pt = pz; for (const p of probes) p.setAttribute("transform", pz); }
}

// ---------- sound, if the reader wants it ----------
let audio = null;
let soundOn = false;
function hit(id, kind) {
  if (!soundOn) return;
  audio = audio || new (window.AudioContext || window.webkitAudioContext)();
  const a = audio, t = a.currentTime;
  const burst = (freq, len, gain, type = "bandpass", q = 4) => {
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * len), a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(a.destination); src.start(t);
  };
  const click = id === "clicky" || id === "buckling";
  if (kind === "make") { burst(click ? 3600 : 1400, click ? 0.05 : 0.03, click ? 0.5 : 0.18); if (id === "buckling") burst(900, 0.09, 0.25); }
  else burst(click ? 2600 : 1100, 0.03, click ? 0.3 : 0.1);
}

// ---------- the press ----------
function press(depth = 3.8) { S.auto = { t: 0, depth }; S.held = false; kick(); }

// ---------- the loop ----------
let frame = 0, last = 0, visible = true, clock = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now; clock += dt;
  const calm = still.matches;
  S.idle = (performance.now() - lastTouch) / 1000;
  if (S.tour.wait > 0) S.tour.wait -= dt;
  if (!calm) runTour();
  if (S.auto) {
    S.auto.t += dt;
    const a = S.auto;
    if (a.walk) {
      const p = a.walk;
      const end = p[p.length - 1][0];
      let i = 0; while (i < p.length - 2 && a.t > p[i + 1][0]) i++;
      const u = clamp((a.t - p[i][0]) / (p[i + 1][0] - p[i][0]), 0, 1);
      S.target = p[i][1] + (p[i + 1][1] - p[i][1]) * (0.5 - 0.5 * Math.cos(Math.PI * u));
      if (a.t > end) { S.auto = null; S.target = 0; }
    } else {
      S.target = pressAt(a.t, a.depth);
      if (a.t > 0.34 + 0.18 + 0.46) { S.auto = null; S.target = 0; }
    }
  }
  const sw = SW[S.sel];
  const tgt = clamp(S.target, 0, sw.travel);
  const before = S.x;
  S.x = follow(S.x, tgt, dt, S.auto ? 0.0001 : (tgt >= S.x ? 0.045 : 0.075), calm);
  S.vel = (S.x - before) / Math.max(dt, 1e-3);
  const wantDir = S.vel < -0.15 ? 1 : S.vel > 0.15 ? 0 : S.dir;
  S.dir = follow(S.dir, wantDir, dt, 0.05, calm);

  // the gantry: lift, traverse, lower
  const goal = D.XS[S.sel];
  const near = Math.abs(S.xc - goal) < 0.6;
  S.liftT = near ? 0 : D.LIFT;
  S.lift = follow(S.lift, S.liftT, dt, 0.16, calm);
  const clear = calm || S.lift > D.LIFT * 0.85 || near;
  if (clear) S.xc = near ? goal : follow(S.xc, goal, dt, 0.32, calm);
  if (near) S.xc = goal;
  S.pad = S.lift > 1 ? 0 : S.x;

  // the specimens
  for (const s of sp) {
    const isSel = s.i === S.sel && S.lift < 1;
    const want = isSel ? S.x : 0;
    s.x = isSel ? S.x : follow(s.x, 0, dt, 0.06, calm);
    if (Math.abs(s.x) < 1e-3 && !isSel) s.x = 0;
    const ev = sense(s.sw, s.st, s.x, S.hall);
    if (ev) onEvent(s, ev);
    drawSpecimen(s, dt, calm);
  }
  drawGantry();
  drawCamera(dt, calm);

  const F = force(sw, S.x, S.dir);
  const nd = needleAt(F);
  if (nd !== S.nd) { S.nd = nd; needle.setAttribute("d", nd); }
  updateCursors(sw, F);
  say(F);

  const moving = S.auto || Math.abs(S.x - tgt) > 1e-3 || !near || Math.abs(S.lift - S.liftT) > 1e-2 || (!calm && S.idle > 2.2) || sp.some((s) => Math.abs(s.leafP - (s.st.down ? 1 : 0)) > 1e-3 || Math.abs(s.x) > 1e-3) || Math.abs(S.cam.cx - S.camT.cx) > 0.05 || Math.abs(S.cam.z - S.camT.z) > 1e-3;
  frame = visible && moving ? requestAnimationFrame(tick) : 0;
}
function kick() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }

function updateCursors(sw, F) {
  const x = S.x;
  const dotF = charts.force.querySelector("[data-dot]");
  if (dotF) { dotF.setAttribute("cx", f1(fx(x))); dotF.setAttribute("cy", f1(fy(F, 100))); }
  const dotS = charts.signal.querySelector("[data-dot]");
  const sig = signal(sw, x, S.hall);
  const isDown = sp[S.sel].st.down;
  if (dotS) {
    dotS.setAttribute("cx", f1(fx(x)));
    dotS.setAttribute("cy", f1(fy(sw.sense === "contact" ? (isDown ? 1 : 0) : sig, 1)));
    dotS.toggleAttribute("data-on", isDown);
  }
  const state = charts.signal.querySelector("[data-state]");
  if (state) state.textContent = isDown ? "KEY DOWN" : "key up";
  const th = charts.signal.querySelector("[data-thresh]");
  if (th && sw.sense === "hall") th.setAttribute("d", `M${CH.l} ${fy(hallSignal(S.hall.act), 1)}H${CH.r}`);
}

// ---------- the readout ----------
function say(F = force(SW[S.sel], S.x, S.dir)) {
  const sw = SW[S.sel];
  const down = sp[S.sel].st.down;
  const text = `${sw.name.toLowerCase()} · ${S.x.toFixed(2)} mm · ${F.toFixed(0)} cN · ${down ? "registered" : "not registered"}`;
  if (text !== S.said) { S.said = text; readout.textContent = text; }
  const out = $("[data-travel-out]"); if (out) out.textContent = `${S.x.toFixed(2)} mm`;
  const slider = $("[data-travel]"); if (slider && document.activeElement !== slider) slider.value = String(S.x);
}

// ---------- the tour ----------
function runTour() {
  const T = S.tour;
  T.on = S.idle > 2.2;
  if (!T.on) return;
  if (S.auto || T.wait > 0) return;
  if (!S.zoomed && !S.overview) { select(S.sel, { zoom: true }); T.wait = 1.1; return; }
  if (sp[S.sel].x > 0.01 || Math.abs(S.xc - D.XS[S.sel]) > 0.6 || S.lift > 1) return;
  // two presses on each switch, then on to the next. The Hall switch plays its Rapid Trigger walk first.
  if (T.step >= 2) { T.step = 0; T.wait = 0.3; selectNext(); return; }
  T.step++;
  T.wait = 0.45;
  if (SW[S.sel].id === "hall" && T.step === 1) hallWalk(); else press(SW[S.sel].travel - 0.3);
}
function selectNext() { select((S.sel + 1) % N, { zoom: !S.overview }); }
// The Rapid Trigger walk: down past the actuation point, a short ease and press without ever returning to the top, then
// a long run back up with a small ease and press near the bottom of the range, then home. [time in s, travel in mm]
function hallWalk() {
  S.auto = { t: 0, walk: [[0, 0], [0.55, 1.7], [0.95, 3.2], [1.35, 2.85], [1.75, 2.55], [2.15, 2.9], [2.55, 3.2], [3.2, 1.0], [3.6, 0.7], [3.95, 0.4], [4.3, 0.75], [4.65, 1.05], [5.3, 0]] };
}
// ---------- reader's hands ----------
let lastTouch = performance.now();
const touch = () => { lastTouch = performance.now(); S.idle = 0; S.tour.on = false; S.tour.step = 0; S.tour.wait = 0; };
function pointerIndex(e) {
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const sx = vb.x + ((e.clientX - r.left) / r.width) * vb.width;
  const o = D.P.origin, k = D.P.scale;
  const wx = (sx - o[0]) / (k * Math.sin((D.P.azimuth * Math.PI) / 180));
  let best = 0;
  D.XS.forEach((v, i) => { if (Math.abs(v - wx) < Math.abs(D.XS[best] - wx)) best = i; });
  return best;
}
let drag = null;
stage.addEventListener("pointerdown", (e) => {
  touch();
  const i = pointerIndex(e);
  if (i !== S.sel || !S.zoomed) { select(i, { zoom: true }); S.overview = false; return; }
  drag = { y: e.clientY, x0: S.target, moved: false, t: performance.now() };
  stage.setPointerCapture(e.pointerId);
  S.auto = null; S.held = true;
  kick();
});
stage.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const r = svg.getBoundingClientRect();
  const perMm = (r.height / D.H) * D.U * D.P.scale * Math.cos((D.P.elevation * Math.PI) / 180) * S.cam.z;
  const dy = e.clientY - drag.y;
  if (Math.abs(dy) > 3) drag.moved = true;
  S.target = clamp(drag.x0 + dy / Math.max(perMm, 20), 0, SW[S.sel].travel);
  touch(); kick();
});
const letGo = (e) => {
  if (!drag) return;
  const tap = !drag.moved && performance.now() - drag.t < 280;
  drag = null; S.held = false;
  if (tap) press(); else S.target = 0;
  touch(); kick();
};
stage.addEventListener("pointerup", letGo);
stage.addEventListener("pointercancel", letGo);

stage.addEventListener("keydown", (e) => {
  const sw = SW[S.sel];
  const step = e.shiftKey ? 0.5 : 0.1;
  let used = true;
  if (e.key === "ArrowDown") { S.auto = null; S.target = clamp(S.target + step, 0, sw.travel); }
  else if (e.key === "ArrowUp") { S.auto = null; S.target = clamp(S.target - step, 0, sw.travel); }
  else if (e.key === "ArrowRight") select((S.sel + 1) % N);
  else if (e.key === "ArrowLeft") select((S.sel + N - 1) % N);
  else if (e.key === "Home") { S.auto = null; S.target = 0; }
  else if (e.key === "End") { S.auto = null; S.target = sw.travel; }
  else if (e.key === " " || e.key === "Enter") press();
  else if (e.key === "Escape") { S.auto = null; S.target = 0; }
  else if (/^[1-7]$/.test(e.key)) select(+e.key - 1);
  else used = false;
  if (used) { e.preventDefault(); touch(); kick(); }
});

$$("[data-pick]").forEach((b) => b.addEventListener("click", () => { touch(); select(+b.dataset.pick, { zoom: true }); }));
$("[data-press]").addEventListener("click", () => { touch(); press(); });
$("[data-zoom]").addEventListener("click", () => { touch(); S.zoomed = !S.zoomed; S.overview = !S.zoomed; aimCamera(); showSwitch(); kick(); });
$("[data-travel]").addEventListener("input", (e) => { touch(); S.auto = null; S.target = +e.target.value; kick(); });
$("[data-travel]").addEventListener("change", () => { S.target = 0; kick(); });
$("[data-sound]").addEventListener("click", (e) => { soundOn = !soundOn; e.currentTarget.setAttribute("aria-pressed", String(soundOn)); e.currentTarget.textContent = soundOn ? "Sound on" : "Sound off"; if (soundOn) hit("clicky", "make"); });
const resetHall = () => { S.hallKey = `${S.hall.act}|${S.hall.rapid}|${S.hall.release}`; sp.find((s) => s.sw.id === "hall").st = newSense(); };
$("[data-hall-act]").addEventListener("input", (e) => { touch(); S.hall.act = +e.target.value; $("[data-hall-act-out]").textContent = `${(+e.target.value).toFixed(1)} mm`; resetHall(); kick(); });
$("[data-hall-sens]").addEventListener("input", (e) => { touch(); S.hall.press = S.hall.release = +e.target.value; $("[data-hall-sens-out]").textContent = `${(+e.target.value).toFixed(1)} mm`; resetHall(); kick(); });
$("[data-hall-rapid]").addEventListener("click", (e) => {
  touch(); S.hall.rapid = !S.hall.rapid; e.currentTarget.setAttribute("aria-pressed", String(S.hall.rapid));
  e.currentTarget.textContent = S.hall.rapid ? "Rapid Trigger on" : "Rapid Trigger off";
  resetHall(); kick();
});

new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) kick(); }, { rootMargin: "120px 0px" }).observe(stage);

S.hallKey = "";
setInterval(() => { if (!frame && visible && !still.matches && (performance.now() - lastTouch) / 1000 > 2.2) kick(); }, 600);
aimCamera();
S.cam = { cx: D.W / 2, cy: D.H / 2, z: 1 };
showSwitch();
kick();
})();
