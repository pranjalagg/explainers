// Fountain pen: the pure model the figure is driven by.
// Lengths are millimetres, volumes microlitres (1 uL = 1 mm^3), pressures pascals, forces grams-force.
// The scene is drawn at U world units per millimetre, a 4:1 teaching model on a pen-testing rig.
export const U = 4;

// Fluid and paper constants. Values are typical for a water-based ink, not measured on a particular pen.
export const INK = {
  gamma: 0.04,        // N/m, surface tension
  film: 0.008,        // mm, wet ink film left on the paper
};
export const ATM = 101325;

// Feed: a narrow ink channel (capillary) and a wide air channel (low entry pressure), both laid in the feed.
// Young-Laplace for a slot of gap h: dP = 2 * gamma / h.
export const FEED = {
  inkGap: 0.15,       // mm
  airGap: 0.5,        // mm
  buffer: 6,          // uL, held between the fins when they are full
  bare: 0.4,          // uL, what clings to a feed with no fins
  supply: 0.35,       // uL/s, what the ink channel delivers with no vacuum behind it
};
export const slotPressure = (gap) => (2 * INK.gamma) / (gap * 1e-3);
export const P_INK = slotPressure(FEED.inkGap);   // about 533 Pa: how hard the ink channel pulls
export const P_AIR = slotPressure(FEED.airGap);   // 160 Pa: the vacuum at which air gets in
export const P_PAPER = slotPressure(0.01);        // 8000 Pa: paper pores (about 10 um) pull harder than the feed

// Reservoir: a cartridge on its side of the pen, mostly full.
export const CART = { inner: 3.65, length: 29, fill: 0.7 };
export const CART_VOLUME = Math.PI * CART.inner * CART.inner * CART.length;    // uL
export const AIR_POCKET = CART_VOLUME * (1 - CART.fill);                        // uL, the air above the ink
// Ink drawn out of a sealed reservoir lowers its pressure: dP = ATM * dV / V_air (isothermal, small dV).
export const BURP_VOLUME = (AIR_POCKET * P_AIR) / ATM;                          // uL of ink per bubble

// Nib: a soft nib. Each tine is a cantilever, so the slit opens in proportion to the load until it is stopped.
export const NIB = {
  tipping: 0.4,       // mm, width of the line at no load
  perGram: 0.0045,    // mm of extra slit per gram-force
  maxSpread: 1.2,     // mm, where the nib is fully sprung
  bend: 0.9,          // mm the tip lifts toward the nib's back at full load
  railroad: 1.0,      // mm of slit above which ink no longer bridges the gap
};

export const PRESS = { min: 0, max: 300 };
export const SPEED = { min: 0, max: 100 };
// A steelyard lever: p = RIDER * d / ARM grams-force with d the rider's distance from the pivot.
export const LEVER = { rider: 100, arm: 20, reach: 60 };
export const pressureAt = (d) => (LEVER.rider * d) / LEVER.arm;
export const reachFor = (p) => (p * LEVER.arm) / LEVER.rider;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The tines open with the load; the line is the tipping plus that opening.
export function nibAt(pressure) {
  const spread = clamp(pressure * NIB.perGram, 0, NIB.maxSpread);
  return { spread, width: NIB.tipping + spread, lift: NIB.bend * (spread / NIB.maxSpread), railroad: spread > NIB.railroad };
}

export const initial = () => ({
  pressure: 40, speed: 30, vented: true, fins: true,
  heat: 0,                 // K, how much warmer the hand is making the pen
  dT: 0,                   // K, how much warmer it has got
  leak: 0,                 // uL pushed out with nowhere to go, not yet drawn on the paper
  leaked: 0,
  buffer: FEED.buffer,     // uL held in the feed
  vac: 0,                  // Pa below atmosphere inside the reservoir
  drawn: 0,                // uL that has left the reservoir
  sinceBurp: 0,            // uL drawn since the last bubble
  cool: 0,                 // s until the air channel can pass another bubble
  burps: 0,
  written: 0,              // mm of line
  fed: 1,                  // share of the ink the paper asked for that the nib could give
  flow: 0,                 // uL/s leaving the nib
  demand: 0,               // uL/s the paper asks for
  supply: 0,               // uL/s the feed is delivering
});

// One step of dt seconds. Returns how many bubbles the air channel passed (0 or 1).
export function step(s, dt, width) {
  const w = width ?? nibAt(s.pressure).width;      // the line's width: the tipping plus however far the tines have opened
  const cap = s.fins ? FEED.buffer : FEED.bare;
  // A warmer pen: the air above the ink expands by dT / T and pushes that much ink into the feed. Cooling draws it back.
  const before = s.dT;
  s.dT += clamp(s.heat - s.dT, -0.8 * dt, 0.8 * dt);
  const expand = (AIR_POCKET * (s.dT - before)) / 293;
  if (expand > 0) {
    s.buffer += expand;
    s.drawn += expand;
    if (s.buffer > cap) { s.leak += s.buffer - cap; s.leaked += s.buffer - cap; s.buffer = cap; }
  } else if (expand < 0) {
    const back = Math.min(s.buffer, -expand);
    s.buffer -= back;
    s.drawn -= back;
  }
  s.buffer = Math.min(s.buffer, cap);
  const demand = w * s.speed * INK.film;                          // uL/s the paper pulls out
  const supply = FEED.supply * Math.max(0, 1 - s.vac / P_INK);            // uL/s the ink channel can deliver
  const want = demand * dt;
  // The fins only take what they have room for once the paper has had its share.
  const room = Math.max(0, cap - s.buffer + want);
  const inflow = Math.min(supply * dt, room);
  const have = s.buffer + inflow;
  const out = Math.min(want, have);
  s.buffer = Math.min(cap, have - out);
  const fed = want > 0 ? out / want : 1;
  s.fed += (fed - s.fed) * Math.min(1, dt / 0.12);
  s.demand = demand;
  s.supply = inflow / dt;
  s.flow = out / dt;
  s.written += s.speed * dt;
  s.drawn += inflow;
  s.sinceBurp += inflow;
  s.cool = Math.max(0, s.cool - dt);
  let bubbles = 0;
  if (s.vented && s.sinceBurp >= BURP_VOLUME && s.cool === 0) {
    s.sinceBurp -= BURP_VOLUME;
    s.cool = 0.35;
    s.burps++;
    bubbles = 1;
  }
  s.vac = Math.min(P_INK, (s.sinceBurp / AIR_POCKET) * ATM);
  return bubbles;
}
