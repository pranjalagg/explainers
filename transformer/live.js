// Live layer. One clock T drives a forward pass: stage = floor(T), progress = fract(T). Everything on the
// line is redrawn from the model's numbers for the current context (M.forward) and that clock.
const { P, KNOB, GAUGE } = DATA;
const root = document.querySelector(".tf-stage");
const svg = root.querySelector("svg");
const $ = (sel, el = svg) => el.querySelector(sel);
const $$ = (sel, el = svg) => [...el.querySelectorAll(sel)];
const NS = "http://www.w3.org/2000/svg";
const still = matchMedia("(prefers-reduced-motion: reduce)");

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const W = (x, y, z) => iso([x, y, z], P);
const fix = (n) => n.toFixed(1);
const poly = (pts, close = false) => pathOf(pts, close);
const shift = (dx, dy, dz) => { const [a, b] = axisVector(P, [dx, dy, dz]); return `translate(${a.toFixed(2)} ${b.toFixed(2)})`; };

const N = L.N;
const DECK_TOP = L.MOD.z + L.MOD.h;
const CARD_TOP = DECK_TOP + 6.5;
const STAGES = [
  { name: "Words", short: "01" },
  { name: "Embed", short: "02" },
  { name: "Attention 1", short: "03" },
  { name: "Memory 1", short: "04" },
  { name: "Attention 2", short: "05" },
  { name: "Memory 2", short: "06" },
  { name: "Unembed", short: "07" },
  { name: "Sample", short: "08" },
];
const DUR = [1.8, 2.2, 3.0, 3.0, 3.0, 3.0, 2.6, 6.0]; // seconds per stage
const TOTAL_STAGES = 8;
const ACT_REF = [12.4, 6.7]; // activation that counts as a fully open drawer, per layer
const REF_TEMP = 1;

// ---- state ------------------------------------------------------------------------------------------------
const S = {
  tokens: M.parse(M.PRESETS[0].tokens),
  first: 0, // lanes below this are finished and cached; the others run the forward pass
  T: 0,
  playing: !still.matches,
  sel: 0,
  temp: 1,
  u: 0.5,
  hover: false,
  run: null,
  probs: null,
  pick: 0,
  presetIndex: 0,
  shown: null, // probabilities as drawn on the ruler, eased toward S.probs
  committed: false,
  drop: new Array(N).fill(0), // drop-in animation for a new slug, 1 -> 0
  fullNote: false,
  tour: true,
};
function recompute() {
  S.run = M.forward(S.tokens);
  const last = S.tokens.length - 1;
  S.probs = M.softmax(S.run.logits[last], S.temp);
  S.pick = M.pick(S.probs, S.u);
}

// ---- svg lookups --------------------------------------------------------------------------------------------
const lanes = $$("[data-lane]").map((el, i) => {
  const slots = {};
  $$("[data-slot]", el).forEach((s) => (slots[s.dataset.slot] = s));
  const tray = $("[data-tray]", el);
  const banks = {};
  $$("[data-bank]", tray).forEach((p) => ((banks[p.dataset.bank] ??= {})[p.dataset.part] = p));
  const portals = [0, 1, 2, 3].map((m) => $(`[data-portal="${m},${i}"]`, el));
  const cards = [0, 2].map((m) => [0, 1].map((h) => ({ card: $(`[data-card="${m},${i},${h}"]`, el), lamp: $(`[data-lamp="${m},${i},${h}"]`, el) })));
  const drawers = [1, 3].map((m) => $(`[data-drawers="${m},${i}"]`, el));
  const order = ["b0", "f0", "b1", "f1", "b2", "f2", "b3", "f3", "r"].map((n) => slots[n]);
  return { el, slots, tray, banks, portals, cards, drawers, order, trayAt: null, cache: {} };
});
const slugText = $$("[data-slug]");
const slugGroup = $$("[data-slug-group]");
const tileEls = $$("[data-tile]");
const layer = (n) => $(`[data-layer="${n}"]`);
const L_RULER = layer("ruler"), L_CARRIAGE = layer("carriage"), L_CORDS = layer("cords"), L_MARBLE = layer("marble"), L_RETURN = layer("return");

// ---- panel lookups ------------------------------------------------------------------------------------------
const readout = document.querySelector("[data-readout]");
const live = document.querySelector("[data-live]");
const playBtn = document.querySelector("[data-play]");
const scrub = document.querySelector("[data-scrub]");
const stepBtns = $$("[data-stage]", document);
const tempInput = document.querySelector("[data-temp]");
const tempOut = document.querySelector("[data-temp-out]");

// ---- once-built art: carriage, dropper, marble, return slug ---------------------------------------------------
const carriage = (() => {
  const g = document.createElementNS(NS, "g");
  const body = slabOf({ x: -9, y: L.READ_Y - 4.5, w: 18, d: 9, r: 1.2 }, 25, 12, P, 4, 0.4);
  g.innerHTML = solidSvg(body, { tone: "hi", className: "tf-carriage" }) +
    `<g class="tf-logits" transform="${sideMatrix([-9, L.READ_Y + 4.5], 37, P, "left")}"><rect class="tf-screen" x="1" y="1.2" width="16" height="8.8" rx="0.5"/><path class="tf-rule" d="M1 6H17"/><path class="tf-bar tf-logit-bars" d=""/></g>`;
  L_CARRIAGE.appendChild(g);
  return { g, bars: $(".tf-logit-bars", g), x: null };
})();

const dropper = (() => {
  const g = document.createElementNS(NS, "g");
  g.innerHTML = solidSvg(cylinderOf(0, L.RULER_Y, 5.4, 46, 5, 20), { tone: "mid", className: "tf-hopper" }) + solidSvg(cylinderOf(0, L.RULER_Y, 2.2, 40, 6, 14), { tone: "lo", crease: "none" });
  L_MARBLE.appendChild(g);
  return g;
})();
function cylinderOf(cx, cy, r, z, h, steps) { return cylinder(cx, cy, r, z, h, P, steps); }

const marble = (() => {
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "tf-marble");
  g.innerHTML = `<ellipse class="tf-shadow" rx="4" ry="2" cx="0" cy="0"/><circle class="tf-ball" r="3.1" cx="0" cy="0"/><path class="tf-glint" d="M-1.7 -1.2 a2.2 2.2 0 0 1 2 -1.5"/>`;
  L_MARBLE.appendChild(g);
  return { g, ball: $(".tf-ball", g), shadow: $(".tf-shadow", g), glint: $(".tf-glint", g) };
})();

const retSlug = (() => {
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "tf-slug tf-ret");
  g.innerHTML = solidSvg(slabOf({ x: -8.5, y: -4.5, w: 17, d: 9, r: 1 }, 0, 8, P, 3, 0.4), { tone: "hi", className: "tf-slug-body" }) +
    `<text class="iso-face-text tf-text" data-tone="hi" transform="${sideMatrix([-8.5, 4.5], 8, P, "left")}" x="8.5" y="5.2" font-size="4.6" text-anchor="middle"></text>`;
  L_RETURN.appendChild(g);
  return { g, text: $("text", g) };
})();

// ---- timeline -------------------------------------------------------------------------------------------------
const stageOf = (T) => Math.min(TOTAL_STAGES - 1, Math.floor(T));
const progress = (T) => (T >= TOTAL_STAGES ? 1 : T - Math.floor(T));
const fromT = (stage, p = 0) => stage + p;
const secondsUntil = (a, b) => { let s = 0; for (let i = Math.floor(a); i < b; i++) s += DUR[Math.min(7, i)] * (Math.min(b, i + 1) - Math.max(a, i)); return s; };

// Where a running lane's tray is, and what it shows.
function trayState(T) {
  const s = stageOf(T), p = progress(T);
  if (T >= TOTAL_STAGES) return { y: L.DONE_Y, vis: 1, s: 7, p: 1 };
  if (s === 0) return { y: L.STICK_Y + 6, vis: 0, s, p };
  if (s === 1) return { y: lerp(L.STICK_Y + 5, L.STAGE_Y[1], smooth(0.05, 0.55, p)), vis: smooth(0, 0.2, p), s, p };
  const from = L.STAGE_Y[s - 1], to = L.STAGE_Y[s];
  return { y: lerp(from, to, smooth(0, s === 7 ? 0.1 : 0.4, p)), vis: 1, s, p };
}
const STEP_SNAP = [null, 0, 1, 2, 3, 4]; // stage -> index of x[] the step ends at, for stages 1..5
function bankVec(vec, b) { const o = M.bank(vec); return o[b]; }

// ---- figure: one frame ----------------------------------------------------------------------------------------
const lastLane = () => S.tokens.length - 1;
function laneRunning(i) { return i >= S.first && i < S.tokens.length; }

function drawLane(i, T) {
  const ln = lanes[i];
  const n = S.tokens.length;
  const exists = i < n;
  ln.el.style.display = exists ? "" : "none";
  if (!exists) return;
  const running = laneRunning(i);
  const st = running ? trayState(T) : { y: L.DONE_Y, vis: 1, s: 7, p: 1 };
  const x = S.run.x;
  const stage = st.s;
  // tray position and painter slot
  ln.tray.setAttribute("transform", shift(0, st.y, 0));
  ln.tray.style.opacity = st.vis.toFixed(3);
  ln.tray.style.display = st.vis < 0.01 ? "none" : "";
  const idx = trayIndex(st.y);
  if (ln.trayAt !== idx) { ln.trayAt = idx; ln.el.insertBefore(ln.tray, idx < 0 ? null : ln.order[idx]); }
  ln.tray.toggleAttribute("data-lit", i === S.sel);
  // bank values
  let oldV, newV, w, op;
  const zero = new Array(M.D_MODEL).fill(0);
  if (!running || T >= TOTAL_STAGES || stage >= 6) { oldV = newV = x[4][i]; w = 1; op = 0; }
  else if (stage === 1) { oldV = zero; newV = x[0][i]; w = smooth(0.1, 0.6, st.p); op = 1 - smooth(0.7, 1, st.p); }
  else if (stage === 0) { oldV = newV = zero; w = 1; op = 0; }
  else { oldV = x[stage - 2][i]; newV = x[stage - 1][i]; w = smooth(0.3, 0.72, st.p); op = smooth(0.22, 0.4, st.p) * (1 - smooth(0.82, 1, st.p)); }
  const key = `${stage}|${w.toFixed(3)}|${i}|${S.tokens.length}|${S.tokens[i]}|${S.run.x[4][i][26 - 1].toFixed(3)}`;
  if (ln.cache.bars !== key || ln.cache.runKey !== S.runKey) {
    ln.cache.bars = key; ln.cache.runKey = S.runKey;
    for (const b of ["T", "A", "O"]) {
      const o = bankVec(oldV, b), nv = bankVec(newV, b);
      const cur = nv.map((v, j) => o[j] + w * (v - o[j]));
      const pp = L.bankPaths(b, o, cur);
      ln.banks[b].base.setAttribute("d", pp.base + pp.grow);
      ln.banks[b].grow.setAttribute("d", pp.grow);
      ln.banks[b].cut.setAttribute("d", pp.cut);
    }
  }
  for (const b of ["T", "A", "O"]) { ln.banks[b].grow.style.opacity = op.toFixed(2); ln.banks[b].cut.style.opacity = op.toFixed(2); }
  // portals: lit while this lane's tray is inside the module
  for (let m = 0; m < 4; m++) {
    const inside = running && T < TOTAL_STAGES && stage === m + 2 && st.p > 0.18 && st.p < 0.95;
    const deck = $(".tf-deck", ln.portals[m]);
    if (deck) deck.toggleAttribute("data-lit", inside);
  }
  // reader beam
  // cards (the key/value cache) and lamps
  for (let a = 0; a < 2; a++) {
    const m = a * 2;
    const layerIdx = a;
    let ins;
    if (!running) ins = 1;
    else if (T >= TOTAL_STAGES) ins = 1;
    else if (stage > m + 2) ins = 1;
    else if (stage === m + 2) ins = smooth(0.3, 0.55, st.p);
    else ins = 0;
    for (let h = 0; h < 2; h++) {
      const c = ln.cards[a][h];
      if (!c.card) continue;
      c.card.style.display = ins < 0.01 ? "none" : "";
      c.card.setAttribute("transform", ins >= 0.999 ? "" : shift(0, 0, -(1 - ins) * 9));
      c.card.style.opacity = ins.toFixed(2);
      const sel = S.sel;
      const wgt = i <= sel && sel < n ? S.run.attn[layerIdx].heads[h].weights[sel][i] : 0;
      const live = ins > 0.9 ? wgt : 0;
      c.lamp.setAttribute("r", (0.7 + 1.1 * live).toFixed(2));
      c.lamp.style.opacity = (0.15 + 0.85 * live).toFixed(2);
    }
  }
  // memory drawers
  for (let a = 0; a < 2; a++) {
    const m = a * 2 + 1;
    const open = running && T < TOTAL_STAGES && stage === m + 2 ? smooth(0.25, 0.6, st.p) * (1 - smooth(0.82, 1, st.p)) : 0;
    const acts = S.run.mlp[a].act[i];
    const key2 = open < 0.003 ? "closed" : `${open.toFixed(3)}`;
    if (ln.cache[`d${m}`] !== key2 + S.runKey) {
      ln.cache[`d${m}`] = key2 + S.runKey;
      drawDrawers(ln.drawers[a], i, m, a, acts.map((v) => clamp(v / ACT_REF[a]) * open));
    }
  }
}

function trayIndex(y) {
  for (let m = 0; m < 4; m++) {
    const yc = L.MODS[m];
    if (y < yc - 11) return m * 2; // tray is behind this module
    if (y <= yc + 11) return m * 2 + 1; // tray is under it
  }
  if (y <= L.READ_Y + 10) return 8;
  return -1;
}

// Drawers slide out of the deck's front face (y = yc + 7). open[k] in 0..1.
function drawDrawers(g, lane, m, layerIdx, open) {
  const yc = L.MODS[m], x0 = L.laneX(lane) - L.MOD.w / 2, yf = yc + L.MOD.d / 2;
  const cells = L.drawerCells(open.length);
  const zTop = DECK_TOP;
  let html = "";
  cells.forEach((c, k) => {
    const o = open[k];
    if (o < 0.02) return;
    const d = 4.6 * o;
    const xa = x0 + c.u, xb = xa + c.w, za = zTop - c.v, zb = za - c.h;
    const A = W(xa, yf, za), B = W(xb, yf, za), C = W(xb, yf, zb), Dd = W(xa, yf, zb);
    const A2 = W(xa, yf + d, za), B2 = W(xb, yf + d, za), C2 = W(xb, yf + d, zb), D2 = W(xa, yf + d, zb);
    html += `<path class="tf-d-side" d="${poly([B, B2, C2, C], true)}"/><path class="tf-d-top" d="${poly([A, B, B2, A2], true)}"/><path class="tf-d-front" data-on="${o > 0.35 ? 1 : 0}" d="${poly([A2, B2, C2, D2], true)}"/>`;
  });
  g.innerHTML = html;
}

// ---- cords: attention for the selected lane ---------------------------------------------------------------------
const cordCache = { key: "" };
function drawCords(T) {
  const s = stageOf(T), p = progress(T);
  const active = T < TOTAL_STAGES && (s === 2 || s === 4);
  if (!active || p < 0.12 || S.sel >= S.tokens.length) { if (cordCache.key !== "off") { L_CORDS.innerHTML = ""; cordCache.key = "off"; } return; }
  const a = s === 2 ? 0 : 1, m = a * 2;
  const sel = S.sel;
  const env = smooth(0.12, 0.3, p) * (1 - smooth(0.9, 1, p));
  const yc = L.MODS[m] + 0.7;
  let html = "";
  const beads = [];
  const t = performance.now() / 1000;
  for (let h = 1; h >= 0; h--) {
    const wts = S.run.attn[a].heads[h].weights[sel];
    const dx = h ? 5 : -5;
    for (let j = 0; j <= sel; j++) {
      const wgt = wts[j];
      if (wgt < 0.015) continue;
      const xa = L.laneX(j) + dx, xb = L.laneX(sel) + dx;
      const span = Math.abs(sel - j);
      const pts = [];
      if (span === 0) {
        for (let q = 0; q <= 16; q++) { const th = (q / 16) * Math.PI * 2 - Math.PI / 2; pts.push(W(xa + 3.4 * Math.cos(th), yc, CARD_TOP + 3.6 + 3.6 * Math.sin(th))); }
      } else {
        const rise = Math.min(24, 5 + 3.4 * span);
        for (let q = 0; q <= 20; q++) { const f = q / 20; pts.push(W(lerp(xa, xb, f), yc, CARD_TOP + 0.4 + rise * 4 * f * (1 - f))); }
      }
      html += `<path class="tf-cord" data-head="${h}" style="stroke-width:${(0.35 + 2.9 * wgt).toFixed(2)};opacity:${(env * (0.25 + 0.75 * clamp(wgt * 1.6))).toFixed(2)}" d="${poly(pts)}"/>`;
      if (wgt > 0.08) beads.push({ pts, h, wgt, j });
    }
  }
  for (const b of beads) {
    const count = Math.ceil(b.wgt * 3);
    for (let q = 0; q < count; q++) {
      const f = (((t * 0.55 + q / count + b.j * 0.13) % 1) + 1) % 1;
      const at = b.pts[Math.min(b.pts.length - 1, Math.floor(f * (b.pts.length - 1)))];
      html += `<circle class="tf-bead" data-head="${b.h}" r="${(0.6 + 1.3 * b.wgt).toFixed(2)}" cx="${fix(at[0])}" cy="${fix(at[1])}" style="opacity:${env.toFixed(2)}"/>`;
    }
  }
  L_CORDS.innerHTML = html;
  cordCache.key = "on";
}

// ---- reader, ruler, marble and the return path -----------------------------------------------------------------
const RULER = { x0: -80, w: 160 };
function stage7Phases(p) {
  return {
    tray: smooth(0, 0.1, p),
    drop: smooth(0.1, 0.22, p),
    fall: clamp((p - 0.22) / 0.12),
    lit: smooth(0.34, 0.44, p),
    slug: smooth(0.46, 0.54, p),
    ride: clamp((p - 0.54) / 0.38),
    land: smooth(0.9, 1, p),
  };
}
function drawReader(T) {
  const s = stageOf(T), p = progress(T);
  const last = lastLane();
  const reading = T >= TOTAL_STAGES || s >= 6;
  const run = laneRunning(last);
  // carriage rides to the last lane
  const targetX = L.laneX(last);
  carriage.x = carriage.x === null ? targetX : lerp(carriage.x, targetX, 0.18);
  carriage.g.setAttribute("transform", shift(carriage.x, 0, 0));
  const showC = !run || reading;
  carriage.g.style.opacity = showC ? "1" : "0.5";
  const logits = S.run.logits[last];
  const rise = !run || s > 6 || T >= TOTAL_STAGES ? 1 : s === 6 ? smooth(0.25, 0.6, p) : 0;
  const ckey = `${rise.toFixed(3)}|${S.runKey}`;
  if (carriage.key !== ckey) {
    carriage.key = ckey;
    const o = logits.map(() => 0);
    const cur = logits.map((v) => v * rise);
    const bars = L.bankPaths("O", o, cur);
    // face of the carriage is 18 wide: scale from the plate's 15
    carriage.bars.setAttribute("d", bars.base + bars.grow);
    carriage.bars.setAttribute("transform", `translate(1.5 0) scale(1 1.15) translate(0 -1.4)`);
  }
  drawRuler(T, rise);
}

let rulerKey = "";
function rulerLayout(probs) {
  const out = [];
  let x = RULER.x0;
  probs.forEach((pr, i) => {
    const w = Math.max(0.8, pr * RULER.w);
    out.push({ i, x0: x, x1: x + w, p: pr });
    x += pr * RULER.w;
  });
  return out;
}
function drawRuler(T, rise) {
  const s = stageOf(T), p = progress(T);
  const shown = S.shown || S.probs;
  const sampling = T >= TOTAL_STAGES || s === 7;
  const ph = s === 7 && T < TOTAL_STAGES ? stage7Phases(p) : null;
  const litTile = sampling && (T >= TOTAL_STAGES || ph.lit > 0.5) ? S.pick : -1;
  const key = `${rise.toFixed(3)}|${litTile}|${shown.map((v) => v.toFixed(3)).join(",")}`;
  if (key !== rulerKey) {
    rulerKey = key;
    const segs = rulerLayout(shown);
    let html = "";
    for (const sg of segs) {
      const hgt = (0.8 + 7.5 * sg.p) * rise;
      if (hgt < 0.15) continue;
      const wide = sg.x1 - sg.x0;
      const plan = { x: sg.x0 + 0.25, y: L.RULER_Y - 5, w: Math.max(0.4, wide - 0.5), d: 10, r: Math.min(1, wide / 3) };
      const zTop = 4.2 + hgt;
      const lit = sg.i === litTile;
      let label = "";
      if (wide > 13 && rise > 0.6) label = `<text class="iso-face-text tf-text" data-tone="hi" transform="${topMatrix([(sg.x0 + sg.x1) / 2, L.RULER_Y + 1.6], zTop, P, "x")}" font-size="4.2" text-anchor="middle">${M.VOCAB[M.wordOf(sg.i)]}</text>`;
      html += `<g class="tf-seg" data-seg="${sg.i}">${solidSvg(slabOf(plan, 4.2, hgt, P, 2, 0.2), { tone: lit ? "hi" : "mid", lit, crease: "faint" })}${label}</g>`;
    }
    L_RULER.innerHTML = html;
  }
  // the dropper and marble
  const uX = RULER.x0 + S.u * RULER.w;
  let dX = uX, mz = 60, mvis = 0, shadow = 0;
  if (ph) {
    dX = lerp(carriage.x ?? 0, uX, ph.drop);
    if (ph.fall > 0) {
      mvis = 1;
      const t = ph.fall;
      mz = 4.2 + (shown[S.pick] * 7.5 + 0.8) + 3.2 + (1 - t * t) * 38;
      shadow = t;
    } else if (ph.drop > 0.95) { mvis = 1; mz = 42 + 4.2; shadow = 0; }
    else mvis = 0;
    if (ph.fall >= 1) { mz = 4.2 + (shown[S.pick] * 7.5 + 0.8) + 3.2; shadow = 1; mvis = 1 - smooth(0.46, 0.54, p); }
  } else if (T >= TOTAL_STAGES) { dX = uX; mvis = 0; }
  const showDrop = ph && ph.tray > 0.5 && ph.slug < 0.1;
  dropper.style.display = showDrop ? "" : "none";
  dropper.setAttribute("transform", shift(dX, 0, 0));
  marble.g.style.display = mvis > 0.01 ? "" : "none";
  if (mvis > 0.01) {
    const [bx, by] = W(uX, L.RULER_Y, mz);
    const [sx, sy] = W(uX, L.RULER_Y, 4.2 + (shown[S.pick] * 7.5 + 0.8));
    marble.ball.setAttribute("cx", fix(bx)); marble.ball.setAttribute("cy", fix(by));
    marble.glint.setAttribute("transform", `translate(${fix(bx)} ${fix(by)})`);
    marble.shadow.setAttribute("cx", fix(sx)); marble.shadow.setAttribute("cy", fix(sy));
    marble.shadow.style.opacity = (0.5 * shadow).toFixed(2);
    marble.g.style.opacity = mvis.toFixed(2);
  }
  // the chosen word's slug rides the return rail
  const showSlug = ph && ph.slug > 0.01;
  retSlug.g.style.display = showSlug ? "" : "none";
  if (showSlug) {
    const word = M.VOCAB[M.wordOf(S.pick)];
    if (retSlug.text.textContent !== word) retSlug.text.textContent = word;
    const seg = rulerLayout(shown)[S.pick];
    const from = [(seg.x0 + seg.x1) / 2, L.RULER_Y, 4.2 + 0.8 + shown[S.pick] * 7.5];
    const slotX = L.laneX(Math.min(N - 1, S.tokens.length));
    const path = [from, [from[0], from[1], 3.4], [92, L.RULER_Y, 2.4], [L.RAIL_X, L.RULER_Y, 2.4], [L.RAIL_X, L.STICK_Y, 2.4], [102, L.STICK_Y, 5], [slotX, L.STICK_Y, 5]];
    const pos = along(path, ph.ride);
    const rise2 = (1 - ph.slug) * 4;
    const lift = ph.ride > 0 ? 0 : rise2;
    const [px, py] = axisVector(P, [pos[0], pos[1], pos[2] + lift]);
    retSlug.g.setAttribute("transform", `translate(${px.toFixed(2)} ${py.toFixed(2)})`);
    retSlug.g.style.opacity = (ph.slug * (1 - smooth(0.92, 1, p))).toFixed(2);
    retSlug.g.toggleAttribute("data-lit", true);
  }
  // drop of the new slug into the stick: handled by the commit at T = 8
}
function along(path, t) {
  const lens = [0];
  for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], (path[i][2] - path[i - 1][2]) * 0.6));
  const target = t * lens[lens.length - 1];
  let i = 1;
  while (i < path.length - 1 && lens[i] < target) i++;
  const f = clamp((target - lens[i - 1]) / (lens[i] - lens[i - 1] || 1));
  return [0, 1, 2].map((a) => lerp(path[i - 1][a], path[i][a], f));
}

// ---- stick, slugs, tiles --------------------------------------------------------------------------------------
function drawStick(T) {
  const n = S.tokens.length;
  for (let i = 0; i < N; i++) {
    const g = slugGroup[i];
    const has = i < n;
    g.style.display = has ? "" : "none";
    if (!has) continue;
    const word = M.VOCAB[S.tokens[i]];
    if (slugText[i].textContent !== word) slugText[i].textContent = word;
    S.drop[i] = Math.max(0, S.drop[i] - 0.045);
    g.setAttribute("transform", S.drop[i] > 0.001 ? shift(0, 0, S.drop[i] * 14) : "");
    g.style.opacity = (1 - S.drop[i] * 0.6).toFixed(2);
    const sweeping = T < TOTAL_STAGES && stageOf(T) === 0 && i >= S.first;
    const lit = sweeping ? progress(T) * (n - S.first + 1) - (i - S.first) > 0.1 && progress(T) * (n - S.first + 1) - (i - S.first) < 1.6 : i === S.sel;
    g.toggleAttribute("data-lit", lit);
  }
  const full = n >= N;
  tileEls.forEach((t) => t.toggleAttribute("data-off", full));
}


// ---- controls: knob, gauge, lamps ---------------------------------------------------------------------------------
const knobPointer = $("[data-knob-pointer]"), gaugeNeedle = $("[data-gauge-needle]"), knobHit = $("[data-knob-hit]");
const lampEls = $$("[data-stage-lamp]");
const signEls = $$("[data-sign]");
const tempAngle = (t) => KNOB.from + clamp((t - 0.2) / 1.8) * KNOB.span;
const spoke = (cx, cy, a, r0, r1, z) => lineOnTop([cx + Math.sin(a) * r0, cy - Math.cos(a) * r0], [cx + Math.sin(a) * r1, cy - Math.cos(a) * r1], z, P);
let ctlKey = "";
function drawControls(T) {
  const stage = T >= TOTAL_STAGES ? 7 : stageOf(T);
  const key = `${S.temp}|${S.tokens.length}|${stage}`;
  if (key === ctlKey) return;
  ctlKey = key;
  knobPointer.setAttribute("d", spoke(KNOB.x, KNOB.y, tempAngle(S.temp), 1.4, 5.3, 9.4));
  const gAngle = KNOB.from + (S.tokens.length / N) * KNOB.span;
  gaugeNeedle.setAttribute("d", spoke(GAUGE.x, GAUGE.y, gAngle, 0, GAUGE.R - 2.8, 5.2));
  lampEls.forEach((l, i) => l.toggleAttribute("data-on", i === stage));
  signEls.forEach((g) => { const on = Number(g.dataset.sign) === stage; g.toggleAttribute("data-on", on); $(".tf-sign-body", g).toggleAttribute("data-lit", on); });
}
function unproject(sx, sy, z) {
  const { sinA, cosA, sinE, cosE, k } = cameraOf(P);
  const u = (sx - P.origin[0]) / k, w = ((sy - P.origin[1]) / k + z * cosE) / sinE;
  return [u * sinA + w * cosA, -u * cosA + w * sinA];
}
function knobTo(e) {
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const q = pt.matrixTransform(svg.getScreenCTM().inverse());
  const [x, y] = unproject(q.x, q.y, 9.4);
  const a = Math.atan2(x - KNOB.x, -(y - KNOB.y));
  const f = Math.abs(a) > Math.abs(KNOB.from) ? (a > 0 ? 1 : 0) : (a - KNOB.from) / KNOB.span;
  const t = Math.round((0.2 + clamp(f) * 1.8) * 20) / 20;
  userAct();
  setTemp(t);
}
function setTemp(t) { S.temp = t; tempInput.value = String(t); tempOut.textContent = t.toFixed(2); newRun(); kick(); }
let dragging = false;
knobHit.addEventListener("pointerdown", (e) => { dragging = true; knobHit.setPointerCapture(e.pointerId); knobTo(e); e.stopPropagation(); });
knobHit.addEventListener("pointermove", (e) => { if (dragging) knobTo(e); });
knobHit.addEventListener("pointerup", () => { dragging = false; });
knobHit.addEventListener("pointercancel", () => { dragging = false; });

// ---- frame ---------------------------------------------------------------------------------------------------
function render() {
  const T = S.T;
  for (let i = 0; i < N; i++) drawLane(i, T);
  drawCords(T);
  drawReader(T);
  drawStick(T);
  drawControls(T);
  updateReadout(T);
  updatePanel(T);
}

function stageLabel(T) { return STAGES[stageOf(T)].name; }
function updateReadout(T) {
  const s = stageOf(T);
  const n = S.tokens.length, last = n - 1;
  const mode = S.first >= n ? "cached" : S.first === 0 ? `prefill ${n} lanes` : `decode lane ${S.first}`;
  const top = S.probs.indexOf(Math.max(...S.probs));
  let line;
  if (T >= TOTAL_STAGES) line = `${stageLabel(7)} · ${mode}`;
  else if (s >= 6) line = `${STAGES[s].name} · ${M.VOCAB[M.wordOf(top)]} ${(S.probs[top] * 100).toFixed(0)}%`;
  else line = `${STAGES[s].name} · ${mode}`;
  if (readout.textContent !== line) readout.textContent = line;
}

// ---- panel -----------------------------------------------------------------------------------------------------
const P_ = {
  card: document.querySelector("[data-step-card]"),
  stepTitle: document.querySelector("[data-step-title]"),
  stepText: document.querySelector("[data-step-text]"),
  stepNums: document.querySelector("[data-step-nums]"),
  laneName: document.querySelector("[data-lane-name]"),
  laneBars: document.querySelector("[data-lane-bars]"),
  attn: document.querySelector("[data-attn]"),
  mem: document.querySelector("[data-mem]"),
  next: document.querySelector("[data-next]"),
  every: document.querySelector("[data-every]"),
  prompt: document.querySelector("[data-prompt]"),
};
const STEP_TEXT = [
  ["Words become lanes", "The text is cut into tokens, here whole words. The toy knows eight words and a start marker <s> that the model always sees first. Each token gets its own lane, and its lane number is its position. Lanes work side by side and can only talk to each other in the attention steps."],
  ["Embed: a word becomes numbers", "Each token is looked up in a table and becomes a vector, the numbers on its tray. In a real model this vector has thousands of entries with no tidy meaning. Here three banks are kept apart so you can watch them fill: T says who this token is, A will say who came before it, O will say what word comes next. This tray is the residual stream: every later step adds to it and none replaces it."],
  ["Attention 1: lanes look back", "Each lane makes a query, and every earlier lane offers a key and a value. A score for each pair says how well the query matches the key. Softmax turns the scores into weights that add to 1, and the lane takes that blend of the values. The cord thickness is the weight. Lanes cannot look forward (the causal mask), so a lane only reaches left. Two heads do this in parallel, each with its own weights."],
  ["Memory 1: each lane recalls", "Now every lane works alone, with the same weights. A drawer opens in proportion to how well its key matches the tray, and adds its value, here votes for likely next words. This feed-forward layer is a bank of key-value memories: attention moves information between lanes, the memory uses it."],
  ["Attention 2: use what layer 1 wrote", "The second layer reads trays that already carry layer 1's notes. The induction head asks: where did this word appear before? It looks at the lane after that earlier word and copies that word's vote. That is how a model continues a pattern it has just seen."],
  ["Memory 2: refine the votes", "Late memories adjust the votes using the context attention gathered. A memory for the pair on, the pushes mat up and pushes cat and dog down. Layers refine; none starts from scratch."],
  ["Unembed: numbers back to words", "Only the last lane predicts the next word. Its tray is normalised and read out as one score per word, the logits. Softmax turns scores into probabilities, and the ruler lays them end to end: a slot's width is its probability. Temperature changes how sharp the scores are before softmax."],
  ["Sample: pick a word, then repeat", "A marble drops at a random point u along the ruler and lands in the slot that covers it, so a word with 90% probability gets 90% of the ruler. The word goes to the end of the context and the pass repeats. Earlier lanes do not recompute: their keys and values sit in the cache, and only the new lane runs."],
];
const pct = (v) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const wordName = (t) => M.VOCAB[t];
const wordH = (t) => esc(M.VOCAB[t]);

function bars(values, labels, cls, scale) {
  return values.map((v, i) => `<span class="tf-pbar ${cls}${v < 0 ? " neg" : ""}" title="${esc(labels[i])}"><i style="height:${Math.round(clamp(Math.abs(v) / scale) * 100)}%"></i><b>${esc(labels[i])}</b></span>`).join("");
}
let lastPanelKey = "";
function updatePanel(T) {
  const s = stageOf(T), p = progress(T);
  const key = `${s}|${S.sel}|${S.runKey}|${S.temp}|${p > 0.55 ? 1 : 0}|${S.pick}|${S.u.toFixed(3)}|${T >= TOTAL_STAGES}`;
  if (key === lastPanelKey) return;
  lastPanelKey = key;
  const sel = Math.min(S.sel, S.tokens.length - 1);
  const word = wordName(S.tokens[sel]);
  const [title, text] = STEP_TEXT[s];
  P_.stepTitle.textContent = `${STAGES[s].short} · ${title}`;
  if (!S.tour && !S.playing && live) live.textContent = `Step ${s + 1} of 8, ${STAGES[s].name}. ${title}.`;
  P_.stepText.textContent = text;
  stepBtns.forEach((b, i) => b.setAttribute("aria-pressed", String(i === s)));
  scrub.value = String(Math.min(T, TOTAL_STAGES));
  scrub.setAttribute("aria-valuetext", STAGES[s].name);

  // the selected lane's trays at the step's end
  const snap = [0, 0, 1, 2, 3, 4, 4, 4][s];
  const vec = S.run.x[Math.min(4, Math.max(0, s === 0 ? 0 : s === 1 ? 0 : snap))][sel];
  const b = M.bank(vec);
  P_.laneName.textContent = `Lane ${sel + 1} · ${word}`;
  const wl = M.VOCAB.slice(1);
  P_.laneBars.innerHTML =
    `<div class="tf-bank"><span>T · who I am</span><div class="tf-pbars">${bars(b.T, M.VOCAB, "t", 5)}</div></div>` +
    `<div class="tf-bank"><span>A · who came before</span><div class="tf-pbars">${bars(b.A, M.VOCAB, "a", 5)}</div></div>` +
    `<div class="tf-bank"><span>O · what comes next</span><div class="tf-pbars">${bars(b.O, wl, "o", 6.5)}</div></div>`;

  // attention
  const aLayer = s >= 4 ? 1 : 0;
  const A = S.run.attn[aLayer];
  const n = S.tokens.length;
  const heads = A.heads.map((h, hi) => {
    let cells = `<b class="tf-ax"></b>` + S.tokens.map((t) => `<b class="tf-ax tf-ax-k">${wordH(t)}</b>`).join("");
    for (let i = 0; i < n; i++) {
      cells += `<b class="tf-ax tf-ax-q${i === sel ? " on" : ""}">${wordH(S.tokens[i])}</b>`;
      for (let j = 0; j < n; j++) {
        const w = j <= i ? h.weights[i][j] : 0;
        cells += `<i class="${j > i ? "mask" : ""}${i === sel ? " row" : ""}" style="--w:${w.toFixed(3)}" title="${esc(wordName(S.tokens[i]))} reads ${esc(wordName(S.tokens[j]))}: ${j <= i ? pct(h.weights[i][j]) : "masked"}"></i>`;
      }
    }
    const role = M.HEAD_ROLES[aLayer][hi];
    const row = h.weights[sel];
    const top = row.indexOf(Math.max(...row));
    const q = h.scores[sel][top];
    return `<div class="tf-head" data-head="${hi}"><div class="tf-head-t"><b>Head ${hi + 1}</b> ${role.name}</div><div class="tf-grid" style="--n:${n}">${cells}</div><p>${esc(word)} looks mostly at <b>${wordH(S.tokens[top])}</b> (lane ${top + 1}): score ${q.toFixed(1)} → weight ${pct(row[top])}.</p></div>`;
  }).join("");
  P_.attn.innerHTML = `<h4>Attention ${aLayer + 1} · who lane ${sel + 1} reads</h4><div class="tf-heads">${heads}</div><p class="tf-note">Rows are queries, columns are keys. The empty cells above the diagonal are the causal mask: a lane cannot read ahead. Your lane's row is outlined.</p>`;

  // memories
  const mLayer = s >= 5 ? 1 : 0;
  const mem = S.run.mlp[mLayer];
  const acts = mem.act[sel];
  const specs = M.MEMORIES[mLayer];
  const rows = specs.map((sp, k) => ({ sp, a: clamp(acts[k] / ACT_REF[mLayer]), k })).sort((x, y) => y.a - x.a);
  P_.mem.innerHTML = `<h4>Memory ${mLayer + 1} · what lane ${sel + 1} recalls</h4>` + rows.map(({ sp, a }) => {
    const votes = Object.entries(sp.says).map(([t, v]) => `<em class="${v < 0 ? "neg" : ""}">${v < 0 ? "−" : "+"}${wordH(Number(t))}</em>`).join(" ");
    return `<div class="tf-mem${a > 0.35 ? " on" : ""}"><span class="tf-mem-k">${esc(sp.match)}</span><span class="tf-mem-bar"><i style="width:${Math.round(a * 100)}%"></i></span><span class="tf-mem-v">${votes}</span></div>`;
  }).join("") + `<p class="tf-note">Each row is one drawer: it opens when its key (left) matches the tray, and adds its votes (right).</p>`;

  // next word
  const last = n - 1;
  const order = S.probs.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]);
  const lg = S.run.logits[last];
  P_.next.innerHTML = `<h4>Next word · after ${wordH(S.tokens[last])}</h4>` + order.map(([v, i]) => `<div class="tf-prob${i === S.pick && (s === 7 || T >= TOTAL_STAGES) ? " pick" : ""}"><span>${wordH(M.wordOf(i))}</span><span class="tf-prob-bar"><i style="width:${Math.round(v * 100)}%"></i></span><span>${pct(v)}</span><small>${lg[i].toFixed(1)}</small></div>`).join("") +
    `<p class="tf-note">Bars are probabilities at temperature ${S.temp.toFixed(2)}; the small number is the logit. ${s === 7 || T >= TOTAL_STAGES ? `The marble fell at u = ${S.u.toFixed(2)}.` : ""}</p>`;

  // every lane predicts
  P_.every.innerHTML = S.tokens.map((t, i) => {
    const pr = M.softmax(S.run.logits[i], 1);
    const top = pr.indexOf(Math.max(...pr));
    return `<button type="button" class="tf-chip${i === sel ? " sel" : ""}" data-pick-lane="${i}"><b>${wordH(t)}</b><span>→ ${wordH(M.wordOf(top))} ${pct(pr[top])}</span></button>`;
  }).join("");
}

// ---- input -----------------------------------------------------------------------------------------------------
function userAct() { S.tour = false; clearTimeout(S.tourTimer); }
function setSel(i) {
  const j = clamp(i, 0, S.tokens.length - 1);
  if (j !== S.sel) { S.sel = j; kick(); }
}
function laneAt(target) { const el = target.closest && target.closest("[data-lane]"); return el ? Number(el.dataset.lane) : null; }
svg.addEventListener("pointermove", (e) => { const i = laneAt(e.target); if (i !== null && i < S.tokens.length) setSel(i); });
svg.addEventListener("pointerdown", (e) => { const i = laneAt(e.target); if (i !== null && i < S.tokens.length) setSel(i); });
tileEls.forEach((t) => {
  const add = () => { userAct(); addWord(Number(t.dataset.tile)); };
  t.addEventListener("click", add);
  t.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); add(); } });
});

function newRun() {
  S.runKey = (S.runKey || 0) + 1;
  recompute();
}
function setTokens(tokens, { first = 0, T = 0, play = S.playing, sel } = {}) {
  S.tokens = tokens;
  S.shown = null; // a new context has a new prediction: don't morph from the old one
  S.first = first;
  S.T = T;
  S.u = Math.random();
  S.playing = play;
  S.sel = sel ?? tokens.length - 1;
  newRun();
  setPlay(S.playing);
  kick();
}
function addWord(t) {
  if (S.tokens.length >= N) return;
  const first = Math.min(S.tokens.length, S.first >= S.tokens.length ? S.tokens.length : S.first);
  const done = S.T >= TOTAL_STAGES || S.first >= S.tokens.length;
  const from = done ? S.tokens.length : S.first;
  const tokens = [...S.tokens, t];
  S.drop[tokens.length - 1] = 1;
  setTokens(tokens, { first: from, T: 0, play: true });
}
function removeLast() {
  if (S.tokens.length <= 2) return;
  const tokens = S.tokens.slice(0, -1);
  setTokens(tokens, { first: tokens.length, T: TOTAL_STAGES, play: false });
}
function loadPreset(i) {
  S.presetIndex = i;
  setTokens(M.parse(M.PRESETS[i].tokens), { first: 0, T: 0, play: true });
}
document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { userAct(); loadPreset(Number(b.dataset.preset)); }));
document.querySelector("[data-undo]").addEventListener("click", () => { userAct(); removeLast(); });
document.querySelectorAll("[data-word]").forEach((b) => b.addEventListener("click", () => { userAct(); addWord(Number(b.dataset.word)); }));
document.addEventListener("click", (e) => { const c = e.target.closest && e.target.closest("[data-pick-lane]"); if (c) setSel(Number(c.dataset.pickLane)); });

function setPlay(on) { S.playing = on; playBtn.textContent = on ? "Pause" : "Play"; playBtn.setAttribute("aria-pressed", String(!on)); }
playBtn.addEventListener("click", () => { userAct(); setPlay(!S.playing); if (S.playing && S.T >= TOTAL_STAGES) { S.T = 0; S.first = S.tokens.length >= N ? 0 : S.tokens.length - 1; } kick(); });
stepBtns.forEach((b) => b.addEventListener("click", () => { userAct(); S.T = Number(b.dataset.stage) + 0.02; if (S.first >= S.tokens.length) S.first = S.tokens.length - 1; setPlay(false); newRun(); kick(); }));
scrub.addEventListener("input", () => { userAct(); S.T = Number(scrub.value); if (S.first >= S.tokens.length && S.T < TOTAL_STAGES) S.first = S.tokens.length - 1; setPlay(false); kick(); });
tempInput.addEventListener("input", () => { userAct(); setTemp(Number(tempInput.value)); });
root.addEventListener("keydown", (e) => {
  if (e.key === " ") { e.preventDefault(); playBtn.click(); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); setSel(S.sel - 1); }
  else if (e.key === "ArrowRight") { e.preventDefault(); setSel(S.sel + 1); }
  else if (e.key === "ArrowDown") { e.preventDefault(); S.T = clamp(Math.floor(S.T) + 1.02, 0, 7.98); setPlay(false); kick(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); S.T = clamp(Math.floor(S.T) - 1 + 0.02, 0, 7.98); setPlay(false); kick(); }
  else if (e.key === "Backspace") { e.preventDefault(); userAct(); removeLast(); }
});

// ---- loop ------------------------------------------------------------------------------------------------------
let last = 0, frame = 0, visible = true, idleFor = 0;
function commit() {
  // the pass is done: the marble's word joins the context
  const n = S.tokens.length;
  if (still.matches) { S.reducedStep = true; }
  if (n >= N) {
    S.fullNote = true;
    setPlay(false);
    if (S.tour) S.tourTimer = setTimeout(() => { if (S.tour) loadPreset((S.presetIndex + 1) % M.PRESETS.length); }, 4500);
    return;
  }
  const t = M.wordOf(S.pick);
  if (still.matches) { setTokens([...S.tokens, t], { first: n, T: TOTAL_STAGES, play: false, sel: n }); return; }
  S.drop[n] = 1;
  setTokens([...S.tokens, t], { first: n, T: 0, play: true, sel: n });
}
function tick(now) {
  frame = 0;
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  if (S.playing) {
    const s = stageOf(S.T);
    S.T = still.matches ? TOTAL_STAGES : S.T + dt / DUR[s];
    if (S.T >= TOTAL_STAGES) {
      S.T = TOTAL_STAGES;
      commit();
    }
  }
  easeProbs(dt);
  render();
  const moving = S.playing || S.easing || S.drop.some((d) => d > 0.001) || Math.abs((carriage.x ?? 0) - L.laneX(lastLane())) > 0.05;
  if (visible && (moving || !frame)) frame = requestAnimationFrame(tick);
}
function easeProbs(dt) {
  if (!S.shown || still.matches) { S.shown = S.probs.slice(); S.easing = false; return; }
  const f = 1 - Math.exp(-dt / 0.14);
  let diff = 0;
  S.shown = S.shown.map((v, i) => { const d = S.probs[i] - v; diff += Math.abs(d); return Math.abs(d) < 5e-4 ? S.probs[i] : v + d * f; });
  S.easing = diff > 1e-3;
}
function kick() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } else if (!visible) render(); }
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) kick(); }, { rootMargin: "160px 0px" }).observe(root);

// ---- go ----------------------------------------------------------------------------------------------------------
tempOut.textContent = S.temp.toFixed(2);
newRun();
S.sel = S.tokens.length - 1;
S.drop.fill(0);
setPlay(S.playing);
window.__tf = { bench: (n = 200) => { const t0 = performance.now(); for (let i = 0; i < n; i++) { S.T = 2 + (i % 100) / 100 * 6; render(); } return (performance.now() - t0) / n; }, state: S, setT: (t) => { S.T = t; setPlay(false); kick(); }, setSel, loadPreset, addWord, render };
if (still.matches) S.T = TOTAL_STAGES;
render();
kick();
