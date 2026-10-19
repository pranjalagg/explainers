import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { kitScript } from "../kit/inline.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const WIDTH = 640;
const HEIGHT = 400;

// World units are about a millimetre of a bench model. Thirteen bill cards stand in a slotted rack, one slot per week
// to maturity; each week they step one slot right, the oldest drops into the redemption box and a new one is fed in
// from the auction magazine. Income runs along a pipe into the sight-glass gauge, whose level is the share price.
const GEO = {
  base: { x: -140, y: -32, w: 256, d: 80, r: 8 },
  pitch: 11,
  slot0: -100,
  card: { t: 1.6, y0: -17, y1: 1, z0: 4, z1: 24 },
  comb: { x: -108, y: -21, w: 143, d: 26, r: 2 },
  ruler: { x: -106, y: 7, w: 142, d: 5, r: 0.8 },
  magazine: { x: -126, y: -21, w: 14, d: 26, r: 1.5 },
  boxBack: { x: 35.6, y: -21, w: 5.8, d: 26, r: 1.2 },
  boxFront: { x: 44.4, y: -21, w: 5.8, d: 26, r: 1.2 },
  boxSlot: 43,
  boxH: 16,
  housing: { x: 72, y: -20, w: 24, d: 24, r: 2 },
  housingH: 22,
  tube: { x: 84, y: -8, r: 7, z0: 25, z1: 95 },
  strip: { x: 93, y: -12.4, w: 7, d: 2.4, r: 0.4 },
  tray: { x: 84, y: 17, r: 8, h: 1.6 },
  coin: { r: 5.4, h: 0.7 },
  knob: { x: -118, y: 31, r: 6.5, dial: 13 },
  label: { x: -84, y: 25, w: 42, d: 14, r: 1.2 },
};
GEO.slot = (i) => GEO.slot0 + i * GEO.pitch;
// The gauge's scale: share price to height in the glass.
GEO.scale = { lo: 100.2, hi: 100.6, z0: 30, z1: 90 };
const zOfPrice = (p) => GEO.scale.z0 + ((p - GEO.scale.lo) / (GEO.scale.hi - GEO.scale.lo)) * (GEO.scale.z1 - GEO.scale.z0);

const P = k.fitProjection(
  [...k.boxCorners(GEO.base, -17, 0), [GEO.tube.x, GEO.tube.y, 104], [GEO.magazine.x, GEO.magazine.y, 26], [GEO.slot(0), 1, 28]],
  WIDTH,
  HEIGHT,
  { pad: 30, azimuth: 52, elevation: 30 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const screws = (plan, inset, z) => D(k.corners(plan, inset).map(([x, y]) => at([x, y, z])), { size: 0.45 });

function base() {
  const B = GEO.base;
  const out = [`<path class="iso-halo" d="${k.haloOf(B, -17, 12, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(B, 18))) {
    out.push(S(k.cylinder(x, y, 7, -17, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -15.4, 3.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(B, -12, 12, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(B, -4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(B, 5), 0, P), { tone: "lo" }));
  for (const [x, y] of k.corners(B, 10)) out.push(L(k.ring(x, y, 2.2, 0, P, 16), { tone: "lo" }));
  out.push(D(k.corners(B, 10).map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  return out.join("");
}

// Ruler under the rack: one major tick per slot (weeks to maturity), a minor tick between.
function ruler() {
  const R = GEO.ruler;
  const out = [S(k.slabOf(R, 0, 0.6, P, 3), { tone: "lo" })];
  const major = [], minor = [];
  for (let i = 0; i < M.BILLS; i++) {
    const x = GEO.slot(i);
    major.push(k.lineOnTop([x, R.y], [x, R.y + 3.4], 0.6, P));
    if (i < M.BILLS - 1) minor.push(k.lineOnTop([x + GEO.pitch / 2, R.y], [x + GEO.pitch / 2, R.y + 1.8], 0.6, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  // The maturity end of the ruler, marked like a zero.
  out.push(L(k.lineOnTop([GEO.slot(12), R.y], [GEO.slot(12), R.y + R.d], 0.6, P), { tone: "hi" }));
  return out.join("");
}

function labelPlate() {
  const p = GEO.label;
  const out = [S(k.slabOf(p, 0, 0.8, P, 4), { tone: "lo" })];
  out.push(L(k.planOutline(k.insetPlan(p, 1.6), 0.8, P), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([p.x + 4, p.y + 6.6], 0.8, P), "SGOV", { size: 4.6, tone: "mid" }));
  const rules = [[p.x + 4, p.y + 9.2, 26], [p.x + 4, p.y + 11.2, 18]];
  out.push(L(rules.map(([x, y, w]) => k.lineOnTop([x, y], [x + w, y], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([p.x + p.w - 3, p.y + 3, 0.8]), at([p.x + p.w - 3, p.y + p.d - 3, 0.8])], { size: 0.45 }));
  return out.join("");
}

function dial() {
  const { x, y, dial: R } = GEO.knob;
  const out = [S(k.cylinder(x, y, R, 0, 1, P, 56, 0.4), { tone: "lo" })];
  // 0% to 6% over 270 degrees, a tick per quarter point, a major tick per point.
  const t = k.radialTicks(x, y, R, 24, 4, 1, [1.4, 2.8], P, -0.75 * Math.PI, 1.5 * Math.PI);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  return out.join("");
}

function knob() {
  const { x, y, r } = GEO.knob;
  const out = [S(k.cylinder(x, y, r, 1, 6, P, 40, 0.5), { tone: "mid" })];
  out.push(L(k.knurl(x, y, r, 1, 7, 40, P), { tone: "lo" }));
  out.push(L(k.ring(x, y, r - 1.6, 7, P, 32), { tone: "faint" }));
  out.push(`<path class="iso-line" data-tone="hi" data-free="end" data-pointer d=""/>`);
  return out.join("");
}

function magazine() {
  const m = GEO.magazine;
  const out = [S(k.slabOf(m, 0, 14, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(m, 4, P, 4), { tone: "faint" }) })];
  // Fresh bills waiting in the magazine: card tops seen through the open top slot.
  const slot = { x: m.x + 3, y: m.y + 3, w: m.w - 6, d: m.d - 6, r: 0.6 };
  out.push(`<path class="sg-slot" d="${k.pathOf(k.ringOf(slot, 3).map(([px, py]) => at([px, py, 14])), true)}"/>`);
  const tops = [];
  for (let i = 0; i < 4; i++) {
    const cx = slot.x + 1.6 + i * 1.9;
    tops.push(k.lineOnTop([cx, slot.y], [cx, slot.y + slot.d], 14, P));
  }
  out.push(L(tops.join(""), { tone: "lo" }));
  out.push(L(k.planOutline(slot, 14, P, 3), { tone: "lo" }));
  out.push(screws(m, 1.6, 14));
  return out.join("");
}

function comb() {
  const c = GEO.comb;
  const out = [S(k.slabOf(c, 0, 4, P, 6, 0.6), { tone: "mid", inner: L(k.sideSeam(c, 1.6, P, 6), { tone: "faint" }) })];
  const slots = [];
  for (let i = 0; i < M.BILLS; i++) slots.push(k.planOutline({ x: GEO.slot(i) - 1.2, y: GEO.card.y0 - 0.6, w: 2.4, d: GEO.card.y1 - GEO.card.y0 + 1.2, r: 0.5 }, 4, P, 2));
  out.push(L(slots.join(""), { tone: "faint" }));
  out.push(D([at([c.x + 3, c.y + 3, 4]), at([c.x + 3, c.y + c.d - 3, 4]), at([c.x + c.w - 3, c.y + 3, 4]), at([c.x + c.w - 3, c.y + c.d - 3, 4])], { size: 0.45 }));
  return out.join("");
}

function box(half) {
  const p = half === "back" ? GEO.boxBack : GEO.boxFront;
  const out = [S(k.slabOf(p, 0, GEO.boxH, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(p, 5, P, 4), { tone: "faint" }) })];
  out.push(screws(p, 1.6, GEO.boxH));
  // End caps close the slot between the halves at both ends.
  const cap = { x: GEO.boxBack.x + GEO.boxBack.w - 0.4, w: GEO.boxFront.x - GEO.boxBack.x - GEO.boxBack.w + 0.8, d: 2.4, r: 0.3 };
  const capPlan = half === "back" ? { ...cap, y: p.y } : { ...cap, y: p.y + p.d - cap.d };
  out.push(S(k.slabOf(capPlan, 0, GEO.boxH, P, 2), { tone: "mid" }));
  return out.join("");
}

function pipeIn() {
  // From the redemption box to the gauge housing, along x at z 8.
  const x0 = GEO.boxFront.x + GEO.boxFront.w, x1 = GEO.housing.x;
  const F = G.frameAlong([x0, GEO.tube.y, 8], [1, 0, 0]);
  const len = x1 - x0;
  const out = [];
  out.push(S(G.disc(0, len, 1.8, F, P), { tone: "mid", crease: "none" }));
  out.push(S(G.disc(0, 1.2, 3, F, P), { tone: "mid" }));
  out.push(S(G.disc(len - 1.2, len, 3, F, P), { tone: "mid" }));
  out.push(D(G.dotsOf(F, 1.2, 2.3, 6, P, { fade: [0.04, 0.42] }), { size: 0.35 }));
  // Income moving along the pipe toward the gauge.
  out.push(`<path class="iso-line sg-flow" data-tone="hi" data-flow d="${k.segment([x0 + 1.2, GEO.tube.y + 0.6, 9.75], [x1 - 1.2, GEO.tube.y + 0.6, 9.75], P)}"/>`);
  return out.join("");
}

function housing() {
  const h = GEO.housing;
  const out = [S(k.slabOf(h, 0, GEO.housingH, P, 5, 0.8), { tone: "mid", inner: L(k.sideSeam(h, 4, P, 5), { tone: "faint" }) })];
  out.push(L(k.planOutline(k.insetPlan(h, 2.4), GEO.housingH, P, 5), { tone: "faint" }));
  out.push(screws(h, 2.4, GEO.housingH));
  const { x, y } = GEO.tube;
  out.push(S(k.cylinder(x, y, 9.6, GEO.housingH, 3, P, 48, 0.4), { tone: "mid" }));
  return out.join("");
}

function glassBack() {
  const { x, y, r, z0, z1 } = GEO.tube;
  const cyl = k.cylinder(x, y, r, z0, z1 - z0, P, 48);
  // Principal: the part of the price that never moves, $100.24 a share.
  const principal = S(k.cylinder(x, y, r - 0.8, z0, zOfPrice(M.BASE) - z0, P, 48), { tone: "hi", className: "sg-principal" });
  return `<path class="sg-cavity" d="${cyl.fill}"/>${principal}`;
}

function glassFront() {
  const { x, y, r, z0, z1 } = GEO.tube;
  const cyl = k.cylinder(x, y, r, z0, z1 - z0, P, 48);
  const out = [`<path class="sg-glass" d="${cyl.fill}"/>`];
  // A highlight down the glass, toward the light.
  const a = -0.9;
  out.push(L(k.segment([x + r * Math.cos(a), y + r * Math.sin(a) + 3.5, z0], [x + r * Math.cos(a), y + r * Math.sin(a) + 3.5, z1], P), { tone: "faint", className: "sg-shine", free: "start" }));
  out.push(L(cyl.outline, { tone: "hi" }));
  // Cap with a vent screw.
  out.push(S(k.cylinder(x, y, 9.6, z1, 4, P, 48, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 3.6, z1 + 4, 3, P, 24, 0.3), { tone: "mid" }));
  out.push(L(k.knurl(x, y, 3.6, z1 + 4, z1 + 7, 18, P, 0.3), { tone: "lo" }));
  return out.join("");
}

function scaleStrip() {
  const s = GEO.strip;
  const { z0, z1 } = GEO.tube;
  const out = [S(k.slabOf(s, z0, z1 - z0, P, 2, 0.3), { tone: "mid" })];
  const face = s.y + s.d;
  const minor = [], major = [];
  for (let i = 0; i <= 20; i++) {
    const p = GEO.scale.lo + i * 0.02;
    const z = zOfPrice(p);
    (i % 5 === 0 ? major : minor).push(k.segment([s.x, face, z], [s.x + (i % 5 === 0 ? 3.4 : 2), face, z], P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  // The principal mark: $100.24, the price right after each payout.
  const zb = zOfPrice(M.BASE);
  out.push(L(k.segment([s.x, face, zb], [s.x + 4.4, face, zb], P), { tone: "hi" }));
  out.push(D([at([s.x + 4.4, face, zb])], { size: 0.45, tone: "hi" }));
  out.push(D([at([s.x + s.w / 2, face, z0 + 2]), at([s.x + s.w / 2, face, z1 - 2])], { size: 0.4 }));
  return out.join("");
}

function tray() {
  const t = GEO.tray;
  return S(k.cylinder(t.x, t.y, t.r, 0, t.h, P, 48, 0.4), { tone: "lo" }) + L(k.ring(t.x, t.y, t.r - 1.4, t.h, P, 40), { tone: "faint" });
}

function coins() {
  const t = GEO.tray, c = GEO.coin;
  return Array.from({ length: 12 }, (_, i) => {
    const z = t.h + i * c.h;
    return `<g data-coin="${i}" style="display:none">${S(k.cylinder(t.x, t.y, c.r, z, c.h, P, 40), { tone: "hi", crease: "lo" })}</g>`;
  }).join("");
}

function spout() {
  const y0 = GEO.housing.y + GEO.housing.d;
  const t = GEO.tray;
  const z = 14;
  const F = G.frameAlong([t.x, y0, z], [0, 1, 0]);
  const len = t.y - y0;
  const out = [];
  out.push(S(G.disc(0, 1.2, 3, F, P), { tone: "mid" }));
  out.push(S(G.disc(1.2, len - 1.6, 1.6, F, P), { tone: "mid", crease: "none" }));
  // Valve on the spout: body, stem and lever. It opens on each ex-date.
  const vF = G.frameAlong([t.x, y0 + 5, z], [0, 1, 0]);
  out.push(S(G.disc(-1.6, 1.6, 2.6, vF, P), { tone: "mid" }));
  out.push(S(k.cylinder(t.x, y0 + 5, 0.8, z + 2.4, 2.2, P, 16), { tone: "mid" }));
  out.push(`<g data-lever>${S(k.slabOf({ x: t.x - 0.6, y: y0 + 5 - 0.6, w: 7, d: 1.2, r: 0.4 }, z + 4.6, 0.9, P, 2), { tone: "hi" })}</g>`);
  out.push(S(G.sphereOf([t.x, t.y, z], 2.4, P), { tone: "mid" }));
  const nF = G.frameAlong([t.x, t.y, z], [0, 0, -1]);
  out.push(S(G.disc(1.6, 3.4, 1.6, nF, P), { tone: "mid" }));
  out.push(`<path class="sg-cavity" d="${G.circleOf(nF, 3.4, 1, P)}"/>`);
  return out.join("");
}

const DATA = { P, GEO: { ...GEO, slot: undefined, scale: GEO.scale }, ZP: [GEO.scale.lo, GEO.scale.hi, GEO.scale.z0, GEO.scale.z1] };

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A bench model of the SGOV fund: thirteen Treasury bill cards stand in a slotted rack, one slot per week to maturity. Each week they step toward a redemption box, which pays out at par, and a new bill is fed in from an auction magazine. Income runs along a pipe into a sight glass whose level is the share price; on the first of each month a valve drains the income into a stack of coins, the monthly payout.",
  body: [
    base(),
    ruler(),
    labelPlate(),
    dial(),
    magazine(),
    `<g data-incoming></g>`,
    comb(),
    `<g data-cards></g>`,
    box("back"),
    `<g data-sinking></g>`,
    box("front"),
    pipeIn(),
    housing(),
    glassBack(),
    `<g data-liquid></g>`,
    glassFront(),
    scaleStrip(),
    tray(),
    coins(),
    spout(),
    `<g data-drop></g>`,
    knob(),
  ].join(""),
});

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "SGOV as a savings account",
  hint: "Drag the knob · Space pauses",
  readout: "",
  keys: [
    { mark: "lit", label: "Income accrued this month, held in the share price" },
    { mark: "raised", label: "Treasury bills, one maturing each week" },
    { mark: "flat", label: "Payouts, one coin per month" },
  ],
  caption:
    "SGOV holds about a dozen Treasury bills that mature within three months. Each bill is bought below $100 and pays $100 at maturity; that gap is the interest. It builds up in the share price every day, the way a savings account accrues interest, and is paid out as cash on the first of the month, when the price drops back by the same amount. A change in rates reaches the fund as old bills mature and new ones are bought, so within about three months.",
  body: `<div class="sg-stage" tabindex="0" role="group" aria-label="SGOV model. Arrow keys change the T-bill rate.">${svg}</div>`,
});

const MONTH_KEYS = M.MONTHS.map((m, i) => `<button type="button" class="sg-step" data-month="${i}" aria-pressed="false">${m}</button>`).join("");

const PANEL = `
<section class="sg-panel" aria-label="Compare with a savings account">
  <div class="sg-controls">
    <button type="button" class="sg-play" data-play aria-pressed="false">Pause</button>
    <div class="sg-steps" role="group" aria-label="Month">${MONTH_KEYS}</div>
  </div>
  <div class="sg-inputs">
    <label class="sg-field"><span>T-bill rate <b data-out="rate"></b></span><input type="range" data-in="rate" min="0" max="6" step="0.05" value="${M.DEFAULTS.rate}"></label>
    <label class="sg-field"><span>Savings APY <b data-out="apy"></b></span><input type="range" data-in="apy" min="0" max="6" step="0.05" value="${M.DEFAULTS.apy}"></label>
    <label class="sg-field"><span>Deposit <b data-out="deposit"></b></span><input type="range" data-in="deposit" min="1000" max="100000" step="1000" value="${M.DEFAULTS.deposit}"></label>
    <label class="sg-field"><span>Federal bracket <b data-out="fed"></b></span><input type="range" data-in="fed" min="10" max="37" step="1" value="${M.DEFAULTS.fed}"></label>
    <label class="sg-field"><span>State tax <b data-out="state"></b></span><input type="range" data-in="state" min="0" max="13.3" step="0.1" value="${M.DEFAULTS.state}"></label>
  </div>
  <figure class="sg-card sg-chart-card">
    <figcaption>One year, ${"$"}<span data-dep></span> in each</figcaption>
    <svg class="sg-chart" data-chart viewBox="0 0 600 220" role="img" aria-label="Value over a year: savings account balance, SGOV value with payouts, and SGOV share value alone">
      <g data-grid></g>
      <path class="sg-l sg-l-bank" data-line="bank"/>
      <path class="sg-l sg-l-total" data-line="total"/>
      <path class="sg-l sg-l-price" data-line="price"/>
      <line class="sg-head" data-head x1="0" x2="0" y1="8" y2="196"/>
      <circle class="sg-dot sg-l-bank" data-dot="bank" r="3"/>
      <circle class="sg-dot sg-l-total" data-dot="total" r="3"/>
    </svg>
    <ul class="sg-legend">
      <li><span class="sg-sw sg-l-bank"></span>Savings account balance</li>
      <li><span class="sg-sw sg-l-total"></span>SGOV shares plus payouts</li>
      <li><span class="sg-sw sg-l-price"></span>SGOV shares alone (drops each payout)</li>
    </ul>
  </figure>
  <table class="sg-table">
    <thead><tr><th></th><th>SGOV</th><th>High-yield savings</th></tr></thead>
    <tbody>
      <tr><th>Yield now</th><td data-c="sgovY"></td><td data-c="bankY"></td></tr>
      <tr><th>After your taxes</th><td data-c="sgovA"></td><td data-c="bankA"></td></tr>
      <tr><th>Income per month</th><td data-c="sgovM"></td><td data-c="bankM"></td></tr>
      <tr><th>Interest builds</th><td>Daily, in the share price</td><td>Daily, as accrued interest</td></tr>
      <tr><th>Paid</th><td>Monthly, as cash (or reinvested)</td><td>Monthly, added to the balance</td></tr>
      <tr><th>State income tax</th><td>Exempt (Treasury interest)</td><td>Taxed</td></tr>
      <tr><th>Backed by</th><td>US Treasury bills; not FDIC insured</td><td>FDIC insurance up to $250,000</td></tr>
      <tr><th>Rate changes</th><td>Follows T-bill auctions within about 3 months</td><td>Whenever the bank decides</td></tr>
      <tr><th>Getting money out</th><td>Sell during market hours; cash settles next business day</td><td>Transfer out, often 1 to 3 days</td></tr>
      <tr><th>Cost</th><td>0.09% a year, inside the yield</td><td>None, inside the APY</td></tr>
    </tbody>
  </table>
  <p class="sg-note" data-verdict aria-live="polite"></p>
  <p class="sg-fine">Fund figures from iShares as of Oct 16, 2026: 30-day SEC yield 3.74%, expense ratio 0.09%, price range $100.27 to $100.73 over 52 weeks. The model is simplified: thirteen weekly bills, the ex-date on the first of each month and a steady base price of $100.24. Savings APYs vary by bank; set yours above. Not investment advice.</p>
</section>`;

const CSS = readFileSync(join(HERE, "sgov.css"), "utf8");
const strip = (src) => src.replace(/^export /gm, "");
const live = `${strip(readFileSync(join(HERE, "model.mjs"), "utf8"))}\nconst DATA = ${JSON.stringify(DATA)};\n${readFileSync(join(HERE, "live.js"), "utf8")}`;
const page = k.pageHtml({ title: "SGOV vs a savings account", theme, body: `<style>${CSS}</style>${plate}${PANEL}`, script: kitScript() + "\n" + live, width: 680 });
const AUTO_THEME = `<script>(()=>{const mq=matchMedia("(prefers-color-scheme: dark)");const set=()=>{document.body.dataset.theme=mq.matches?"dark":"light";document.documentElement.style.colorScheme=mq.matches?"dark":"light";};set();mq.addEventListener("change",set);})()</script>`;
const name = theme === "light" ? "index.html" : "sgov-dark.html";
writeFileSync(join(HERE, name), theme === "light" ? page.replace('<body class="iso" data-theme="light">', `<body class="iso" data-theme="light">${AUTO_THEME}`) : page);
console.log("wrote", name, (page.length / 1024).toFixed(0) + " KB");
