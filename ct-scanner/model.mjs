// CT scan: the pure model. The slice is a simulated phantom on the unit disc (not a patient).
// Attenuation is measured in Hounsfield units plus 1000, so air is 0 and water is 1000.
export const N_ANG = 180;
export const N_BIN = 96;
export const GRID = 72;
export const DS = 0.01;
export const BIN = (2 * 1) / N_BIN;
export const HU = { air: -1000, fat: -90, soft: 40, lung: -750, bone: 900, lesion: 90 };
export const WINDOW = { level: 40, width: 400 };

export const STAGES = [
  { key: "lie", label: "Lie down", dur: 3 },
  { key: "rotate", label: "Rotate and measure", dur: 8 },
  { key: "sino", label: "Sinogram", dur: 3 },
  { key: "recon", label: "Reconstruct", dur: 6 },
  { key: "read", label: "Read the slice", dur: 5 },
];
export const STARTS = STAGES.reduce((list, stage, i) => (list.push(i ? list[i - 1] + STAGES[i - 1].dur : 0), list), []);
export const TOTAL = STARTS[STARTS.length - 1] + STAGES[STAGES.length - 1].dur;
export const ROTATE = { from: STARTS[1], to: STARTS[1] + STAGES[1].dur };
export const RECON = { from: STARTS[3], to: STARTS[3] + STAGES[3].dur };
export const TABLE = { in: [0, 3], out: [TOTAL - 3.5, TOTAL], travel: 120 };

const ell = (x, y, cx, cy, a, b) => ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2 <= 1;
const disc = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

export function huAt(x, y) {
  if (x * x + y * y > 1) return HU.air;
  if (disc(x, y, 0, -0.42, 0.13)) return HU.bone;
  if (disc(x, y, -0.12, 0.22, 0.1)) return HU.lesion;
  if (ell(x, y, -0.36, 0.08, 0.24, 0.36) || ell(x, y, 0.36, 0.08, 0.24, 0.36)) return HU.lung;
  if (ell(x, y, 0, 0, 0.78, 0.61)) return HU.soft;
  if (ell(x, y, 0, 0, 0.86, 0.68)) return HU.fat;
  return HU.air;
}

const angleOf = (i) => (2 * Math.PI * i) / N_ANG;
export const binT = (k) => -1 + ((k + 0.5) * 2) / N_BIN;

export function projections() {
  const rows = [];
  for (let i = 0; i < N_ANG; i++) {
    const c = Math.cos(angleOf(i)), s = Math.sin(angleOf(i));
    const row = new Float64Array(N_BIN);
    for (let k = 0; k < N_BIN; k++) {
      const t = binT(k);
      const half = Math.sqrt(Math.max(0, 1 - t * t));
      let sum = 0;
      for (let u = -half; u <= half; u += DS) sum += huAt(t * c - u * s, t * s + u * c) + 1000;
      row[k] = sum * DS;
    }
    rows.push(row);
  }
  return rows;
}

// Ram-Lak ramp filter, applied as a discrete convolution in detector bins.
const KERNEL = (() => {
  const h = new Float64Array(2 * N_BIN - 1);
  for (let n = -(N_BIN - 1); n <= N_BIN - 1; n++) {
    h[n + N_BIN - 1] = n === 0 ? 1 / (4 * BIN * BIN) : n % 2 ? -1 / (Math.PI ** 2 * n * n * BIN * BIN) : 0;
  }
  return h;
})();

export function filter(row) {
  const out = new Float64Array(N_BIN);
  for (let k = 0; k < N_BIN; k++) {
    let sum = 0;
    for (let j = 0; j < N_BIN; j++) sum += row[j] * KERNEL[k - j + N_BIN - 1];
    out[k] = sum * BIN;
  }
  return out;
}

export const pixelXY = (col, row) => [-1 + ((col + 0.5) * 2) / GRID, 1 - ((row + 0.5) * 2) / GRID];
export const inside = (col, row) => {
  const [x, y] = pixelXY(col, row);
  return x * x + y * y <= 1;
};

// Filtered back-projection, one angle at a time so the image can build up on screen.
const SCALE = Math.PI / N_ANG;
export function backprojectAngle(img, filtered, i) {
  const c = Math.cos(angleOf(i)), s = Math.sin(angleOf(i));
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if (!inside(col, row)) continue;
      const [x, y] = pixelXY(col, row);
      const t = x * c + y * s;
      const u = (t + 1) / BIN - 0.5;
      const k = Math.floor(u);
      const f = u - k;
      const a = k >= 0 && k < N_BIN ? filtered[k] : 0;
      const b = k + 1 >= 0 && k + 1 < N_BIN ? filtered[k + 1] : 0;
      img[row * GRID + col] += (a * (1 - f) + b * f) * SCALE;
    }
  }
}

export function reconstructUpTo(filtered, count) {
  const img = new Float64Array(GRID * GRID);
  for (let i = 0; i < count; i++) backprojectAngle(img, filtered[i], i);
  return img;
}

export const huOf = (value) => value - 1000;

export function tissueOf(hu) {
  if (hu < -500) return "air or lung";
  if (hu < -20) return "fat";
  if (hu < 150) return "soft tissue";
  return "bone";
}

export const PROBES = [
  { name: "spine", x: 0, y: -0.42 },
  { name: "lung", x: -0.36, y: 0.08 },
  { name: "lesion", x: -0.12, y: 0.22 },
  { name: "soft tissue", x: 0, y: -0.1 },
  { name: "fat", x: 0, y: 0.645 },
  { name: "air", x: 0.9, y: 0.6 },
];

export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const ease = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
const span = (T, [a, b]) => clamp((T - a) / (b - a));

export function stateAt(T) {
  const time = clamp(T, 0, TOTAL - 1e-6);
  let stage = STARTS.findIndex((start, i) => time >= start && time < start + STAGES[i].dur);
  if (stage < 0) stage = STAGES.length - 1;
  const inRotate = span(time, [ROTATE.from, ROTATE.to]);
  const rotating = time >= ROTATE.from && time < ROTATE.to;
  const theta = rotating ? 2 * Math.PI * inRotate : time >= ROTATE.to ? 2 * Math.PI : 0;
  const inReconAt = (time - RECON.from) / (RECON.to - RECON.from);
  const reconCount = time < RECON.from ? 0 : time >= RECON.to ? N_ANG : Math.floor(clamp(inReconAt) * N_ANG);
  const sinoCount = time < ROTATE.from ? 0 : time >= ROTATE.to ? N_ANG : Math.floor(inRotate * N_ANG) + 1;
  const beam = rotating ? ease(span(time, [ROTATE.from, ROTATE.from + 0.4])) * (1 - ease(span(time, [ROTATE.to - 0.4, ROTATE.to]))) : 0;
  const tableIn = ease(span(time, TABLE.in));
  const tableOut = ease(span(time, TABLE.out));
  const dx = -TABLE.travel * (1 - tableIn) - TABLE.travel * tableOut;
  const angleIndex = rotating ? Math.min(N_ANG - 1, Math.floor(inRotate * N_ANG)) : sinoCount ? Math.min(N_ANG - 1, sinoCount - 1) : 0;
  const probeT = stage === 4 ? span(time, [STARTS[4], STARTS[4] + STAGES[4].dur - 0.5]) : 0;
  const probeIndex = Math.min(PROBES.length - 1, Math.floor(probeT * PROBES.length));
  const degrees = Math.round(((theta * 180) / Math.PI) % 360);
  return {
    stage,
    time,
    theta,
    beam,
    dx,
    sinoCount,
    reconCount,
    angleIndex,
    degrees,
    probe: PROBES[probeIndex],
    tableMm: Math.round(-dx * 0.5),
  };
}
