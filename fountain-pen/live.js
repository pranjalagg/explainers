// Live layer. One simulation (model.mjs) drives everything on the page: the nib springs open with the load,
// ink moves from the cartridge through the feed to the paper, and each bubble that the air channel lets in
// is drawn on its way back to the reservoir.
const { P, PZ, TAPE_W, SPOOL_X, SPOOL_Z, R_ROLL, R_FLANGE, FACE_Y, WEIGHTS, CONTACT } = DATA;
const root = document.querySelector(".fp-stage");
const svg = root.querySelector("svg");
const q = (sel) => svg.querySelector(sel);
const FR = penFrame(CONTACT);
const CK = cameraOf(P).k;
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const toScreen = (p) => iso(p, P);
const stPt = ([s, t], y = 0) => toScreen(FR.w(s, t, y));
const stPath = (pts, close = false) => pathOf(pts.map((p) => stPt(p)), close);
const st3 = ([s, t, y]) => toScreen(FR.w(s, t, y));
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------- elements ----------
const nibEl = q("[data-nib]");
const strips = [...nibEl.querySelectorAll("[data-strip]")];
const tineLine = nibEl.querySelector("[data-tine-line]");
const plateFill = nibEl.querySelector("[data-plate-fill]");
const plateEdge = nibEl.querySelector("[data-plate-edge]");
const tipEl = nibEl.querySelector("[data-tip]");
const inkCart = q("[data-ink-cart]");
const surfaceEl = q("[data-surface]");
const slotEls = [...svg.querySelectorAll("[data-slot]")];
const channelEl = q("[data-channel]");
const flowEl = q("[data-flow-line]");
const bubblesEl = q("[data-bubbles]");
const plugEl = q("[data-plug]");
const penEl = q("[data-pen]");
const carrierEl = q("[data-carrier]");
const traceEls = [...svg.querySelectorAll("[data-trace-b]")];
const holesEl = q("[data-holes-path]");
const spokesEls = { take: q('[data-spokes="take"]'), feed: q('[data-spokes="feed"]') };
const weightEls = [...svg.querySelectorAll("[data-weight]")];

const ui = {
  play: document.querySelector("[data-play]"),
  pressure: document.querySelector("[data-pressure]"),
  pressureOut: document.querySelector("[data-pressure-out]"),
  speed: document.querySelector("[data-speed]"),
  speedOut: document.querySelector("[data-speed-out]"),
  vent: document.querySelector("[data-vent]"),
  width: document.querySelector("[data-width]"),
  widthLine: document.querySelector("[data-width-line]"),
  widthNote: document.querySelector("[data-width-note]"),
  flowDemand: document.querySelector("[data-flow-demand]"),
  flowSupply: document.querySelector("[data-flow-supply]"),
  bufferBar: document.querySelector("[data-buffer-bar]"),
  bufferOut: document.querySelector("[data-buffer-out]"),
  flowNote: document.querySelector("[data-flow-note]"),
  vacLine: document.querySelector("[data-vac-line]"),
  vacOut: document.querySelector("[data-vac-out]"),
  burpOut: document.querySelector("[data-burp-out]"),
  vacNote: document.querySelector("[data-vac-note]"),
};

// ---------- state ----------
const sim = initial();
const WEIGHT_N = WEIGHTS.count;
let weights = 1;                     // discs on the tray
let flex = 0, flexRate = 0;          // how far the nib has sprung, 0..1
let tape = 0;                        // mm of paper that has gone by
let reel = 0;
let hist = [];                       // the line as written: tape distance, width, ink share
let lastU = -1;
let bubbles = [];
let fillVolume = CART_VOLUME * CART.fill;
let level = levelFor(fillVolume);
let levelDrawn = null;
let flowPhase = 0;
let paused = still.matches;
let touring = !still.matches;
let tourClock = 0;
let ventByTour = false;
let lastSeg = null;
let visible = false, frame = 0, last = 0, idleTimer = 0;
const plugShown = { v: 0 };
const appear = weightEls.map(() => 0);
const chart = { t: 0, width: [], demand: [], supply: [], vac: [] };
const CHART_N = 200;
const XMIN = -150;

const TOUR = [
  { weights: 1, speed: 30, hold: 6 },
  { weights: 4, speed: 30, hold: 6 },
  { weights: 9, speed: 34, hold: 8 },
  { weights: 12, speed: 55, hold: 9 },
  { weights: 10, speed: 55, hold: 18, vent: false },
  { weights: 2, speed: 25, hold: 9 },
];
const TOUR_TOTAL = TOUR.reduce((a, b) => a + b.hold, 0);
function tourAt(t) {
  let u = t % TOUR_TOTAL;
  for (const seg of TOUR) {
    if (u < seg.hold) return seg;
    u -= seg.hold;
  }
  return TOUR[0];
}

// ---------- the nib ----------
function drawNib() {
  const spread = flex * NIB.maxSpread;
  const lift = flex * NIB.bend;
  const g = nibGeometry(spread, lift);
  g.strips.forEach((strip, i) => strips[i].setAttribute("d", pathOf(strip.pts.map(st3), true)));
  const outline = pathOf(g.outline.map(st3), true);
  tineLine.setAttribute("d", outline);
  const plate = [...g.plate.under, ...g.plate.top.slice().reverse()];
  const d = stPath(plate, true);
  plateFill.setAttribute("d", d);
  plateEdge.setAttribute("d", d);
  const c = st3([g.tip[0], g.tip[1], -(spread / 2 + 0.25)]);
  tipEl.setAttribute("cx", c[0].toFixed(1));
  tipEl.setAttribute("cy", c[1].toFixed(1));
  tipEl.setAttribute("r", (TIP.r * U * CK * 0.92).toFixed(2));
  return lift;
}

// ---------- ink in the pen ----------
function drawInk() {
  const frac = clampN(sim.buffer / FEED.buffer, 0, 1);
  const n = slotEls.length;
  slotEls.forEach((el, i) => {
    const fill = clampN(frac * n - (n - 1 - i), 0, 1);
    el.setAttribute("d", fill > 0.02 ? stPath(slotInk(i, fill), true) : "");
  });
  const spread = flex * NIB.maxSpread;
  const lift = flex * NIB.bend;
  const front = clampN(0.6 + (1 - sim.fed) * 22, 0.6, 34);
  const ink = channelInk(front, lift);
  channelEl.setAttribute("d", ink.length ? stPath(ink, true) : "");
  if (levelDrawn === null || Math.abs(levelDrawn - level) > 0.004) {
    levelDrawn = level;
    const poly = cartInk(level);
    inkCart.setAttribute("d", poly.length ? stPath(poly, true) : "");
    const edge = poly.filter(([s, t]) => Math.abs(upOf(s, t) - level) < 1e-3);
    surfaceEl.setAttribute("d", edge.length >= 2 ? stPath([edge[0], edge[edge.length - 1]]) : "");
  }
  void spread;
}

// Ink creeps along the channel toward the tip while the feed is delivering: dashes moving with the flow.
function drawFlow(dt) {
  const rate = sim.supply;
  flowPhase += rate * dt * 55;
  flowEl.setAttribute("stroke-dashoffset", (-(flowPhase % 60)).toFixed(2));
  flowEl.style.opacity = rate > 0.01 ? clampN(0.25 + rate * 1.6, 0, 1).toFixed(2) : "0";
}

// ---------- bubbles ----------
function pathLengths(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return cum;
}
function alongPath(pts, cum, u) {
  const total = cum[cum.length - 1];
  const x = clampN(u, 0, total);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < x) i++;
  const k = (x - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
  const a = pts[i - 1], b = pts[i];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  return { p: [a[0] + dx * k, a[1] + dy * k], d: [dx / len, dy / len] };
}
function capsule(p, d, len, r) {
  const a = [p[0] - d[0] * len / 2, p[1] - d[1] * len / 2];
  const b = [p[0] + d[0] * len / 2, p[1] + d[1] * len / 2];
  const base = Math.atan2(d[1], d[0]);
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = base - Math.PI / 2 + (Math.PI * i) / 8; pts.push([b[0] + r * Math.cos(t), b[1] + r * Math.sin(t)]); }
  for (let i = 0; i <= 8; i++) { const t = base + Math.PI / 2 + (Math.PI * i) / 8; pts.push([a[0] + r * Math.cos(t), a[1] + r * Math.sin(t)]); }
  return pts;
}
function drawBubbles(dt) {
  for (const b of bubbles) b.u += dt * 26;
  bubbles = bubbles.filter((b) => b.u < b.total + 1);
  const html = bubbles.map((b) => {
    const { p, d } = alongPath(b.pts, b.cum, b.u);
    const inLumen = p[0] < PIN_END - 0.4;
    const poly = inLumen ? capsule(p, d, 2.6, 0.5) : capsule(p, d, 0.01, 1.0);
    const fade = clampN((b.total - b.u) / 1.2, 0, 1);
    return `<path class="fp-bubble" style="opacity:${fade.toFixed(2)}" d="${stPath(poly, true)}"/>`;
  });
  bubblesEl.innerHTML = html.join("");
}
function spawnBubble() {
  const pts = bubblePath(level);
  const cum = pathLengths(pts);
  bubbles.push({ pts, cum, u: 0, total: cum[cum.length - 1] });
}

// ---------- the paper ----------
function tipX() {
  return CONTACT[0] + flex * NIB.bend * NM[0] * U;
}
function drawTrace() {
  const tx = tipX();
  const buckets = [[], [], [], [], [], []];
  let run = null;
  let runBucket = -1;
  const flush = () => { if (run && run.length > 1) buckets[runBucket].push(run); run = null; };
  for (const h of hist) {
    const x = tx - (tape - h.u) * U;
    if (x < XMIN) continue;
    const b = clampN(Math.round(h.a * 5), 0, 5);
    if (b !== runBucket) {
      const prev = run && run[run.length - 1];
      flush();
      run = prev ? [prev] : [];
      runBucket = b;
    }
    run.push({ x, w: h.w * U });
  }
  flush();
  buckets.forEach((runs, i) => {
    const d = runs.map((r) => {
      const top = r.map((s) => toScreen([s.x, s.w / 2, PZ + 0.05]));
      const bottom = r.map((s) => toScreen([s.x, -s.w / 2, PZ + 0.05])).reverse();
      return pathOf([...top, ...bottom], true);
    }).join("");
    traceEls[i].setAttribute("d", d);
  });
}
function pushTrace() {
  if (lastU < 0 || tape - lastU >= 0.5) {
    hist.push({ u: tape, w: sim.width, a: sim.fed });
    lastU = tape;
    const limit = tape - (tipX() - XMIN) / U - 2;
    while (hist.length > 2 && hist[1].u < limit) hist.shift();
  }
}
function drawHoles() {
  const gap = 12;
  const off = (tape * U) % gap;
  const pts = [];
  for (let x = -SPOOL_X + 8 - off + gap; x < SPOOL_X - 8; x += gap) {
    for (const y of [-TAPE_W / 2 + 5, TAPE_W / 2 - 5]) {
      const s = toScreen([x, y, PZ + 0.02]);
      pts.push(`M${s[0].toFixed(1)} ${s[1].toFixed(1)}h.01`);
    }
  }
  holesEl.setAttribute("d", pts.join(""));
}
function drawReels() {
  for (const kind of ["take", "feed"]) {
    const xc = kind === "take" ? -SPOOL_X : SPOOL_X;
    const phase = -reel;
    const polys = [];
    for (let i = 0; i < 6; i++) {
      const a = phase + (i * Math.PI) / 3;
      const c = Math.cos(a), s = Math.sin(a);
      const corner = (r, h) => toScreen([xc + r * c - h * s, FACE_Y, SPOOL_Z + r * s + h * c]);
      polys.push(pathOf([corner(7.4, -2), corner(R_FLANGE - 4, -2), corner(R_FLANGE - 4, 2), corner(7.4, 2)], true));
    }
    const mark = toScreen([xc + 16 * Math.cos(phase) - 0 * Math.sin(phase), FACE_Y, SPOOL_Z + 16 * Math.sin(phase)]);
    spokesEls[kind].querySelector("path").setAttribute("d", polys.join(""));
    const dot = spokesEls[kind].querySelector("circle");
    dot.setAttribute("cx", mark[0].toFixed(1));
    dot.setAttribute("cy", mark[1].toFixed(1));
  }
}

// ---------- weights ----------
function drawWeights(dt, calm) {
  weightEls.forEach((el, i) => {
    const target = i < weights ? 1 : 0;
    appear[i] += (target - appear[i]) * (calm ? 1 : 1 - Math.exp(-dt / 0.09));
    if (Math.abs(target - appear[i]) < 0.004) appear[i] = target;
    const a = appear[i];
    el.style.display = a < 0.01 ? "none" : "";
    el.style.opacity = a.toFixed(2);
    el.setAttribute("transform", translateAlong(P, [0, 0, (1 - a) * 22]));
  });
}

// ---------- the step ----------
function pressureOf() { return weights * WEIGHTS.step; }
let widthNow = NIB.tipping;
function advance(dt, calm) {
  if (touring && !calm) {
    tourClock += dt;
    const seg = tourAt(tourClock);
    if (seg.weights !== weights) setWeights(seg.weights, true);
    if (seg !== lastSeg) {
      lastSeg = seg;
      const wantVent = seg.vent !== false;
      if (sim.vented !== wantVent) { sim.vented = wantVent; ventByTour = !wantVent; }
    }
    sim.speed += (seg.speed - sim.speed) * (1 - Math.exp(-dt / 0.6));
  }
  // The nib is a spring loaded by the weights, lightly damped.
  const target = clampN((pressureOf() * NIB.perGram) / NIB.maxSpread, 0, 1);
  if (calm) { flex = target; flexRate = 0; }
  else {
    const stiff = 260, drag = 22;
    for (let i = 0; i < 4; i++) { flexRate += ((target - flex) * stiff - flexRate * drag) * dt / 4; flex += flexRate * dt / 4; }
    flex = clampN(flex, 0, 1.04);
  }
  sim.pressure = pressureOf();
  sim.width = NIB.tipping + clampN(flex, 0, 1) * NIB.maxSpread;
  if (!paused) {
    const made = step(sim, dt, sim.width);
    for (let i = 0; i < made; i++) spawnBubble();
    const moved = sim.speed * dt;
    tape += moved;
    reel += moved * U / R_ROLL;
    fillVolume = CART_VOLUME * CART.fill - sim.drawn;
    level = levelFor(fillVolume);
    pushTrace();
  }
}
// ---------- drawing ----------
let pendingText = "";
function draw(dt) {
  const lift = drawNib();
  penEl.setAttribute("transform", translateAlong(P, [0, 0, -lift * NM[2] * U]));
  carrierEl.setAttribute("transform", translateAlong(P, [0, 0, -lift * NM[2] * U]));
  drawInk();
  drawFlow(dt);
  drawBubbles(dt);
  drawTrace();
  drawHoles();
  drawReels();
  plugEl.style.opacity = plugShown.v.toFixed(2);
  plugEl.style.display = plugShown.v < 0.01 ? "none" : "";
}

function say() {
  const text = `${sim.width.toFixed(2)} mm line · ${pressureOf()} gf · ${sim.fed >= 0.97 ? "inking fully" : "ink " + Math.round(sim.fed * 100) + "%"}`;
  if (text !== pendingText) { pendingText = text; readout.textContent = text; }
  root.setAttribute("aria-valuetext", text);
}

// ---------- panel ----------
function pushChart(dt) {
  chart.t += dt;
  if (chart.t < 0.1) return;
  chart.t -= 0.1;
  const add = (arr, v) => { arr.push(v); if (arr.length > CHART_N) arr.shift(); };
  add(chart.width, sim.width);
  add(chart.demand, sim.demand);
  add(chart.supply, sim.supply);
  add(chart.vac, sim.vac);
}
const poly = (arr, max, h = 60, w = 200) => arr.map((v, i) => `${((i / (CHART_N - 1)) * w).toFixed(1)},${(h - 2 - clampN(v / max, 0, 1) * (h - 4)).toFixed(1)}`).join(" ");
function drawPanel() {
  ui.widthLine.setAttribute("points", poly(chart.width, NIB.tipping + NIB.maxSpread));
  ui.flowDemand.setAttribute("points", poly(chart.demand, 1.6));
  ui.flowSupply.setAttribute("points", poly(chart.supply, 1.6));
  ui.vacLine.setAttribute("points", poly(chart.vac, P_INK));
  ui.width.textContent = `${sim.width.toFixed(2)} mm`;
  ui.widthNote.textContent = `Tipping ${NIB.tipping} mm + slit open ${(flex * NIB.maxSpread).toFixed(2)} mm`;
  const frac = clampN(sim.buffer / FEED.buffer, 0, 1);
  ui.bufferBar.style.width = `${(frac * 100).toFixed(0)}%`;
  ui.bufferOut.textContent = `${sim.buffer.toFixed(1)} of ${FEED.buffer} µL in the fins`;
  ui.flowNote.textContent = `Paper takes ${sim.demand.toFixed(2)} µL/s, the feed gives ${sim.supply.toFixed(2)} µL/s`;
  ui.vacOut.textContent = `${Math.round(sim.vac)} Pa below air`;
  ui.burpOut.textContent = `${sim.burps} bubble${sim.burps === 1 ? "" : "s"} let in`;
  ui.vacNote.textContent = sim.vented
    ? `A bubble gets in at ${Math.round(P_AIR)} Pa, about every ${(BURP_VOLUME).toFixed(2)} µL of ink`
    : `Air channel sealed: suction climbs toward ${Math.round(P_INK)} Pa and the feed stops pulling`;
  ui.pressureOut.textContent = `${pressureOf()} gf`;
  ui.speedOut.textContent = `${Math.round(sim.speed)} mm/s`;
  ui.play.textContent = paused ? "Write" : "Pause";
  ui.play.setAttribute("aria-pressed", String(!paused));
  ui.vent.setAttribute("aria-pressed", String(!sim.vented));
  ui.vent.textContent = sim.vented ? "Seal the air channel" : "Open the air channel";
  if (document.activeElement !== ui.pressure) ui.pressure.value = String(weights);
  if (document.activeElement !== ui.speed) ui.speed.value = String(Math.round(sim.speed));
}

// ---------- loop ----------
let acc = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  const calm = false;
  advance(dt, calm);
  drawWeights(dt, calm);
  const target = sim.vented ? 0 : 1;
  plugShown.v += (target - plugShown.v) * (1 - Math.exp(-dt / 0.12));
  if (Math.abs(target - plugShown.v) < 0.01) plugShown.v = target;
  draw(dt);
  pushChart(dt);
  acc += dt;
  if (acc > 0.08) { acc = 0; say(); drawPanel(); }
  const settled = paused && !touring && Math.abs(flexRate) < 0.001 && bubbles.length === 0 && appear.every((a, i) => a === (i < weights ? 1 : 0)) && plugShown.v === (sim.vented ? 0 : 1);
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };

function setWeights(n, fromTour = false) {
  weights = clampN(Math.round(n), 0, WEIGHT_N);
  if (!fromTour) quiet();
  run();
}
function quiet() {
  touring = false;
  if (ventByTour) { sim.vented = true; ventByTour = false; }
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches && !paused && sim.vented; tourClock = 0; lastSeg = null; run(); }, 3600);
}

// ---------- input ----------
root.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clampN(((event.clientX - box.left) / box.width - 0.18) / 0.64, 0, 1);
  setWeights(share * WEIGHT_N);
});
root.addEventListener("keydown", (event) => {
  const keys = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
  if (event.key in keys) { event.preventDefault(); setWeights(weights + keys[event.key]); return; }
  if (event.key === "Home") { event.preventDefault(); setWeights(0); return; }
  if (event.key === "End") { event.preventDefault(); setWeights(WEIGHT_N); return; }
  if (event.key === " ") { event.preventDefault(); togglePlay(); return; }
  if (event.key === "v" || event.key === "V") { toggleVent(); return; }
  if (event.key === "+" || event.key === "=") { sim.speed = Math.min(SPEED.max, sim.speed + 10); quiet(); run(); return; }
  if (event.key === "-") { sim.speed = Math.max(SPEED.min, sim.speed - 10); quiet(); run(); }
});
function togglePlay() {
  paused = !paused;
  touring = !paused && !still.matches;
  tourClock = 0;
  run();
}
function toggleVent() {
  const next = !sim.vented;
  quiet();
  sim.vented = next;
  run();
}
ui.play.addEventListener("click", togglePlay);
ui.vent.addEventListener("click", toggleVent);
ui.pressure.addEventListener("input", () => setWeights(Number(ui.pressure.value)));
ui.speed.addEventListener("input", () => { sim.speed = Number(ui.speed.value); quiet(); run(); });
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(root);

// ---------- start ----------
// Write for a while before the first frame, so the paper already carries a line and the fins are in a steady state.
(function preroll() {
  sim.speed = 30;
  const dt = 1 / 30;
  let t = 0;
  for (let i = 0; i < 30 * 14; i++) {
    t += dt;
    if (!still.matches) {
      const seg = tourAt(t);
      weights = seg.weights;
      sim.speed = seg.speed;
    }
    const target = clampN((weights * WEIGHTS.step * NIB.perGram) / NIB.maxSpread, 0, 1);
    flex += (target - flex) * Math.min(1, dt / 0.08);
    sim.pressure = weights * WEIGHTS.step;
    sim.width = NIB.tipping + flex * NIB.maxSpread;
    step(sim, dt, sim.width);
    tape += sim.speed * dt;
    reel += sim.speed * dt * U / R_ROLL;
    pushTrace();
    pushChart(dt);
  }
  tourClock = t;
  fillVolume = CART_VOLUME * CART.fill - sim.drawn;
  level = levelFor(fillVolume);
  weightEls.forEach((el, i) => { appear[i] = i < weights ? 1 : 0; });
  sim.burps = 0;
  if (still.matches) { paused = true; weights = 4; flex = clampN((weights * WEIGHTS.step * NIB.perGram) / NIB.maxSpread, 0, 1); }
})();
draw(1 / 60);
drawWeights(1 / 60, true);
plugEl.style.display = "none";
say();
drawPanel();
