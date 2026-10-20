import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import { kitScript } from "../kit/inline.mjs";
import { makeArt, GEO, CONTACT_Z, FLEX, JACKET_DROP, LEAF_GAP, BUCKLE } from "./art.mjs";
import { buildMX, buildBuckling, buildTopre, CLICKY } from "./specimens.mjs";
import * as B from "./bench.mjs";
import * as M from "./model.mjs";
import { TEXT, FACTS, COMPARE, HOW } from "./copy.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const WIDTH = 760;
const HEIGHT = 470;
const ZOOM = 2.1;
const LIFT = 46;

const P = k.fitProjection(B.corners(), WIDTH, HEIGHT, { pad: 16, azimuth: 62 });
const A = makeArt(P);

const IDS = M.SWITCHES.map((s) => s.id);
const MX = ["linear", "tactile", "clicky", "optical", "hall"];
const stub = () => [A.board(), A.plateBack(), A.plateFront(), `<g data-stem="cap">${A.cap()}</g>`].join("");
const specimen = (id) => (MX.includes(id) ? buildMX(A, P, id) : id === "buckling" ? buildBuckling(A, P) : id === "topre" ? buildTopre(A, P) : stub(id));
const specs = IDS.map((id) => (MX.includes(id) ? { floor: GEO.seat, top: id === "clicky" ? CLICKY.boss[0] : GEO.bossTop } : {}));

const body = [
  B.buildBench(A, P),
  B.buildRuler(A, P),
  B.buildFrame(A, P),
  ...IDS.map((id, i) => `<g class="kb-sp" data-sp="${id}" data-i="${i}" transform="${k.translateAlong(P, [B.XS[i], 0, 0])}">${specimen(id)}</g>`),
  `<g class="kb-gantry" data-gantry transform="${k.translateAlong(P, [B.XS[0], 0, 0])}">${B.buildCarriage(A, P)}<g data-probe>${B.buildProbeRod(A, P)}</g>${B.buildStage(A, P)}${B.buildDial(A, P)}<g data-probe>${B.buildProbeLow(A, P)}</g></g>`,
];

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A bench with seven keyboard switches cut open in a row: linear, tactile, clicky, optical, Hall effect, Topre and buckling spring. A probe on a gantry presses the selected switch, and a dial on the probe reads the force.",
  body,
});

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Seven ways to make a key",
  hint: "Drag down to press",
  readout: "",
  keys: [
    { mark: "lit", label: "What senses the press" },
    { mark: "raised", label: "Housing, plate and stem" },
    { mark: "flat", label: "Spring" },
  ],
  caption:
    "Seven key switches cut open along their front and right sides and drawn at 5 units to the millimetre of travel, on a bench with a probe that presses each in turn. The lamps on the front edge show what the controller has registered. Force and signal curves are idealised shapes drawn through published actuation points and ratings (see RESEARCH.md), not measurements of particular products.",
  body: `<div class="kb-stage" tabindex="0" role="slider" aria-label="Switch test bench. Arrow left and right choose a switch, arrow down presses, space taps, 1 to 7 jump to a switch." aria-valuemin="0" aria-valuemax="4" aria-valuenow="0">${svg}</div>`,
});

const picker = M.SWITCHES.map((s, i) => `<button type="button" class="kb-pick" data-pick="${i}" aria-pressed="${i === 0}"><span>0${i + 1}</span>${TEXT[s.id].title}</button>`).join("");

const chartSvg = (name, label) => `<svg class="kb-chart" data-chart="${name}" viewBox="0 0 220 104" role="img" aria-label="${label}"></svg>`;

const PANEL = `
<section class="kb-panel" aria-label="Controls, readings and notes for the selected switch">
  <div class="kb-controls">
    <button type="button" class="kb-btn" data-press>Press</button>
    <label class="kb-slide"><span>Travel</span><input type="range" data-travel min="0" max="4" step="0.01" value="0" aria-label="Key travel in millimetres"><b data-travel-out>0.00 mm</b></label>
    <button type="button" class="kb-btn" data-zoom aria-pressed="true">Close in</button>
    <button type="button" class="kb-btn" data-sound aria-pressed="false">Sound off</button>
    <div class="kb-hall" data-hall-controls hidden>
      <button type="button" class="kb-btn" data-hall-rapid aria-pressed="true">Rapid Trigger on</button>
      <label class="kb-slide"><span>Actuation</span><input type="range" data-hall-act min="${M.HALL.min}" max="${M.HALL.max}" step="0.1" value="${M.HALL.act}"><b data-hall-act-out>${M.HALL.act.toFixed(1)} mm</b></label>
      <label class="kb-slide"><span>Sensitivity</span><input type="range" data-hall-sens min="0.1" max="1" step="0.1" value="${M.HALL.press}"><b data-hall-sens-out>${M.HALL.press.toFixed(1)} mm</b></label>
    </div>
  </div>
  <div class="kb-picker" role="group" aria-label="Choose a switch">${picker}</div>
  <article class="kb-info" aria-live="polite">
    <h3><span data-info-title></span><small data-info-class></small></h3>
    <p class="kb-lede" data-info-lede></p>
    <h4>What you feel</h4><p data-info-feel></p>
    <h4>How it is sensed</h4><p data-info-sense></p>
    <p class="kb-watch"><b>Try this.</b> <span data-info-watch></span></p>
    <ul class="kb-facts" data-info-facts></ul>
    <p class="kb-note" data-info-note></p>
  </article>
  <div class="kb-cards">
    <figure class="kb-card"><figcaption>Force against travel</figcaption>${chartSvg("force", "Force in centinewtons against key travel in millimetres, pressing and releasing")}<p>What your finger feels. The solid line is pressing, the dashed line is letting go. The dashed vertical line is where the switch registers.</p></figure>
    <figure class="kb-card"><figcaption>What the controller reads</figcaption>${chartSvg("signal", "The signal the controller reads against key travel")}<p>The sensing signal, which can cross its threshold somewhere you cannot feel.</p></figure>
    <figure class="kb-card"><figcaption>The electrical edge, 2 ms</figcaption>${chartSvg("edge", "What a pin sees in the first two milliseconds after the key registers")}<p data-edge-note></p></figure>
  </div>
</section>`;

const COMPARE_HTML = `
<section class="kb-compare" aria-label="The seven switches compared">
  <h2>Side by side</h2>
  <div class="kb-table-wrap"><table class="kb-table"><thead><tr><th>Switch</th><th>The force curve</th><th>What senses it</th><th>Bounce</th></tr></thead><tbody>${COMPARE.map((r) => `<tr><td>${r.name}</td><td>${r.feel}</td><td>${r.sense}</td><td>${r.bounce}</td></tr>`).join("")}</tbody></table></div>
</section>`;

const HOW_HTML = `
<section class="kb-how" aria-label="How a keyboard works">
  <h2>How a keyboard works</h2>
  <ol>${HOW.map(([a, b]) => `<li><div><b>${a}</b>${b}</div></li>`).join("")}</ol>
</section>`;

const SOURCE_HTML = `
<section class="kb-source" aria-label="Where the numbers come from">
  <h2>Where the numbers come from</h2>
  <p>Actuation points, forces and travel for the Cherry-style switches come from Cherry's own pages and the Deskthority wiki. Buckling spring figures come from the Wikipedia articles on the Model M and buckling spring, Admiral Shark's Keyboards and Unicomp. Topre figures come from Geekhack measurements and a Topre-focused guide, which disagree by a few tenths of a millimetre, so the figure uses the more conservative value.</p>
  <p>The optical and Hall effect switches, and the exact shape of every force curve, are illustrative: drawn through the published points, not measured from a product. <code>RESEARCH.md</code> in this folder lists every claim with its source and marks each number as published or illustrative, and <code>node model.mjs --check</code> prints how the curves compare with the ratings.</p>
</section>`;

const strip = (src) => src.replace(/^export /gm, "").replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "");
const model = strip(readFileSync(join(HERE, "model.mjs"), "utf8")).split("// ---------- the check ----------")[0];
const shared = strip(readFileSync(join(HERE, "shared.mjs"), "utf8"));
// lathe.mjs carries its own copies of three helpers that the kit also defines; rename them so both can share one scope.
const lathe = strip(readFileSync(join(HERE, "../kit/lathe.mjs"), "utf8")).replace(/\b(signedArea|oriented|runsOf)\b/g, "$1_lathe");
const DATA = {
  P, W: WIDTH, H: HEIGHT, XS: B.XS, U: M.U, GEO, CONTACT_Z, FLEX, JACKET_DROP, LEAF_GAP, CLICKY,
  BUCKLE, DIAL: B.DIAL, STAGE: B.STAGE, PROBE: B.PROBE, LIFT, ZOOM, specs, TEXT, FACTS,
};
const live = `${lathe}\n${shared}\n${model}\nconst DATA = ${JSON.stringify(DATA)};\n${readFileSync(join(HERE, "live.js"), "utf8")}`;
const CSS = readFileSync(join(HERE, "keyboard.css"), "utf8");
const page = k.pageHtml({ title: "Keyboard switches", theme, body: `<style>${CSS}</style>${plate}${PANEL}${COMPARE_HTML}${HOW_HTML}${SOURCE_HTML}`, script: kitScript() + "\n" + live, width: 760 });
const AUTO_THEME = `<script>(()=>{const mq=matchMedia("(prefers-color-scheme: dark)");const set=()=>{document.body.dataset.theme=mq.matches?"dark":"light";document.documentElement.style.colorScheme=mq.matches?"dark":"light";};set();mq.addEventListener("change",set);})()</script>`;
const name = theme === "light" ? "index.html" : "keyboard-dark.html";
writeFileSync(join(HERE, name), theme === "light" ? page.replace('<body class="iso" data-theme="light">', `<body class="iso" data-theme="light">${AUTO_THEME}`) : page);
console.log("wrote", name, (page.length / 1024).toFixed(0) + " KB");
