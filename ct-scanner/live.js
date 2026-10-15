// Live layer: one clock T through the scan. Everything is redrawn from stateAt(T) and the model's data.
const { P, GEO } = DATA;
const root = document.querySelector(".ct-stage");
const svg = root.querySelector("svg");
const q = (sel) => svg.querySelector(sel);
const beamEl = q("[data-beam]");
const tubeEl = q("[data-tube]");
const cellsEl = q("[data-cells]");
const ledEl = q("[data-led]");
const tubesEl = q("[data-tubes]");
const topEl = q("[data-top]");
const colEl = q("[data-col]");
const slotA = q("[data-pa]");
const slotB = q("[data-pb]");
const playBtn = document.querySelector("[data-play]");
const scrub = document.querySelector("[data-scrub]");
const stepBtns = [...document.querySelectorAll("[data-stage]")];
const profileLine = document.querySelector("[data-profile-line]");
const angleEl = document.querySelector("[data-angle]");
const sinoCount = document.querySelector("[data-sino-count]");
const sinoCanvas = document.querySelector("[data-sino]");
const reconCanvas = document.querySelector("[data-recon]");
const reconWrap = document.querySelector(".ct-recon-wrap");
const probeEl = document.querySelector("[data-probe]");
const huEl = document.querySelector("[data-hu]");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const C = [0, 0, GEO.zc];
const CELLS = GEO.cells;
const CELL_W = (2 * GEO.img) / CELLS;
const LED_AT = [-GEO.half, 0, GEO.zc + GEO.housing - 14];

const rows = projections();
const filtered = rows.map(filter);
const peak = Math.max(...rows.map((row) => Math.max(...row)));
const toScreen = (p) => iso(p, P);

// Point on the rotor: radius r from the axis, at angle phi from the detector side (phi = PI is the tube side).
function onRotor(th, r, phi, x = 0) {
  const cp = Math.cos(phi), sp = Math.sin(phi), ct = Math.cos(th), st = Math.sin(th);
  return [x, C[1] + r * (-cp * ct - sp * st), C[2] + r * (-cp * st + sp * ct)];
}
const tangentOf = (th) => [0, -Math.sin(th), Math.cos(th)];

function hullOfPoints(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function tubePath(th) {
  const pts = [];
  const T = tangentOf(th);
  for (const r of [GEO.spot + 1, GEO.spot + 6]) {
    const base = onRotor(th, r, Math.PI);
    for (let i = 0; i < 16; i++) {
      const a = (2 * Math.PI * i) / 16;
      const p = base.map((v, j) => v + GEO.tubeR * (Math.cos(a) * (j === 0 ? 1 : 0) + Math.sin(a) * T[j]));
      pts.push(toScreen(p));
    }
  }
  return pathOf(hullOfPoints(pts), true);
}

function beamPath(th) {
  const phiMax = Math.asin(GEO.img / GEO.det);
  const tri = [onRotor(th, GEO.spot, Math.PI), onRotor(th, GEO.det, phiMax), onRotor(th, GEO.det, -phiMax)].map(toScreen);
  return pathOf(tri, true);
}

const cellEls = Array.from({ length: CELLS }, () => {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute("class", "ct-cell");
  cellsEl.appendChild(el);
  return el;
});

function cellPath(th, index) {
  const s0 = -GEO.img + index * CELL_W;
  const s1 = s0 + CELL_W;
  const phi0 = Math.asin(s0 / GEO.det), phi1 = Math.asin(s1 / GEO.det);
  const pts = [];
  for (const phi of [phi0, phi1]) {
    for (const r of [GEO.det - 1.2, GEO.det + 1.2]) {
      for (const x of [-3, 3]) pts.push(toScreen(onRotor(th, r, phi, x)));
    }
  }
  return pathOf(hullOfPoints(pts), true);
}

function cellValue(row) {
  const values = [];
  const group = rows[0].length / CELLS;
  for (let c = 0; c < CELLS; c++) {
    let sum = 0;
    for (let j = 0; j < group; j++) sum += rows[row][c * group + j];
    values.push(sum / group / peak);
  }
  return values;
}

const sinoCtx = sinoCanvas.getContext("2d");
const sinoImage = sinoCtx.createImageData(rows[0].length, rows.length);
for (let i = 0; i < rows.length; i++) {
  for (let j = 0; j < rows[i].length; j++) {
    const o = (i * rows[i].length + j) * 4;
    const v = Math.round(255 * Math.min(1, rows[i][j] / peak));
    sinoImage.data[o] = v;
    sinoImage.data[o + 1] = v;
    sinoImage.data[o + 2] = v;
    sinoImage.data[o + 3] = 255;
  }
}
let sinoDrawn = -1;
function drawSino(count) {
  if (count === sinoDrawn) return;
  sinoDrawn = count;
  const data = new ImageData(new Uint8ClampedArray(sinoImage.data), sinoImage.width, sinoImage.height);
  for (let i = count; i < rows.length; i++) {
    for (let j = 0; j < rows[i].length; j++) data.data[(i * rows[i].length + j) * 4 + 3] = 0;
  }
  sinoCtx.putImageData(data, 0, 0);
  sinoCount.textContent = String(count);
}

const reconCtx = reconCanvas.getContext("2d");
const reconImage = reconCtx.createImageData(GRID, GRID);
let recon = { count: 0, img: new Float64Array(GRID * GRID) };
function reconTo(count) {
  if (count < recon.count) recon = { count: 0, img: new Float64Array(GRID * GRID) };
  for (; recon.count < count; recon.count++) backprojectAngle(recon.img, filtered[recon.count], recon.count);
}
let reconDrawn = -1;
function windowed(hu) {
  const lo = WINDOW.level - WINDOW.width / 2;
  return Math.round(255 * Math.max(0, Math.min(1, (hu - lo) / WINDOW.width)));
}
function valueAt(col, row) {
  const gain = recon.count ? N_ANG / recon.count : 1;
  return huOf(recon.img[row * GRID + col] * gain);
}
function drawRecon(count) {
  reconTo(count);
  if (count === reconDrawn) return;
  reconDrawn = count;
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const o = (row * GRID + col) * 4;
      const within = count > 0 && inside(col, row);
      const v = within ? windowed(valueAt(col, row)) : 0;
      reconImage.data[o] = v;
      reconImage.data[o + 1] = v;
      reconImage.data[o + 2] = v;
      reconImage.data[o + 3] = within ? 255 : 0;
    }
  }
  reconCtx.putImageData(reconImage, 0, 0);
}

function drawProfile(row, count) {
  if (!count) {
    profileLine.setAttribute("points", "");
    return;
  }
  const pts = Array.from(rows[row], (v, j) => `${(j + 0.5).toFixed(2)},${(58 - (v / peak) * 54).toFixed(2)}`);
  profileLine.setAttribute("points", pts.join(" "));
}

function tableShift(dx) {
  const a = toScreen([dx, 0, 0]);
  const b = toScreen([0, 0, 0]);
  return [a[0] - b[0], a[1] - b[1]];
}

function drawRotor(s) {
  const th = s.theta;
  const on = s.beam;
  beamEl.setAttribute("d", on > 0.001 ? beamPath(th) : "");
  beamEl.style.opacity = on.toFixed(3);
  tubeEl.setAttribute("d", tubePath(th));
  const values = s.sinoCount ? cellValue(s.angleIndex) : cellValue(0);
  cellEls.forEach((el, index) => {
    el.setAttribute("d", cellPath(th, index));
    const v = values[index];
    el.style.opacity = (0.4 + 0.6 * Math.min(1, v * 1.25) * (on > 0.001 ? on : 0)).toFixed(3);
  });
  const [lx, ly] = toScreen(LED_AT);
  ledEl.setAttribute("cx", lx.toFixed(2));
  ledEl.setAttribute("cy", ly.toFixed(2));
  ledEl.toggleAttribute("data-on", on > 0.5);
}

const probeAt = (x, y) => {
  const col = ((x + 1) * GRID) / 2 - 0.5;
  const row = ((1 - y) * GRID) / 2 - 0.5;
  return { col, row };
};
let hover = null;
function placeProbe(col, row) {
  probeEl.hidden = false;
  probeEl.style.left = `${((col + 0.5) / GRID) * 100}%`;
  probeEl.style.top = `${((row + 0.5) / GRID) * 100}%`;
}
function describe(col, row, label) {
  const hu = Math.round(valueAt(col, row) / 10) * 10;
  huEl.textContent = `${label}${hu} HU, ${tissueOf(hu)}`;
}

let T = still.matches ? STARTS[4] + 2 : 0;
let playing = !still.matches;
const setPlaying = (on) => {
  playing = on;
  playBtn.textContent = on ? "Pause" : "Play";
};
setPlaying(playing);

function layer(s) {
  const inBore = s.dx > -20;
  const tubeFront = depthOf(onRotor(s.theta, GEO.spot, Math.PI), P) > depthOf(C, P);
  const back = tubeFront ? [] : [tubesEl];
  const front = tubeFront ? [cellsEl, tubesEl] : [cellsEl];
  if (inBore) {
    slotA.replaceChildren(...back, topEl, ...front);
    slotB.replaceChildren(colEl);
  } else {
    slotA.replaceChildren(...back, ...front);
    slotB.replaceChildren(topEl, colEl);
  }
}

function render(s) {
  const [sx, sy] = tableShift(s.dx);
  const shift = `translate(${sx.toFixed(2)} ${sy.toFixed(2)})`;
  topEl.setAttribute("transform", shift);
  colEl.setAttribute("transform", shift);
  layer(s);
  drawRotor(s);
  drawSino(s.sinoCount);
  drawRecon(s.reconCount);
  drawProfile(s.angleIndex, s.sinoCount);
  angleEl.textContent = `${s.degrees}°`;
  readout.textContent = `${STAGES[s.stage].label} · ${s.degrees}° · table ${s.tableMm} mm out`;
  stepBtns.forEach((btn, i) => btn.setAttribute("aria-pressed", String(i === s.stage)));
  scrub.value = String(s.time);
  scrub.setAttribute("aria-valuetext", STAGES[s.stage].label);
  if (hover) {
    placeProbe(hover.col, hover.row);
    describe(hover.col, hover.row, "");
  } else if (s.stage === 4 && reconCanvas) {
    const { col, row } = probeAt(s.probe.x, s.probe.y);
    placeProbe(Math.round(col), Math.round(row));
    describe(Math.round(col), Math.round(row), `${s.probe.name}: `);
  } else {
    probeEl.hidden = true;
    huEl.textContent = s.stage < 3 ? "The reconstruction starts after the scan." : "Hover the slice to read a value.";
  }
}

reconWrap.addEventListener("pointermove", (event) => {
  const rect = reconCanvas.getBoundingClientRect();
  const col = Math.floor(((event.clientX - rect.left) / rect.width) * GRID);
  const row = Math.floor(((event.clientY - rect.top) / rect.height) * GRID);
  hover = col >= 0 && row >= 0 && col < GRID && row < GRID && inside(col, row) ? { col, row } : null;
});
reconWrap.addEventListener("pointerleave", () => {
  hover = null;
});

playBtn.addEventListener("click", () => setPlaying(!playing));
stepBtns.forEach((btn) => btn.addEventListener("click", () => {
  T = STARTS[Number(btn.dataset.stage)] + 0.02;
  setPlaying(false);
  render(stateAt(T));
}));
scrub.addEventListener("input", () => {
  T = Number(scrub.value);
  setPlaying(false);
  render(stateAt(T));
});
root.addEventListener("keydown", (event) => {
  if (event.key === " ") {
    event.preventDefault();
    setPlaying(!playing);
  }
});

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing) T = (T + dt) % TOTAL;
  render(stateAt(T));
  requestAnimationFrame(tick);
}
render(stateAt(T));
requestAnimationFrame(tick);
