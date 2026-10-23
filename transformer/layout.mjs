// World layout, in units of about a millimetre of the real bench. x runs across the lanes, y along the line
// (the line flows toward +y, toward the viewer), z is up. Shared by the build script and the live script.

export const N = 8; // lanes, one per token position: <s> and up to seven words
export const PITCH = 22;
export const laneX = (i) => (i - (N - 1) / 2) * PITCH;

// Stations along the line, by y.
export const CASE_Y = -198; // the type case: the vocabulary
export const STICK_Y = -170; // the composing stick: the context
export const SPAWN_Y = -146; // where a lane's tray is made from its word
export const MODS = [-102, -54, -6, 42]; // attention 1, memory 1, attention 2, memory 2
export const MOD_KIND = ["attn", "mlp", "attn", "mlp"];
export const MOD_LAYER = [0, 0, 1, 1];
export const READ_Y = 90; // the unembedding bridge
export const DONE_Y = 136; // where finished trays park
export const RULER_Y = 174; // the probability ruler
export const BELT_Y0 = -152;
export const BELT_Y1 = 146;
export const DWELL = 19; // a tray rests this far in front of the module that works on it
export const RAIL_X = 106; // return rail for new words, on the right

// Where a tray rests at each stage of a forward pass. Stage 0 has no tray yet.
export const STAGE_Y = [SPAWN_Y, SPAWN_Y + 16, MODS[0] + DWELL, MODS[1] + DWELL, MODS[2] + DWELL, MODS[3] + DWELL, READ_Y + DWELL, DONE_Y];

export const BASE = { x: -134, y: -212, w: 260, d: 436, r: 10 };
export const BASE_H = 9;

// Tray: a slab on the belt carrying a display plate with the three banks of the residual stream.
export const TRAY = { w: 15, d: 12, h: 2, z: 1.6 };
export const PLATE = { w: 15, h: 14, d: 1.3 };

// Module: a portal over the belt. Its deck clears the tray plate.
export const MOD = { w: 20, d: 10, z: 19, h: 12, leg: 1.8 };

export const TOP = 66; // tallest thing the camera must keep in frame (cords arch above the decks)

// ---- plate faces -------------------------------------------------------------------------------------------
// Face coordinates: u across, v down from the top of the plate. Banks T and A grow up from their baselines.
// Bank O, the logit lens, grows up for positive votes and down for negative ones.
export const FACE = { rowT: 4.2, rowA: 8.2, rowO: 11.8, pitch: 1.5, bar: 1.1, hUp: 3.6, oUp: 2.8, oDown: 1.7, tMax: 5, oMax: 6.5 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rect = (u, v0, v1, w) => {
  const a = Math.min(v0, v1), b = Math.max(v0, v1);
  return b - a < 0.02 ? "" : `M${u.toFixed(2)} ${a.toFixed(2)}h${w}v${(b - a).toFixed(2)}h${-w}Z`;
};
// Three paths for one bank: what was there (base), what a step grew (grow) and what it took away (cut).
export function bankPaths(bankName, oldVals, newVals) {
  const F = FACE;
  const n = newVals.length;
  const u0 = (F.pitch * (9 - n)) / 2 + (F.pitch - F.bar) / 2 + 0.55;
  const base = F[bankName === "T" ? "rowT" : bankName === "A" ? "rowA" : "rowO"];
  const y = bankName === "O"
    ? (v) => base - (v >= 0 ? clamp(v / F.oMax, 0, 1) * F.oUp : -clamp(-v / F.oMax, 0, 1) * F.oDown)
    : (v) => base - clamp(v / F.tMax, 0, 1) * F.hUp;
  let b = "", g = "", c = "";
  for (let i = 0; i < n; i++) {
    const u = u0 + i * F.pitch;
    const o = oldVals ? oldVals[i] : newVals[i], v = newVals[i];
    if (o * v >= 0) {
      const keep = Math.abs(o) < Math.abs(v) ? o : v;
      b += rect(u, y(0), y(keep), F.bar);
      if (Math.abs(v) > Math.abs(o)) g += rect(u, y(o), y(v), F.bar);
      else c += rect(u, y(v), y(o), F.bar);
    } else {
      g += rect(u, y(0), y(v), F.bar);
      c += rect(u, y(0), y(o), F.bar);
    }
  }
  return { base: b, grow: g, cut: c };
}

// Drawer cells on the front face of a memory deck: u across (0..w), v down. n memories.
export function drawerCells(n, w = MOD.w, h = MOD.h) {
  const cols = n > 4 ? 2 : 1, rows = Math.ceil(n / cols);
  const pad = 1.3, gap = 0.7;
  const cw = (w - 2 * pad - (cols - 1) * gap) / cols, ch = (h - 2 * pad - (rows - 1) * gap) / rows;
  return Array.from({ length: n }, (_, i) => ({ u: pad + (i % cols) * (cw + gap), v: pad + Math.floor(i / cols) * (ch + gap), w: cw, h: ch }));
}
