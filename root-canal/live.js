// Live layer: one clock T through the procedure; everything is redrawn from stateAt(T).
const { P } = DATA;
const stage = document.querySelector(".rc-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const q = (sel) => svg.querySelector(sel);
const el = {
  carriage: q("[data-carriage]"), head: q("[data-head]"), upper: q("[data-upper]"),
  hole: q("[data-hole]"), holeCore: q("[data-hole-core]"), holeRim: q("[data-hole-rim]"),
  lesion: q("[data-lesion]"), voidCanal: q("[data-void-canal]"), voidChamber: q("[data-void-chamber]"), capBack: q("[data-cap-back]"), spaceEdge: q("[data-space-edge]"),
  pulpChamber: q("[data-pulp-chamber]"), pulpCanal: q("[data-pulp-canal]"),
  fluid: q("[data-fluid]"), sealer: q("[data-sealer]"), gp: q("[data-gp]"), core: q("[data-core]"),
  debris: [...q("[data-debris]").children], notch: q("[data-notch]"), notchEdge: q("[data-notch-edge]"),
  cap: q("[data-cap]"), needle: q("[data-needle]"), led: q("[data-led]"), cable: q("[data-cable]"), cableIn: q("[data-cable-in]"),
};
const tools = Object.fromEntries([...svg.querySelectorAll("[data-tool]")].map((g) => [g.dataset.tool, { g, flutes: g.querySelector("[data-flutes]") }]));
const slots = Object.fromEntries([...svg.querySelectorAll("[data-slot]")].map((g) => [g.dataset.slot, g]));
const steps = [...document.querySelectorAll(".rc-step")];
const still = matchMedia("(prefers-reduced-motion: reduce)");

const f2 = (v) => (Math.round(v * 100) / 100).toString();
const fp = (pts, close = false) => (pts.length ? "M" + pts.map(([x, z]) => `${f2(x)} ${f2(-z)}`).join("L") + (close ? "Z" : "") : "");
const mirrored = (right) => [...right, ...right.slice(0, right[right.length - 1][0] === 0 ? -1 : right.length).reverse().map(([x, z]) => [-x, z])];
const screen = (pts) => pathOf(pts.map((p) => iso(p, P)));

const FORAMEN = Z.apex - rootHalf(Z.apex) - 0.6;
const DEPTH_PACK = Z.constriction + 5 * U;
const canalHalf = (z, cuts) => (canalDia(z, cuts) * U) / 2;
function wallHalf(z, cuts) {
  // Open space after access: canal, orifice funnel, chamber walls, flared access walls.
  if (z <= Z.orifice) return canalHalf(z, cuts);
  const pts = [[Z.orifice, canalHalf(Z.orifice, cuts)], [98, 6], [103, 8.4], [110, 9.2], [RIM, HOLE.high]];
  for (let i = 1; i < pts.length; i++) if (z <= pts[i][0]) { const [z0, x0] = pts[i - 1], [z1, x1] = pts[i]; return x0 + ((x1 - x0) * (z - z0)) / (z1 - z0); }
  return HOLE.high;
}
const crownTop = (from) => { const pts = []; for (let i = 0; i <= 12; i++) { const x = from * (1 - i / 12); pts.push([x, crownTopAt(x)]); } return pts; };
function band(z0, z1, fn, top = null) {
  if (z1 <= z0) return "";
  const right = [];
  const n = Math.max(2, Math.ceil(z1 - z0));
  for (let i = 0; i <= n; i++) { const z = z0 + ((z1 - z0) * i) / n; right.push([Math.max(0, fn(z)), z]); }
  if (top) right.push(...top); else right.push([0, z1]);
  return fp(mirrored(right), true);
}

function spaceOf(s) {
  const right = [];
  for (let z = FORAMEN; z < Z.orifice; z += 1) right.push([canalHalf(z, s.cuts), z]);
  right.push([canalHalf(Z.orifice, s.cuts), Z.orifice]);
  right.push(...CHAMBER.slice(0, CHAMBER_WALL));
  const open = s.cavity < Z.roof;
  if (open) {
    const wall = right.concat([[HOLE.high, RIM]]);
    const fill = wall.concat(crownTop(HOLE.high).slice(1));
    const left = wall.slice().reverse().map(([x, z]) => [-x, z]);
    const top = fill.slice(fill.findIndex(([, z]) => z >= Z.orifice));
    return { fill: fp(mirrored(fill), true), chamber: fp(mirrored(top), true), edge: fp(left) + fp(wall), open };
  }
  right.push(...CHAMBER.slice(CHAMBER_WALL));
  const all = mirrored(right);
  const top = right.slice(right.findIndex(([, z]) => z >= Z.orifice));
  return { fill: fp(all, true), chamber: fp(mirrored(top), true), edge: fp(all.slice(right.length).reverse().concat(right.slice().reverse())), open };
}
function notchOf(s) {
  const cb = s.cavity;
  if (cb >= RIM - 0.4 || cb < Z.roof) return { fill: "", edge: "" };
  const rb = Math.min(3.5, RIM - cb);
  const right = [];
  for (let i = 0; i <= 8; i++) { const a = (Math.PI / 2) * (i / 8); right.push([holeR(cb + rb) * Math.sin(a), cb + rb - rb * Math.cos(a)]); }
  for (let z = cb + rb + 2; z < RIM; z += 2) right.push([holeR(z), z]);
  right.push([HOLE.high, RIM]);
  const fill = right.concat(crownTop(HOLE.high).slice(1));
  return { fill: fp(mirrored(fill), true), edge: fp(right.slice().reverse().map(([x, z]) => [-x, z]).concat(right.slice(1))) };
}
const gpHalf = (s) => (z) => {
  const canal = canalHalf(z, s.cuts);
  const cone = Math.min(canal * 0.9, toolR("cone", z - Z.constriction));
  if (z <= DEPTH_PACK + 0.5) return cone + (canal - cone) * s.packed;
  return s.packed >= 1 ? canal : cone;
};

let lastStage = -1, needleA = DATA.NEEDLE_REST, needleWant = DATA.NEEDLE_REST, phase = 0;
function draw(s, dt) {
  const dz = s.tip - PARK;
  const move = translateAlong(P, [0, 0, dz]);
  el.carriage.setAttribute("transform", move);
  el.head.setAttribute("transform", move);
  el.upper.setAttribute("transform", move);

  // Tools: only the one in the chuck is shown, at the tip height.
  for (const [id, tool] of Object.entries(tools)) {
    const on = id === s.tool;
    tool.g.style.display = on ? "" : "none";
    if (!on) continue;
    tool.g.setAttribute("opacity", s.alpha.toFixed(3));
    tool.g.setAttribute("transform", translateAlong(P, [0, 0, s.tip]));
    phase += dt * 14 * s.spin;
    const file = FILE[id];
    if (file || id === "bur") {
      const pitch = file ? 3.2 : 1.4, lo = file ? 1.6 : 0.4, hi = file ? FLUTES : 6.6;
      const segs = [];
      for (let h = lo + (phase % pitch); h + pitch * 0.7 < hi; h += pitch) segs.push(fp([[-toolR(id, h), h], [toolR(id, h + pitch * 0.7), h + pitch * 0.7]]));
      tool.flutes.setAttribute("d", segs.join(""));
    }
  }
  for (const [id, g] of Object.entries(slots)) g.setAttribute("opacity", id === s.tool ? (1 - s.alpha).toFixed(3) : "1");

  // The cut face.
  const space = spaceOf(s);
  // Empty space shows where the pulp has gone: canal and chamber fade separately.
  el.voidCanal.setAttribute("d", band(FORAMEN, Z.orifice + 0.6, (z) => canalHalf(z, s.cuts)));
  el.voidCanal.setAttribute("opacity", (1 - s.canalPulp).toFixed(3));
  el.voidChamber.setAttribute("d", space.chamber);
  el.voidChamber.setAttribute("opacity", space.open ? "1" : (1 - s.chamberPulp).toFixed(3));
  el.spaceEdge.setAttribute("d", space.edge);
  const notch = notchOf(s);
  el.notch.setAttribute("d", notch.fill);
  el.notchEdge.setAttribute("d", notch.edge);
  const chamberRight = [[canalHalf(Z.orifice, s.cuts), Z.orifice], ...CHAMBER.slice(0, CHAMBER_WALL), ...(space.open ? [[9.6, 116], [0, 116]] : CHAMBER.slice(CHAMBER_WALL))];
  el.pulpChamber.setAttribute("d", fp(mirrored(chamberRight), true));
  el.pulpChamber.setAttribute("opacity", s.chamberPulp.toFixed(3));
  el.pulpCanal.setAttribute("d", band(FORAMEN, Z.orifice, (z) => canalHalf(z, s.cuts)));
  el.pulpCanal.setAttribute("opacity", s.canalPulp.toFixed(3));
  const pulse = s.stage === 0 && !still.matches;
  for (const node of [el.pulpChamber, el.pulpCanal]) pulse ? node.setAttribute("data-pulse", "") : node.removeAttribute("data-pulse");
  el.fluid.setAttribute("d", s.fluid > 0.001 ? band(Z.constriction - 1, s.fluidTop, (z) => wallHalf(z, s.cuts)) : "");
  el.fluid.setAttribute("opacity", s.fluid.toFixed(3));
  const fillTop = s.fillTop ?? (s.tool === "cone" ? Math.min(Z.orifice + 1, s.tip + 125) : null);
  el.sealer.setAttribute("d", s.sealer > 0.001 && fillTop ? band(Z.constriction, fillTop, (z) => canalHalf(z, s.cuts)) : "");
  el.sealer.setAttribute("opacity", s.sealer.toFixed(3));
  el.gp.setAttribute("d", s.fillTop ? band(Z.constriction, s.fillTop, gpHalf(s)) : "");
  const coreTop = Math.min(s.coreTop, RIM);
  el.core.setAttribute("d", s.core ? band(Z.orifice + 1, coreTop, (z) => wallHalf(z, s.cuts), s.coreTop >= RIM ? crownTop(HOLE.high).slice(0) : null) : "");
  const lesion = Math.max(0.001, s.lesion);
  el.lesion.setAttribute("rx", f2(LESION * lesion));
  el.lesion.setAttribute("ry", f2(LESION * 0.82 * lesion));
  el.lesion.setAttribute("opacity", Math.min(1, s.lesion * 3).toFixed(3));
  const flow = s.stage === 4 ? clamp((s.p - 0.2) / 0.6) : 0;
  const shown = s.stage === 4 ? s.fluid * (1 - clamp((s.p - 0.72) / 0.12)) : 0;
  el.debris.forEach((dot, i) => {
    const seed = (i * 0.618034) % 1;
    const span = s.fluidTop - Z.constriction - 6;
    const z = Z.constriction + 6 + (((seed + flow * 2.2) % 1) * Math.max(0, span));
    const x = canalHalf(Math.min(z, Z.orifice), s.cuts) * (((i * 0.37) % 1) * 1.3 - 0.65);
    dot.setAttribute("cx", f2(x));
    dot.setAttribute("cy", f2(-z));
    dot.setAttribute("opacity", (shown * (span > 4 ? 1 : 0)).toFixed(2));
  });

  // Opening on the occlusal table of the back half.
  const rh = s.cavity < Z.top ? HOLE.high * ease((Z.top - s.cavity) / 5) : 0;
  if (rh > 0.05) {
    const rim = Array.from({ length: 25 }, (_, i) => { const a = Math.PI + (Math.PI * i) / 24; return [rh * Math.cos(a), rh * Math.sin(a), RIM]; });
    const d = screen(rim);
    el.hole.setAttribute("d", d + "Z");
    el.holeRim.setAttribute("d", d);
    el.holeCore.setAttribute("d", d + "Z");
    el.holeCore.setAttribute("opacity", clamp((s.coreTop - (RIM - 3)) / 3).toFixed(3));
  } else for (const node of [el.hole, el.holeRim, el.holeCore]) node.setAttribute("d", "");

  // The crown comes down from above and seats.
  for (const node of [el.cap, el.capBack]) {
    node.setAttribute("opacity", clamp((1 - s.cap) * 2.5).toFixed(3));
    node.setAttribute("transform", translateAlong(P, [0, 0, s.cap * 70]));
  }

  // Apex locator needle, eased like a meter movement.
  const r = s.reading;
  const want = r === null ? DATA.NEEDLE_REST : r >= 0 ? DATA.DIAL_ZERO - (Math.min(r, 3.2) / 3) * (DATA.DIAL_ZERO - DATA.DIAL_FROM) : DATA.DIAL_ZERO + Math.min(-r, 1) * (DATA.DIAL_OVER - DATA.DIAL_ZERO);
  needleWant = want;
  needleA = still.matches ? want : needleA + (want - needleA) * (1 - Math.exp(-dt / 0.12));
  const [cx, cy] = DATA.DIAL, top = DATA.LOC_H + 2.1;
  const dir = [Math.sin(needleA), -Math.cos(needleA)];
  el.needle.setAttribute("d", lineOnTop([cx - dir[0] * 2.6, cy - dir[1] * 2.6], [cx + dir[0] * (DATA.DIAL_R - 2.4), cy + dir[1] * (DATA.DIAL_R - 2.4)], top, P));
  r !== null && Math.abs(r) < 0.15 ? el.led.setAttribute("data-on", "") : el.led.removeAttribute("data-on");

  // File-clip cable hangs from the arm to the locator.
  const [px, py, pz] = DATA.PORT, [kx, ky, kz] = DATA.CLIP;
  const c3 = [kx, ky, kz + dz];
  const sag = Math.max(30, (c3[2] - pz) * 0.45);
  const b = [[px, py, pz], [px, py, pz + sag], [c3[0], c3[1], c3[2] - sag], c3];
  const pts = Array.from({ length: 33 }, (_, i) => {
    const t = i / 32, u = 1 - t;
    return [0, 1, 2].map((a) => u * u * u * b[0][a] + 3 * u * u * t * b[1][a] + 3 * u * t * t * b[2][a] + t * t * t * b[3][a]);
  });
  const cable = screen(pts);
  el.cable.setAttribute("d", cable);
  el.cableIn.setAttribute("d", cable);

  if (readout.textContent !== s.text) readout.textContent = s.text;
  if (s.stage !== lastStage) {
    lastStage = s.stage;
    steps.forEach((button, i) => button.setAttribute("aria-pressed", String(i === s.stage)));
    stage.setAttribute("aria-valuenow", String(s.stage + 1));
    stage.setAttribute("aria-valuetext", STAGES[s.stage].label);
  }
}

// ---------- clock ----------
const KEY_P = [0.5, 0.97, 0.56, 0.93, 0.5, 0.999, 0.999];
let T = 0, target = 0, mode = still.matches ? "hold" : "tour", playEnd = 0, holdUntil = 0;
let frame = 0, last = 0, visible = false, idle = 0;
const speed = () => window.__rcSpeed ?? 1;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) * speed() : 1 / 60;
  last = now;
  if (mode === "tour") {
    T += dt;
    if (T >= TOTAL) { T = TOTAL; mode = "end"; holdUntil = now + 2600; }
  } else if (mode === "end") {
    if (now > holdUntil) { mode = "rewind"; target = 0; }
  } else if (mode === "seek" || mode === "scrub" || mode === "rewind") {
    T = still.matches ? target : T + (target - T) * (1 - Math.exp(-dt / (mode === "scrub" ? 0.22 : 0.3)));
    if (Math.abs(target - T) < 0.01) {
      T = target;
      if (mode === "seek") mode = still.matches ? "hold" : "play";
      else if (mode === "rewind") mode = "tour";
    }
  } else if (mode === "play") {
    T = Math.min(playEnd, T + dt);
    if (T >= playEnd) mode = "hold";
  }
  draw(stateAt(T), dt);
  frame = visible && (mode !== "hold" || Math.abs(needleWant - needleA) > 1e-3) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const resumeLater = (ms) => { clearTimeout(idle); if (!still.matches) idle = setTimeout(() => { mode = "tour"; run(); }, ms); };
function seek(index) {
  index = clamp(index, 0, STAGES.length - 1);
  const start = STARTS[index];
  if (still.matches) { T = target = start + STAGES[index].dur * KEY_P[index]; mode = "hold"; draw(stateAt(T), 1); return; }
  target = start + 1e-3;
  playEnd = start + STAGES[index].dur - 1e-3;
  mode = "seek";
  resumeLater(STAGES[index].dur * 1000 + 6000);
  run();
}
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.06) / 0.88);
  target = share * (TOTAL - 1e-3);
  if (still.matches) { T = target; mode = "hold"; draw(stateAt(T), 1); return; }
  mode = "scrub";
  clearTimeout(idle);
  run();
});
stage.addEventListener("pointerleave", () => { if (mode === "scrub") resumeLater(3600); });
stage.addEventListener("keydown", (event) => {
  const now = stateAt(T).stage;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = now + 1;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = now - 1;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = STAGES.length - 1;
  if (/^[1-7]$/.test(event.key)) to = Number(event.key) - 1;
  if (to === null) return;
  event.preventDefault();
  seek(to);
});
steps.forEach((button, i) => button.addEventListener("click", () => seek(i)));
if (still.matches) T = STARTS[0] + STAGES[0].dur * KEY_P[0];
draw(stateAt(T), 1);
window.__rcAt = (t) => { clearTimeout(idle); mode = "hold"; T = target = t; for (let i = 0; i < 40; i++) draw(stateAt(T), 0.05); return stateAt(T).text; };
