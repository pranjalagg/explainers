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
const HEIGHT = 500;

// World units: one unit is about a millimetre at 1:1 for the scanner's bore (radius 46).
const GEO = {
  zc: 86,
  housing: 76,
  half: 32,
  bore: 46,
  rotor: 44,
  img: 30,
  spot: 38.5,
  det: 42.5,
  tubeR: 3.2,
  cells: 24,
  travel: M.TABLE.travel,
  base: { x: -180, y: -62, w: 300, d: 124, r: 6 },
  baseH: 10,
  table: { x: -44, y: -28, w: 72, d: 56, r: 2 },
  tableT: 4,
  patient: { a: 25.8, b: 20.4, half: 22 },
  column: { x: -42, y: -12, w: 8, d: 24, r: 1 },
};
const ZC = GEO.zc;
const TABLE_TOP = ZC - GEO.patient.b;
const F_X = G.frameOf([0, 0, ZC], [1, 0, 0], [0, 1, 0], [0, 0, 1]);

const P = k.fitProjection(
  [
    ...k.boxCorners(GEO.base, 0, GEO.baseH),
    [-GEO.half, -GEO.housing, ZC - GEO.housing],
    [GEO.half, GEO.housing, ZC + GEO.housing],
    [-GEO.half, GEO.housing, ZC + GEO.housing],
    [GEO.half, -GEO.housing, ZC - GEO.housing],
  ],
  WIDTH,
  HEIGHT,
  { pad: 28, azimuth: 52, elevation: 26 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const circle3 = (x, r, n = 72) => Array.from({ length: n }, (_, i) => {
  const a = (2 * Math.PI * i) / n;
  return [x, r * Math.cos(a), ZC + r * Math.sin(a)];
});
const ringPath = (x, r) => k.pathOf(circle3(x, r).map(at), true);

function base() {
  const out = [];
  out.push(S(k.slabOf(GEO.base, 0, GEO.baseH, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(GEO.base, 4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(GEO.base, 6), GEO.baseH, P), { tone: "lo" }));
  const screws = k.corners(GEO.base, 10);
  out.push(D(screws.map(([x, y]) => at([x, y, GEO.baseH])), { size: 0.5 }));
  const plate = { x: 62, y: -40, w: 58, d: 18, r: 1.2 };
  out.push(S(k.slabOf(plate, GEO.baseH, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 1.6), GEO.baseH + 0.8, P), { tone: "faint" }));
  return out.join("");
}

function housing() {
  const out = [];
  out.push(S(G.disc(-GEO.half, GEO.half, GEO.housing, F_X, P), { tone: "mid" }));
  out.push(`<path class="ct-bore" d="${ringPath(-GEO.half, GEO.bore)}"/>`);
  const ringFace = `${ringPath(-GEO.half, GEO.housing)}${ringPath(-GEO.half, GEO.bore)}`;
  return { back: out.join(""), faceRing: ringFace };
}

function rotorStatic() {
  const out = [];
  out.push(L(k.pathOf(circle3(-6, GEO.rotor).map(at), true) + k.pathOf(circle3(6, GEO.rotor).map(at), true), { tone: "mid" }));
  const bolts = Array.from({ length: 24 }, (_, i) => {
    const a = (2 * Math.PI * i) / 24;
    return at([-6, GEO.rotor * Math.cos(a), ZC + GEO.rotor * Math.sin(a)]);
  });
  out.push(D(bolts, { size: 0.4, tone: "lo" }));
  return out.join("");
}

function faceRing(ringFace) {
  return `<path class="ct-face" d="${ringFace}"/>` + L(`${ringPath(-GEO.half, GEO.housing)}${ringPath(-GEO.half, GEO.bore)}`, { tone: "hi" });
}

function tableColumn() {
  return S(k.slabOf(GEO.column, GEO.baseH, TABLE_TOP - GEO.tableT - GEO.baseH, P, 4, 0.6), { tone: "lo" });
}

function table() {
  const out = [];
  out.push(S(k.slabOf(GEO.table, TABLE_TOP - GEO.tableT, GEO.tableT, P, 6, 0.8), { tone: "mid" }));
  const { a, b, half } = GEO.patient;
  const ends = [-half, half].flatMap((x) =>
    Array.from({ length: 40 }, (_, i) => {
      const t = (2 * Math.PI * i) / 40;
      return at([x, a * Math.cos(t), ZC + b * Math.sin(t)]);
    }),
  );
  const hull = G.hullOf(ends);
  out.push(`<path class="ct-patient" d="${k.pathOf(hull, true)}"/>`);
  out.push(L(k.pathOf(hull, true), { tone: "hi" }));
  return out.join("");
}

const DATA = { P, GEO, TABLE_TOP };

const h = housing();
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "A CT scanner cut away at the front: a gantry with a bore, a rotor carrying an X-ray tube and a detector arc, and a table that slides the patient through the bore.",
  body: [
    base(),
    h.back,
    rotorStatic(),
    `<g data-pa>`,
    `<g data-tubes><path class="ct-beam" data-beam d=""/><path class="ct-tube" data-tube d=""/></g>`,
    `<g data-cells></g>`,
    `<g data-top transform="translate(0 0)">${table()}</g>`,
    `</g>`,
    faceRing(h.faceRing),
    `<circle class="ct-led" data-led cx="0" cy="0" r="0.8"/>`,
    `<g data-pb><g data-col transform="translate(0 0)">${tableColumn()}</g></g>`,
  ].join(""),
});

const STAGE_KEYS = M.STAGES.map((stage, i) => `<button type="button" class="ct-step" data-stage="${i}" aria-pressed="false"><span>0${i + 1}</span>${stage.label}</button>`).join("");

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "CT scanner",
  hint: "Space pauses · scrub the slice to read HU",
  readout: "",
  keys: [
    { mark: "lit", label: "The X-ray tube on the rotor, firing a beam through the patient" },
    { mark: "raised", label: "The gantry, with the bore the patient passes through" },
    { mark: "flat", label: "The patient on the table, moved through the bore" },
  ],
  caption:
    "The table moves the patient through the bore while the rotor turns the tube and detectors around them. Each detector reading is a projection; the computer back-projects all of them into a slice. The slice here is a simulated phantom, drawn with a parallel-beam model rather than the fan beam of a real scanner.",
  body: `<div class="ct-stage" tabindex="0" role="group" aria-label="CT scanner animation">${svg}</div>`,
});

const PANEL = `
<section class="ct-panel" aria-label="Scan data">
  <div class="ct-controls">
    <button type="button" class="ct-play" data-play aria-pressed="false">Pause</button>
    <div class="ct-steps" role="group" aria-label="Stages">${STAGE_KEYS}</div>
    <label class="ct-scrub"><span class="ct-scrub-label">Time</span><input type="range" data-scrub min="0" max="${M.TOTAL}" step="0.01" value="0"></label>
  </div>
  <div class="ct-cards">
    <figure class="ct-card">
      <figcaption>Detector readings</figcaption>
      <svg class="ct-profile" data-profile viewBox="0 0 96 60" preserveAspectRatio="none" role="img" aria-label="Signal at each detector for the current angle"><polyline data-profile-line points=""/></svg>
      <p class="ct-note">Angle <span data-angle>0°</span>. Each reading is how much of the beam got through.</p>
    </figure>
    <figure class="ct-card">
      <figcaption>Sinogram</figcaption>
      <canvas class="ct-sino" data-sino width="96" height="180" aria-label="Sinogram: one row per angle"></canvas>
      <p class="ct-note"><span data-sino-count>0</span> of ${M.N_ANG} projections. Each row is one angle.</p>
    </figure>
    <figure class="ct-card ct-card-wide">
      <figcaption>Reconstructed slice</figcaption>
      <div class="ct-recon-wrap">
        <canvas class="ct-recon" data-recon width="${M.GRID}" height="${M.GRID}" aria-label="Reconstructed slice"></canvas>
        <span class="ct-probe" data-probe hidden></span>
      </div>
      <p class="ct-hu" data-hu aria-live="polite">Hover the slice to read a value.</p>
    </figure>
  </div>
  <ul class="ct-scale" aria-label="Hounsfield scale">
    <li><span class="ct-swatch" data-v="air"></span>Air <b>-1000</b></li>
    <li><span class="ct-swatch" data-v="fat"></span>Fat <b>-90</b></li>
    <li><span class="ct-swatch" data-v="soft"></span>Soft tissue <b>+40</b></li>
    <li><span class="ct-swatch" data-v="bone"></span>Bone <b>+900</b></li>
  </ul>
</section>`;

const CSS = readFileSync(join(HERE, "ct.css"), "utf8");
const strip = (src) => src.replace(/^export /gm, "");
const live = `${strip(readFileSync(join(HERE, "model.mjs"), "utf8"))}\nconst DATA = ${JSON.stringify(DATA)};\n${readFileSync(join(HERE, "live.js"), "utf8")}`;
const page = k.pageHtml({ title: "CT scanner", theme, body: `<style>${CSS}</style>${plate}${PANEL}`, script: kitScript() + "\n" + live, width: 680 });
const AUTO_THEME = `<script>(()=>{const mq=matchMedia("(prefers-color-scheme: dark)");const set=()=>{document.body.dataset.theme=mq.matches?"dark":"light";document.documentElement.style.colorScheme=mq.matches?"dark":"light";};set();mq.addEventListener("change",set);})()</script>`;
const name = theme === "light" ? "index.html" : "ct-scanner-dark.html";
writeFileSync(join(HERE, name), theme === "light" ? page.replace('<body class="iso" data-theme="light">', `<body class="iso" data-theme="light">${AUTO_THEME}`) : page);
console.log("wrote", name, (page.length / 1024).toFixed(0) + " KB");
