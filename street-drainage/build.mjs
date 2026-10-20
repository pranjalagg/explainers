import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { kitScript } from "../kit/inline.mjs";
import * as M from "./model.mjs";
import { GEO, surfaceOf, blockSvg, chamberSvg, lateralOf } from "./street.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const WIDTH = 640;
const HEIGHT = 560;

const DEF = { rain: 75, Sx: 0.02, SL: 0.01 };
const BASE = { x: -22, y: -94, w: 284, d: 276, r: 7 };
const BASE_H = 10;
const BZ = GEO.B; // the block stands on the base's top
const POSTS = [[16, -80], [224, -80]];
const POST = 3.2; // half width of the square posts
const TOPZ = 112;
const ARM_Y = 72;
const MAN = { y: 62, z: 101, r: 2.4, x0: 8, x1: 232 };
const NOZZLES = Array.from({ length: 8 }, (_, i) => 22 + i * 28);
const FEED = { x: 5, y: -76, r: 1.8 };
const ROTA = { z0: 8, z1: 52, r: 3.6 };
const VALVE_Z = 66;

const P = k.fitProjection(
  [...k.boxCorners(BASE, BZ - BASE_H - 6, BZ), [POSTS[0][0], POSTS[0][1], TOPZ + 4], [POSTS[1][0], POSTS[1][1], TOPZ + 4], [POSTS[1][0], ARM_Y, TOPZ], [0, GEO.YB, 34]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 36, elevation: 30 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const FX = (o) => G.frameAlong(o, [1, 0, 0]);
const FY = (o) => G.frameAlong(o, [0, 1, 0]);
const FZ = (o) => G.frameAlong(o, [0, 0, 1]);

function bench() {
  const z0 = BZ - BASE_H;
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, z0 - 6, BASE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 24))) {
    out.push(S(k.cylinder(x, y, 7, z0 - 6, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, z0 - 4.4, 4.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BASE, z0, BASE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(BASE, z0 + 3, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 5), BZ, P), { tone: "lo" }));
  const screws = k.corners(BASE, 11);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, BZ, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, BZ])), { size: 0.5 }));
  // ruler along the street, one tick every 10 cm, a long one every metre
  const strip = { x: -2, y: 152, w: 244, d: 8, r: 1 };
  out.push(S(k.slabOf(strip, BZ, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const t = k.topTicks(0, 240, 4, 10, strip.y + 0.01, BZ + 0.6, [2, 4.4], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(D([at([strip.x + 1.4, strip.y + 6, BZ + 0.6]), at([strip.x + strip.w - 1.4, strip.y + 6, BZ + 0.6])], { size: 0.45 }));
  // label plate
  const plate = { x: 150, y: 164, w: 64, d: 11, r: 1.2 };
  out.push(S(k.slabOf(plate, BZ, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 1.4), BZ + 0.8, P), { tone: "faint" }));
  out.push(L(k.lineOnTop([plate.x + 6, plate.y + 3.6], [plate.x + 44, plate.y + 3.6], BZ + 0.8, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([plate.x + 6, plate.y + 5.8], [plate.x + 54, plate.y + 5.8], BZ + 0.8, P), { tone: "lo", free: true }));
  out.push(L(k.lineOnTop([plate.x + 6, plate.y + 8], [plate.x + 30, plate.y + 8], BZ + 0.8, P), { tone: "lo", free: true }));
  out.push(D([at([plate.x + 2.6, plate.y + 5.5, BZ + 0.8]), at([plate.x + plate.w - 2.6, plate.y + 5.5, BZ + 0.8])], { size: 0.45 }));
  return out.join("");
}

// A square post with a foot plate, standing on the base behind the block.
function post([x, y]) {
  const out = [];
  out.push(S(k.slabOf({ x: x - 8, y: y - 8, w: 16, d: 16, r: 1.4 }, BZ, 2, P, 3, 0.5), { tone: "mid" }));
  out.push(D([[-5, -5], [5, -5], [5, 5], [-5, 5]].map(([dx, dy]) => at([x + dx, y + dy, BZ + 2])), { size: 0.45 }));
  const plan = { x: x - POST, y: y - POST, w: POST * 2, d: POST * 2, r: 0.6 };
  out.push(S(k.slabOf(plan, BZ + 2, TOPZ - BZ - 2, P, 2, 0.4), { tone: "mid", inner: L([0, 60].map((z) => k.sideSeam(plan, z, P, 2)).join(""), { tone: "faint" }) }));
  return out.join("");
}

// Supply riser beside the left post: quick-connect on the base, rotameter, ball valve, up to the arm.
function riser() {
  const out = [];
  const { x, y, r } = FEED;
  out.push(S(k.cylinder(x, y, 3.4, BZ, 2.4, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 2.6, BZ + 2.4, 3, P, 24), { tone: "mid", inner: L(k.knurl(x, y, 2.6, BZ + 2.4, BZ + 5.4, 18, P), { tone: "lo" }) }));
  out.push(S(k.cylinder(x, y, r, BZ + 5.4, ROTA.z0 - 3 - BZ - 5.4, P, 20), { tone: "mid", crease: "none" }));
  // rotameter: end fittings, a tapered glass tube with a scale strip, and a float the live code lifts
  out.push(S(k.cylinder(x, y, ROTA.r + 1, ROTA.z0 - 3, 3, P, 28, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, ROTA.r, ROTA.z0, ROTA.z1 - ROTA.z0, P, 28), { tone: "hi", crease: "none", className: "sd-glass" }));
  const scale = [];
  for (let i = 0; i <= 15; i++) {
    const z = ROTA.z0 + 3 + ((ROTA.z1 - ROTA.z0 - 6) * i) / 15;
    const len = i % 5 === 0 ? 1.6 : 0.9;
    scale.push(k.pathOf([at([x + ROTA.r * 0.81, y + ROTA.r * 0.59, z]), at([x + ROTA.r * 0.81 - len * 0.5, y + ROTA.r * 0.59 - len, z])]));
  }
  out.push(L(scale.join(""), { tone: "lo", free: "end" }));
  out.push(`<g data-float>${S(k.cylinder(x, y, ROTA.r - 1.1, 0, 2.6, P, 20), { tone: "hi", lit: true })}</g>`);
  out.push(S(k.cylinder(x, y, ROTA.r + 1, ROTA.z1, 3, P, 28, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, r, ROTA.z1 + 3, VALVE_Z - 3 - ROTA.z1 - 3, P, 20), { tone: "mid", crease: "none" }));
  // ball valve with a lever
  out.push(S(G.sphereOf([x, y, VALVE_Z], 3.6, P), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 1.2, VALVE_Z + 3.2, 2.4, P, 16), { tone: "mid" }));
  out.push(S(k.slabOf({ x: x - 1, y: y, w: 2, d: 14, r: 0.8 }, VALVE_Z + 5.6, 1.2, P, 2), { tone: "mid" }));
  out.push(S(k.cylinder(x, y + 14, 1.6, VALVE_Z + 5.2, 2, P, 16), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, r, VALVE_Z + 3.6, MAN.z - 2.6 - VALVE_Z - 3.6, P, 20), { tone: "mid", crease: "none" }));
  out.push(S(G.sphereOf([x, y, MAN.z], 2.8, P), { tone: "mid" }));
  return out.join("");
}

// Arms, the spray manifold and its nozzles, drawn over the block.
function overhead() {
  const out = [];
  // feed run along +y under the left arm, into an elbow and the manifold
  out.push(S(G.disc(2.4, ARM_Y - 10 - FEED.y - 2.4, FEED.r, FY([FEED.x, FEED.y, MAN.z]), P), { tone: "mid", rims: "last" }));
  const run = [[FEED.y + 20, 0], [MAN.y - 20, 0]];
  for (const [yy] of run) out.push(S(G.disc(-1, 1, FEED.r + 0.6, FY([FEED.x, yy, MAN.z]), P), { tone: "lo" }));
  out.push(S(G.disc(0, MAN.y - (ARM_Y - 10) - 2.4, FEED.r, FY([FEED.x, ARM_Y - 10, MAN.z]), P), { tone: "mid", rims: "none" }));
  for (const [x] of POSTS) {
    const arm = { x: x - 2.6, y: POSTS[0][1] - POST, w: 5.2, d: ARM_Y - POSTS[0][1] + POST, r: 0.6 };
    out.push(S(k.slabOf(arm, TOPZ - 5, 5, P, 2, 0.4), { tone: "mid" }));
    out.push(S(k.slabOf({ x: x - 4.4, y: POSTS[0][1] - 4.4, w: 8.8, d: 8.8, r: 0.8 }, TOPZ - 7, 9, P, 2, 0.5), { tone: "mid" }));
    out.push(D([at([x, POSTS[0][1], TOPZ + 2])], { size: 0.55, tone: "hi" }));
    // hanger from the arm to a clamp on the manifold
    out.push(S(k.slabOf({ x: x - 1, y: MAN.y - 1, w: 2, d: 2, r: 0.3 }, MAN.z + MAN.r + 1.2, TOPZ - 5 - MAN.z - MAN.r - 1.2, P, 2), { tone: "mid" }));
    out.push(D([at([x, ARM_Y - 4, TOPZ]), at([x, POSTS[0][1] + 10, TOPZ])], { size: 0.45 }));
  }
  out.push(S(G.sphereOf([FEED.x, MAN.y, MAN.z], 2.8, P), { tone: "mid" }));
  const F = FX([MAN.x0, MAN.y, MAN.z]);
  out.push(S(G.disc(2.4, MAN.x1 - MAN.x0, MAN.r, F, P), { tone: "hi" }));
  out.push(S(G.disc(MAN.x1 - MAN.x0, MAN.x1 - MAN.x0 + 1.6, MAN.r + 0.6, F, P), { tone: "mid" }));
  for (const [x] of POSTS) out.push(S(G.disc(x - MAN.x0 - 1.2, x - MAN.x0 + 1.2, MAN.r + 0.7, F, P), { tone: "mid" }));
  for (const x of NOZZLES) {
    out.push(S(k.cylinder(x, MAN.y, 1.5, MAN.z - MAN.r - 1.6, 1.8, P, 6), { tone: "mid" }));
    out.push(S(k.cylinder(x, MAN.y, 1, MAN.z - MAN.r - 3.4, 1.8, P, 16), { tone: "mid" }));
    out.push(D([at([x, MAN.y, MAN.z - MAN.r - 3.4])], { size: 0.5, tone: "hi" }));
  }
  return out.join("");
}

const S0 = surfaceOf(DEF.Sx, DEF.SL);
const KIT = { iso: k.iso, pathOf: k.pathOf, lineSvg: k.lineSvg, dotsSvg: k.dotsSvg, faceTextSvg: k.faceTextSvg, topMatrix: k.topMatrix };

const DATA = {
  P, GEO, DEF, NOZZLES, MAN, ROTA, FEED,
  LAT: lateralOf(),
};

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "A cutaway model of a street edge on a bench under a rainfall simulator. Rain falls on the sidewalk and the road; the road's cross slope sends it to the curb, where it gathers in a narrow strip of water along the gutter, runs downhill and drops through an opening in the curb into a catch basin. A pipe carries it from the basin to the storm main under the road.",
  body: [
    bench(),
    POSTS.map(post).join(""),
    riser(),
    `<g data-block>${blockSvg(KIT, P, DEF.Sx, DEF.SL)}</g>`,
    `<clipPath id="sd-window"><path data-window-clip d=""/></clipPath>`,
    `<g clip-path="url(#sd-window)"><g data-chamber>${chamberSvg(KIT, P, DEF.Sx, DEF.SL)}</g><g data-water-in></g></g>`,
    `<g data-water></g>`,
    `<g data-rain></g>`,
    overhead(),
  ],
});

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Curb and gutter",
  hint: "Drag across to change the rain",
  readout: "",
  keys: [
    { mark: "lit", label: "The edge of the water: how far the gutter flow spreads into the road" },
    { mark: "raised", label: "Curb, gutter pan and the catch basin behind the curb opening" },
    { mark: "flat", label: "Road surface, sloped toward the curb" },
  ],
  caption:
    "A 6 m stretch of street cut through its curb opening, on a bench under a rainfall simulator. Heights at the street surface (the slopes, the curb, the water) are drawn 2.5 times taller than built so they can be seen; everything underground is true to scale, and every number comes from the FHWA HEC-22 gutter and inlet equations.",
  body: `<div class="sd-stage" tabindex="0" role="slider" aria-label="Rain intensity: arrow keys change it" aria-valuemin="0" aria-valuemax="150" aria-valuenow="${DEF.rain}">${svg}</div>`,
});

const PANEL = readFileSync(join(HERE, "panel.html"), "utf8");
const CSS = readFileSync(join(HERE, "street-drainage.css"), "utf8");
const strip = (src) => src.replace(/^import .*$/gm, "").replace(/^export /gm, "");
const live = [
  strip(readFileSync(join(HERE, "model.mjs"), "utf8")),
  strip(readFileSync(join(HERE, "street.mjs"), "utf8")),
  `const DATA = ${JSON.stringify(DATA)};`,
  readFileSync(join(HERE, "live.js"), "utf8"),
].join("\n");
const page = k.pageHtml({ title: "Curb and gutter", theme, body: `<style>${CSS}</style>${plate}${PANEL}`, script: kitScript() + "\n" + live, width: 680 });
const AUTO_THEME = `<script>(()=>{const mq=matchMedia("(prefers-color-scheme: dark)");const set=()=>{document.body.dataset.theme=mq.matches?"dark":"light";document.documentElement.style.colorScheme=mq.matches?"dark":"light";};set();mq.addEventListener("change",set);})()</script>`;
const name = theme === "light" ? "index.html" : "street-drainage-dark.html";
writeFileSync(join(HERE, name), theme === "light" ? page.replace('<body class="iso" data-theme="light">', `<body class="iso" data-theme="light">${AUTO_THEME}`) : page);
console.log("wrote", name, (page.length / 1024).toFixed(0) + " KB");
