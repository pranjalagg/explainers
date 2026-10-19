// Live layer: one clock T in days through the year. The rack, glass, coins, readout and chart all come from the model.
const { P, GEO, ZP } = DATA;
const root = document.querySelector(".sg-stage");
const svg = root.querySelector("svg");
const q = (sel) => svg.querySelector(sel);
const cardsEl = q("[data-cards]");
const sinkEl = q("[data-sinking]");
const liquidEl = q("[data-liquid]");
const dropEl = q("[data-drop]");
const pointerEl = q("[data-pointer]");
const leverEl = q("[data-lever]");
const flowEl = q("[data-flow]");
const coinEls = [...svg.querySelectorAll("[data-coin]")];
const readout = document.querySelector("[data-readout]");
const playBtn = document.querySelector("[data-play]");
const monthBtns = [...document.querySelectorAll("[data-month]")];
const inputs = Object.fromEntries([...document.querySelectorAll("[data-in]")].map((el) => [el.dataset.in, el]));
const outs = Object.fromEntries([...document.querySelectorAll("[data-out]")].map((el) => [el.dataset.out, el]));
const cells = Object.fromEntries([...document.querySelectorAll("[data-c]")].map((el) => [el.dataset.c, el]));
const verdictEl = document.querySelector("[data-verdict]");
const depEl = document.querySelector("[data-dep]");
const chart = document.querySelector("[data-chart]");
const lines = Object.fromEntries([...chart.querySelectorAll("[data-line]")].map((el) => [el.dataset.line, el]));
const dots = Object.fromEntries([...chart.querySelectorAll("[data-dot]")].map((el) => [el.dataset.dot, el]));
const headEl = chart.querySelector("[data-head]");
const gridEl = chart.querySelector("[data-grid]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const zOfPrice = (p) => ZP[2] + ((p - ZP[0]) / (ZP[1] - ZP[0])) * (ZP[3] - ZP[2]);
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const NS = "http://www.w3.org/2000/svg";

const opts = { ...DEFAULTS };
let schedule = scheduleOf(opts.rate);
let sim = run(schedule, opts);
let T = still.matches ? 74 : 0;
let playing = !still.matches;

// ---- Bill cards ----------------------------------------------------------------------------------------------
const C = GEO.card;
function cardSvg(rate, tab) {
  const out = [];
  const plan = { x: -C.t / 2, y: C.y0, w: C.t, d: C.y1 - C.y0, r: 0.3 };
  const fx = C.t / 2;
  const face = (y, z) => iso([fx, y, z], P);
  const inner = [];
  // Printed lines, the Treasury seal and the rate window on the broad face.
  inner.push(lineSvg([20.5, 18.6, 16.7].map((z, i) => pathOf([face(-15.4, z), face(-15.4 + [9, 6.5, 8][i], z)])).join(""), { tone: "lo", free: true }));
  inner.push(lineSvg(sideRing([fx, -11.6, 9.6], 2.6, "x", P, 24), { tone: "lo" }));
  inner.push(lineSvg(sideRing([fx, -11.6, 9.6], 1.4, "x", P, 16), { tone: "faint" }));
  const win = [[-4.8, 6], [-1.4, 6], [-1.4, 19.2], [-4.8, 19.2]];
  const top = 6 + clamp(rate / 6) * 13.2;
  inner.push(`<path class="sg-bar" d="${pathOf([[-4.8, 6], [-1.4, 6], [-1.4, top], [-4.8, top]].map(([y, z]) => face(y, z)), true)}"/>`);
  inner.push(lineSvg(pathOf(win.map(([y, z]) => face(y, z)), true), { tone: "lo" }));
  out.push(solidSvg(slabOf(plan, C.z0, C.z1 - C.z0, P, 2), { tone: "hi", inner: inner.join("") }));
  const tabPlan = { x: -C.t / 2, y: C.y0 + 1.2 + tab * 5.4, w: C.t, d: 4.4, r: 0.3 };
  out.push(solidSvg(slabOf(tabPlan, C.z1, 2.4, P, 2), { tone: "mid" }));
  return out.join("");
}

const pool = new Map();
function cardFor(week) {
  let card = pool.get(week);
  const rate = boughtAt(schedule, week);
  if (!card) {
    const el = document.createElementNS(NS, "g");
    card = { el, rate: null };
    pool.set(week, card);
  }
  if (card.rate !== rate) {
    card.el.innerHTML = cardSvg(rate, ((week % 3) + 3) % 3);
    card.rate = rate;
  }
  return card;
}

function placeCards(t) {
  const W = Math.floor(t / 7);
  const f = t / 7 - W;
  const hop = smoothstep(0, 0.3, f);
  const keep = new Set();
  const inRack = [];
  for (let w = W - 13; w <= W; w++) {
    const card = cardFor(w);
    keep.add(w);
    const slot = W - w - (1 - hop);
    let x = GEO.slot0 + slot * GEO.pitch, z = 0, alpha = 1, sinking = false;
    if (w === W) {
      // The new bill comes up out of the auction magazine.
      x = GEO.slot0 + (slot < 0 ? slot : 0) * GEO.pitch;
      z = -12 * (1 - hop);
      alpha = smoothstep(0.1, 0.7, hop);
    } else if (w === W - 13) {
      // The oldest bill matures: it lifts clear, moves over the redemption box and drops in.
      sinking = true;
      const lift = smoothstep(0, 0.35, hop);
      const across = smoothstep(0.35, 1, hop);
      const sink = smoothstep(0.3, 0.75, f);
      x = GEO.slot0 + (12 + across) * GEO.pitch;
      z = 14 * lift - 26 * sink;
      alpha = 1 - smoothstep(0.42, 0.7, f);
    }
    card.el.setAttribute("transform", translateAlong(P, [x, 0, z]));
    card.el.style.opacity = alpha < 0.999 ? alpha.toFixed(3) : "";
    card.el.style.display = alpha < 0.01 ? "none" : "";
    card.x = x;
    if (sinking) {
      if (card.el.parentNode !== sinkEl) sinkEl.appendChild(card.el);
    } else inRack.push(card);
  }
  inRack.sort((a, b) => a.x - b.x);
  inRack.forEach((card, i) => {
    if (cardsEl.children[i] !== card.el) cardsEl.insertBefore(card.el, cardsEl.children[i] || null);
  });
  for (const [w, card] of pool) {
    if (!keep.has(w)) {
      card.el.remove();
      pool.delete(w);
    }
  }
}

// ---- Gauge, coins, knob ------------------------------------------------------------------------------------------
let shown = BASE;
let liquidKey = "";
function drawLiquid(price) {
  const { x, y, r } = GEO.tube;
  const z0 = zOfPrice(BASE);
  const z1 = zOfPrice(price);
  const key = z1.toFixed(2);
  if (key === liquidKey) return;
  liquidKey = key;
  liquidEl.innerHTML = z1 - z0 > 0.15 ? solidSvg(cylinder(x, y, r - 0.8, z0, z1 - z0, P, 48), { tone: "hi", lit: true, className: "sg-income" }) : "";
}

let drop = null;
function drawCoins(count) {
  const flying = drop ? drop.index : -1;
  coinEls.forEach((el, i) => (el.style.display = i < count && i !== flying ? "" : "none"));
}
function drawDrop(now) {
  if (!drop) {
    dropEl.innerHTML = "";
    return;
  }
  const t = clamp((now - drop.start) / 650);
  const { x, y } = GEO.tray;
  const zEnd = GEO.tray.h + drop.index * GEO.coin.h;
  const z = 10.6 + (zEnd - 10.6) * t * t;
  dropEl.innerHTML = solidSvg(cylinder(x, y, GEO.coin.r, z, GEO.coin.h, P, 40), { tone: "hi", crease: "lo" });
  if (t >= 1) drop = null;
}

function drawKnob(rate) {
  const { x, y, r } = GEO.knob;
  const a = -0.75 * Math.PI + clamp(rate / 6) * 1.5 * Math.PI;
  const sx = Math.sin(a), sy = -Math.cos(a);
  pointerEl.setAttribute("d", lineOnTop([x - sx * 1.6, y - sy * 1.6], [x + sx * (r - 0.9), y + sy * (r - 0.9)], 7, P));
}

// ---- Chart -------------------------------------------------------------------------------------------------------
const CH = { x0: 46, x1: 590, y0: 12, y1: 192 };
let scaleY = null;
const cx = (d) => CH.x0 + (d / YEAR) * (CH.x1 - CH.x0);
function drawChart() {
  const total = [], price = [], bank = [];
  for (let d = 0; d <= YEAR; d++) {
    price.push(sim.shares * sim.price[d]);
    total.push(sim.shares * sim.price[d] + sim.paid[d]);
    bank.push(sim.bank[d] + sim.pending[d]);
  }
  const lo = opts.deposit;
  const hi = Math.max(total[YEAR], bank[YEAR], lo * 1.001) ;
  const pad = (hi - lo) * 0.08;
  const vLo = lo - pad, vHi = hi + pad;
  scaleY = (v) => CH.y1 - ((v - vLo) / (vHi - vLo)) * (CH.y1 - CH.y0);
  const path = (arr, steps) => {
    let d = "";
    arr.forEach((v, i) => {
      const X = cx(i).toFixed(1), Y = scaleY(v).toFixed(1);
      if (!i) d += `M${X} ${Y}`;
      else if (steps && STARTS.includes(i)) d += `L${X} ${scaleY(arr[i - 1]).toFixed(1)}L${X} ${Y}`;
      else d += `L${X} ${Y}`;
    });
    return d;
  };
  lines.total.setAttribute("d", path(total, false));
  lines.price.setAttribute("d", path(price, true));
  lines.bank.setAttribute("d", path(bank, true));
  const grid = [];
  STARTS.forEach((s, i) => {
    grid.push(`<line class="sg-grid" x1="${cx(s)}" x2="${cx(s)}" y1="${CH.y0}" y2="${CH.y1}"/>`);
    grid.push(`<text class="sg-tick" x="${cx(s + MONTH_DAYS[i] / 2)}" y="${CH.y1 + 16}" text-anchor="middle">${MONTHS[i][0]}</text>`);
  });
  const step = niceStep((vHi - vLo) / 4);
  for (let v = Math.ceil(vLo / step) * step; v <= vHi; v += step) {
    grid.push(`<line class="sg-grid" x1="${CH.x0}" x2="${CH.x1}" y1="${scaleY(v)}" y2="${scaleY(v)}"/>`);
    grid.push(`<text class="sg-tick" x="${CH.x0 - 6}" y="${scaleY(v) + 3.5}" text-anchor="end">${compact(v)}</text>`);
  }
  gridEl.innerHTML = grid.join("");
}
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
const compact = (v) => (v >= 10000 ? `$${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `$${Math.round(v).toLocaleString("en-US")}`);

// ---- Panel -------------------------------------------------------------------------------------------------------
function writeInputs() {
  outs.rate.textContent = pct(opts.rate);
  outs.apy.textContent = pct(opts.apy);
  outs.deposit.textContent = money(opts.deposit, 0);
  outs.fed.textContent = `${opts.fed}%`;
  outs.state.textContent = pct(opts.state, 1);
  depEl.textContent = opts.deposit.toLocaleString("en-US");
}

function writeTable(s) {
  const fed = opts.fed / 100, st = opts.state / 100;
  const bankMonthly = (opts.deposit * opts.apy) / 100 / 12;
  cells.sgovY.textContent = `${pct(s.net)} (bills ${pct(s.gross)} less 0.09% fee)`;
  cells.bankY.textContent = `${pct(opts.apy)} APY`;
  cells.sgovA.textContent = pct(s.sgovAfter);
  cells.bankA.textContent = pct(s.bankAfter);
  cells.sgovM.textContent = `${money(s.monthly)} gross, ${money(s.monthly * (1 - fed))} after tax`;
  cells.bankM.textContent = `${money(bankMonthly)} gross, ${money(bankMonthly * (1 - fed - st))} after tax`;
  const gap = s.sgovAfter - s.bankAfter;
  verdictEl.textContent =
    Math.abs(gap) < 0.005
      ? `After tax they pay the same. A savings account matches SGOV at ${pct(s.breakEven)} APY.`
      : `After tax SGOV pays ${pct(Math.abs(gap))} ${gap > 0 ? "more" : "less"} a year than this savings account. To match SGOV, the account would need ${pct(s.breakEven)} APY, because its interest is also taxed by your state.`;
}

function recompute() {
  sim = run(schedule, opts);
  drawChart();
  writeInputs();
}

function setRate(rate) {
  opts.rate = Math.round(clamp(rate, 0, 6) * 20) / 20;
  // Only bills bought from the next weekly auction on carry the new rate.
  const next = Math.floor(T / 7) + 1;
  for (let w = next; w < WEEKS; w++) schedule[w] = opts.rate;
  inputs.rate.value = String(opts.rate);
  recompute();
}

// ---- Frame -------------------------------------------------------------------------------------------------------
let lastPaid = -1;
function render(now, dt) {
  const s = stateAt(sim, schedule, T, opts);
  placeCards(T);
  // The glass follows the price; on an ex-date it drains back to the principal mark over a moment.
  shown = still.matches || dt === 0 ? s.price : shown + (s.price - shown) * (1 - Math.exp(-dt / 0.18));
  drawLiquid(shown);
  if (lastPaid >= 0 && s.paidCount === lastPaid + 1 && playing && !still.matches) drop = { index: s.paidCount - 1, start: now };
  if (s.paidCount < lastPaid) drop = null;
  lastPaid = s.paidCount;
  drawCoins(s.paidCount);
  drawDrop(now);
  const draining = shown - s.price > 0.01;
  leverEl.toggleAttribute("data-open", draining || !!drop);
  svg.toggleAttribute("data-draining", draining);
  drawKnob(boughtAt(schedule, Math.floor(T / 7) + 1));
  flowEl.style.animationDuration = `${(6 / Math.max(0.3, s.net)).toFixed(2)}s`;
  const dayOfMonth = Math.floor(s.day) - s.start + 1;
  readout.textContent = `${MONTHS[s.month]} ${dayOfMonth} · ${money(s.price)} · +${money(s.accrued, 3)} · ${pct(s.net)}`;
  monthBtns.forEach((btn, i) => btn.setAttribute("aria-pressed", String(i === s.month)));
  const X = cx(s.day).toFixed(1);
  headEl.setAttribute("x1", X);
  headEl.setAttribute("x2", X);
  dots.total.setAttribute("cx", X);
  dots.total.setAttribute("cy", scaleY(s.sgovValue).toFixed(1));
  dots.bank.setAttribute("cx", X);
  dots.bank.setAttribute("cy", scaleY(s.bankValue).toFixed(1));
  writeTable(s);
}

const setPlaying = (on) => {
  playing = on;
  playBtn.textContent = on ? "Pause" : "Play";
  playBtn.setAttribute("aria-pressed", String(!on));
};

playBtn.addEventListener("click", () => setPlaying(!playing));
monthBtns.forEach((btn) =>
  btn.addEventListener("click", () => {
    T = STARTS[Number(btn.dataset.month)] + 0.5;
    shown = stateAt(sim, schedule, T, opts).price;
    lastPaid = -1;
    setPlaying(false);
  }),
);
for (const [key, el] of Object.entries(inputs)) {
  el.addEventListener("input", () => {
    if (key === "rate") return setRate(Number(el.value));
    opts[key] = Number(el.value);
    recompute();
  });
}
root.addEventListener("keydown", (event) => {
  if (event.key === " ") {
    event.preventDefault();
    setPlaying(!playing);
  } else if (event.key === "ArrowUp" || event.key === "ArrowRight") {
    event.preventDefault();
    setRate(opts.rate + 0.25);
  } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
    event.preventDefault();
    setRate(opts.rate - 0.25);
  }
});

// Drag the knob: the pointer's angle around the knob's screen centre sets the rate.
const knobAt = iso([GEO.knob.x, GEO.knob.y, 7], P);
const toSvg = (event) => {
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
};
let dragging = false;
function rateFromPointer(event) {
  const p = toSvg(event);
  // Undo the iso squash so the angle reads like the dial seen from above.
  const sy = Math.sin((P.elevation ?? 30) * Math.PI / 180) || 0.5;
  let a = Math.atan2(p.x - knobAt[0], -(p.y - knobAt[1]) / sy);
  a += -((P.azimuth ?? 45) - 45) * Math.PI / 180;
  const share = clamp((a + 0.75 * Math.PI) / (1.5 * Math.PI));
  setRate(share * 6);
}
svg.addEventListener("pointerdown", (event) => {
  const p = toSvg(event);
  if (Math.hypot(p.x - knobAt[0], p.y - knobAt[1]) > 26) return;
  dragging = true;
  svg.setPointerCapture(event.pointerId);
  rateFromPointer(event);
});
svg.addEventListener("pointermove", (event) => {
  if (dragging) rateFromPointer(event);
  else {
    const p = toSvg(event);
    svg.style.cursor = Math.hypot(p.x - knobAt[0], p.y - knobAt[1]) <= 26 ? "grab" : "";
  }
});
svg.addEventListener("pointerup", () => (dragging = false));

let visible = true;
new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(root);

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (visible) {
    if (playing) {
      T += dt / DAY_SECONDS;
      if (T >= YEAR) {
        T = 0;
        lastPaid = -1;
        shown = BASE;
      }
    }
    render(now, dt);
  }
  requestAnimationFrame(tick);
}
setPlaying(playing);
recompute();
render(performance.now(), 0);
requestAnimationFrame(tick);
