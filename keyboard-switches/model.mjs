// Keyboard switches: the pure model the figure is driven by.
// Lengths are millimetres of key travel, forces centinewtons (1 cN is about 1 gram-force).
// The scene is drawn at U world units per millimetre.
//
// Where a number comes from a source it is marked [src]; everything else is ILLUSTRATIVE: a shape drawn through the
// published points, not a measurement of a particular product. RESEARCH.md lists the sources.
export const U = 5;
export const TRAVEL = 4.0;

// ---------- curve helpers ----------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const gauss = (x, c, w, h) => h * Math.exp(-0.5 * ((x - c) / w) ** 2);

// Monotone cubic through control points (Fritsch-Carlson), so a hand-typed curve never overshoots between points.
export function pchip(points) {
  const n = points.length;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const h = [];
  const d = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1] - xs[i]);
    d.push((ys[i + 1] - ys[i]) / h[i]);
  }
  const m = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return (x) => {
    const q = clamp(x, xs[0], xs[n - 1]);
    let i = 0;
    while (i < n - 2 && q > xs[i + 1]) i++;
    const t = (q - xs[i]) / h[i];
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h[i] * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h[i] * m[i + 1]
    );
  };
}

// ---------- the seven specimens ----------
// down: force while pressing, up: force while letting go. They differ by friction and by where the snap happens
// on the way back, which is why every real force curve is a loop.
const topreDown = pchip([[0, 5], [0.4, 19], [0.9, 36], [1.4, 45], [1.7, 45], [2.2, 35], [2.8, 26], [3.3, 27], [3.8, 36], [4, 44]]);
const topreUp = pchip([[0, 4], [0.4, 14], [0.9, 28], [1.4, 34], [1.7, 33], [2.2, 27], [2.8, 21], [3.3, 22], [3.8, 30], [4, 36]]);
const buckleDown = pchip([[0, 10], [0.5, 22], [1, 36], [1.5, 50], [2, 68], [2.2, 75], [2.35, 60], [2.5, 44], [3, 49], [3.5, 55], [3.8, 64]]);
const buckleUp = pchip([[0, 6], [0.5, 17], [1, 29], [1.5, 40], [1.8, 50], [1.95, 52], [2.1, 36], [2.3, 33], [2.6, 35], [3, 39], [3.4, 45], [3.8, 52]]);

export const SWITCHES = [
  {
    id: "linear",
    no: 1,
    name: "Linear",
    kind: "Metal leaf, no bump",
    travel: 4.0, // [src] Cherry
    act: 2.0, // [src] Cherry MX Red pre-travel
    release: 1.6, // ILLUSTRATIVE
    rated: 45, // [src] cN at the actuation point
    ratedAt: "act",
    down: (x) => 15 + 15 * x, // straight line through 45 cN at 2.0 mm and about 75 cN at 4.0 mm [src]; the 15 cN at rest is extrapolated
    up: (x) => 7 + 15 * x,
    sense: "contact",
    bounce: true,
    life: "50 million+",
  },
  {
    id: "tactile",
    no: 2,
    name: "Tactile",
    kind: "Metal leaf, ramp bump",
    travel: 4.0, // [src]
    act: 2.0, // [src]
    release: 1.6, // ILLUSTRATIVE
    rated: 55, // [src]
    ratedAt: "act",
    bump: { at: 1.8, width: 0.32, height: 11.5 }, // ILLUSTRATIVE position and size
    down: (x) => 23.5 + 11 * x + gauss(x, 1.8, 0.32, 11.5),
    up: (x) => 16.5 + 11 * x + gauss(x, 1.6, 0.3, 7),
    sense: "contact",
    bounce: true,
    life: "100 million+",
  },
  {
    id: "clicky",
    no: 3,
    name: "Clicky",
    kind: "Click jacket and leaf",
    travel: 4.0, // [src]
    act: 2.2, // approximate, retailer guides only
    release: 1.7, // ILLUSTRATIVE
    rated: 60, // [src]
    ratedAt: "act",
    click: { at: 2.2, drop: 18 },
    down: (x) => 25 + 12 * x + gauss(x, 1.9, 0.35, 13) - 18 * smoothstep(2.2, 2.5, x),
    up: (x) => 18 + 12 * x + gauss(x, 1.55, 0.25, 7),
    sense: "contact",
    bounce: true,
    life: "50 million+",
  },
  {
    id: "optical",
    no: 4,
    name: "Optical",
    kind: "Infrared beam, no contacts",
    travel: 4.0, // ILLUSTRATIVE
    act: 1.5, // ILLUSTRATIVE
    release: 1.5,
    schmitt: 0.04,
    rated: 45, // ILLUSTRATIVE
    ratedAt: "act",
    down: (x) => 25 + 13 * x,
    up: (x) => 18 + 13 * x,
    sense: "optical",
    bounce: false,
    life: "100 million+",
  },
  {
    id: "hall",
    no: 5,
    name: "Hall effect",
    kind: "Magnet and field sensor",
    travel: 4.0, // ILLUSTRATIVE
    act: 1.5, // default setting; the board lets you pick 0.1 to 4.0 mm [src]
    release: 1.4,
    rated: 45, // ILLUSTRATIVE
    ratedAt: "act",
    down: (x) => 25.5 + 13 * x,
    up: (x) => 18.5 + 13 * x,
    sense: "hall",
    bounce: false,
    life: "no contacts to wear",
  },
  {
    id: "topre",
    no: 6,
    name: "Topre",
    kind: "Rubber dome, conical spring, capacitive",
    travel: 4.0, // [src] (3.8 with the silencing ring)
    act: 2.2, // [src] HHKB 2.0 to 2.3; one guide says up to 3.0
    release: 2.0, // ILLUSTRATIVE
    rated: 45, // [src] the dome weight, which is the peak, not the force at 2.2 mm
    ratedAt: "peak",
    dome: { peak: 1.55, collapse: 1.7, trough: 2.9 }, // ILLUSTRATIVE
    down: topreDown,
    up: topreUp,
    sense: "capacitive",
    bounce: false,
    life: "50 million",
  },
  {
    id: "buckling",
    no: 7,
    name: "Buckling spring",
    kind: "Spring that buckles, hammer, membrane",
    travel: 3.8, // [src] Model M (membrane)
    act: 2.2, // ILLUSTRATIVE: the buckle
    release: 1.95,
    rated: 75, // [src] about 75.6 gf peak, capacitive Model F
    ratedAt: "peak",
    down: buckleDown,
    up: buckleUp,
    sense: "contact",
    bounce: true,
    life: "25 million (membrane)",
  },
];

export const byId = Object.fromEntries(SWITCHES.map((s) => [s.id, s]));

// ---------- force ----------
// s is how far the finger has turned round: 0 pressing, 1 letting go. The live page eases it so the force slides from one
// branch of the loop to the other instead of jumping.
export function force(sw, x, s = 0) {
  const q = clamp(x, 0, sw.travel);
  const a = sw.down(q);
  const b = sw.up(q);
  return a + (b - a) * clamp(s, 0, 1);
}
export const bottomOut = (sw) => sw.down(sw.travel);

// ---------- Hall effect ----------
// The magnet's field on the sensor falls roughly with the cube of the gap. The constants are ILLUSTRATIVE.
export const HALL = { gap0: 4.9, scale: 1, act: 1.5, press: 0.3, release: 0.3, dead: 0.1, min: 0.1, max: 3.9, rapid: true };
export const hallField = (x) => 1 / (1 + (HALL.gap0 - x) / HALL.scale) ** 3;
const hallLo = hallField(0);
const hallHi = hallField(TRAVEL);
export const hallSignal = (x) => (hallField(x) - hallLo) / (hallHi - hallLo);

// ---------- Optical ----------
// The flag enters the beam and cuts it off over about 0.7 mm. The light reaching the photodiode falls through one half at the
// actuation point.
export const lightLevel = (x, act = 1.5) => 1 - smoothstep(act - 0.35, act + 0.35, x);

// ---------- Topre ----------
// The conical spring flattens onto the electrodes as the dome collapses. Capacitance rises with the area that has settled.
export const topreCap = (x, act = 2.2) => {
  const t = clamp(x / 4, 0, 1);
  const base = 0.12 + 0.88 * smoothstep(0.1, 0.95, t) ** 1.6;
  const at = 0.12 + 0.88 * smoothstep(0.1, 0.95, act / 4) ** 1.6;
  return base / at * 0.5;
};
export const TOPRE_THRESHOLD = 0.5;

// ---------- sensing ----------
// One state per switch: { down, peak, valley, jacket }. step() moves it for the new position and says what happened.
export function newSense() {
  return { down: false, peak: 0, valley: 0, jacket: false, clicked: 0 };
}

export function sense(sw, st, x, set = HALL) {
  let event = null;
  const was = st.down;
  switch (sw.sense) {
    case "contact":
      if (!st.down && x >= sw.act) st.down = true;
      else if (st.down && x <= sw.release) st.down = false;
      st.jacket = st.down;
      break;
    case "optical": {
      const level = lightLevel(x, sw.act);
      if (!st.down && level < 0.5 - sw.schmitt) st.down = true;
      else if (st.down && level > 0.5 + sw.schmitt) st.down = false;
      break;
    }
    case "capacitive": {
      const c = topreCap(x, sw.act);
      if (!st.down && c >= TOPRE_THRESHOLD) st.down = true;
      else if (st.down && c <= TOPRE_THRESHOLD * (sw.release / sw.act) ** 2) st.down = false;
      break;
    }
    case "hall": {
      if (!set.rapid) {
        if (!st.down && x >= set.act) st.down = true;
        else if (st.down && x <= set.act - 0.1) st.down = false;
      } else if (st.down) {
        st.peak = Math.max(st.peak, x);
        if (x <= st.peak - set.release || x <= set.dead) {
          st.down = false;
          st.valley = x;
        }
      } else {
        st.valley = Math.min(st.valley, x);
        if (x <= set.dead) st.valley = x;
        const fresh = st.valley <= set.dead;
        if ((fresh && x >= set.act) || (!fresh && x >= st.valley + set.press && x > set.dead)) {
          st.down = true;
          st.peak = x;
        }
      }
      break;
    }
  }
  if (st.down && !was) event = "make";
  else if (!st.down && was) event = "break";
  if (event) st.clicked += 1;
  return event;
}

// The signal the controller reads, 0..1, at travel x (for the chart under the figure).
export function signal(sw, x, set = HALL) {
  switch (sw.sense) {
    case "optical": return lightLevel(x, sw.act);
    case "hall": return hallSignal(x);
    case "capacitive": return topreCap(x, sw.act);
    default: return x >= sw.act ? 1 : 0;
  }
}

// ---------- the electrical edge ----------
// 2 ms of what a pin sees when a key closes. Contacts bounce (about 5 ms in 1985, under 1 ms now [src]); everything that
// is not two bits of metal touching gives a clean edge. The number and length of the bounces is ILLUSTRATIVE and seeded,
// so the trace is the same every time you look.
export function edge(sw, seed = 1, points = 160, window = 2.0) {
  const rand = (() => { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })();
  const segments = [];
  if (sw.bounce) {
    let t = 0.2;
    let level = 1;
    const count = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      segments.push([t, level]);
      t += 0.05 + rand() * 0.14 * (1 - i / (count + 1));
      level = 1 - level;
    }
    segments.push([t, 1]);
  } else {
    segments.push([0.3, 1]);
  }
  const out = [];
  for (let i = 0; i < points; i++) {
    const t = (window * i) / (points - 1);
    let v = 0;
    for (const [at, level] of segments) if (t >= at) v = level;
    out.push([t, v]);
  }
  return { points: out, settles: segments[segments.length - 1][0], bounces: sw.bounce ? segments.length - 2 : 0 };
}

// ---------- the probe's moves ----------
// A natural finger press, as a pure function of time, for the idle tour and the Press button.
export const pressAt = (t, depth, hold = 0.18, down = 0.34, up = 0.46) => {
  if (t < 0) return 0;
  if (t < down) return depth * (0.5 - 0.5 * Math.cos((Math.PI * t) / down));
  if (t < down + hold) return depth;
  const u = (t - down - hold) / up;
  return u >= 1 ? 0 : depth * (0.5 + 0.5 * Math.cos(Math.PI * u));
};

// ---------- the check ----------
export function check() {
  const rows = [];
  for (const sw of SWITCHES) {
    const sweep = [];
    for (let i = 0; i <= 400; i++) sweep.push((sw.travel * i) / 400);
    const peak = Math.max(...sweep.map((x) => sw.down(x)));
    const at = sw.down(sw.act);
    const rated = sw.ratedAt === "peak" ? peak : at;
    const st = newSense();
    let makeAt = null;
    let breakAt = null;
    for (const x of sweep) if (sense(sw, st, x) === "make" && makeAt === null) makeAt = x;
    for (const x of [...sweep].reverse()) if (sense(sw, st, x) === "break" && breakAt === null) breakAt = x;
    let loop = true;
    for (const x of sweep) if (sw.up(x) > sw.down(x) + 0.5 && !(sw.id === "buckling" || sw.id === "topre" || sw.id === "clicky" || sw.id === "tactile")) loop = false;
    rows.push({
      id: sw.id,
      rated: sw.rated,
      ratedAt: sw.ratedAt,
      curve: +rated.toFixed(1),
      ok: Math.abs(rated - sw.rated) <= 1.5,
      actuates: makeAt === null ? null : +makeAt.toFixed(2),
      expected: sw.act,
      releases: breakAt === null ? null : +breakAt.toFixed(2),
      bottom: +sw.down(sw.travel).toFixed(1),
      loop,
    });
  }
  return rows;
}

if (typeof process !== "undefined" && process.argv && process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href && process.argv.includes("--check")) {
  const rows = check();
  console.log("switch     rated  ratedAt  curve  ok     makes  expected  breaks  bottom-out");
  for (const r of rows) console.log(`${r.id.padEnd(10)} ${String(r.rated).padStart(5)}  ${r.ratedAt.padEnd(6)}   ${String(r.curve).padStart(5)}  ${r.ok ? "yes" : "NO "}    ${String(r.actuates).padStart(5)}  ${String(r.expected).padStart(8)}  ${String(r.releases).padStart(6)}  ${String(r.bottom).padStart(9)}`);
  // Rapid Trigger walk: down past 1.5, up by 0.3 (releases), down 0.3 (makes again) without ever returning to the top.
  const sw = byId.hall;
  const st = newSense();
  const events = [];
  const path = [0, 0.5, 1.6, 3.2, 2.9, 2.6, 2.9, 3.2, 1.0, 0.7, 0.4, 0.7, 1.0, 0.0];
  for (let i = 0; i < path.length - 1; i++) for (let k = 0; k <= 20; k++) {
    const x = path[i] + ((path[i + 1] - path[i]) * k) / 20;
    const e = sense(sw, st, x, { ...HALL, rapid: true });
    if (e) events.push(`${e}@${x.toFixed(2)}`);
  }
  console.log("rapid trigger:", events.join(" "));
  const st2 = newSense();
  const events2 = [];
  for (let i = 0; i < path.length - 1; i++) for (let k = 0; k <= 20; k++) {
    const x = path[i] + ((path[i + 1] - path[i]) * k) / 20;
    const e = sense(sw, st2, x, { ...HALL, rapid: false });
    if (e) events2.push(`${e}@${x.toFixed(2)}`);
  }
  console.log("fixed point:  ", events2.join(" "));
  const bad = rows.filter((r) => !r.ok || r.actuates === null || Math.abs(r.actuates - r.expected) > 0.05 || r.releases === null);
  if (bad.length) { console.log("CHECK FAILED:", bad.map((b) => b.id).join(", ")); process.exitCode = 1; } else console.log("model check passed");
}
