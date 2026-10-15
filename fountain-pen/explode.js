// The blast-apart figure and its part explorer. The pen's six assemblies slide along the axis by fixed vectors;
// choosing one dims the rest, zooms the view onto it and shows what it is for.
const { W, H, apart, boxes, shadows, order, text, list } = DATA2;
const root = document.querySelector(".fp-x-stage");
const svg = root.querySelector("svg");
const plateEl = root.closest(".iso-plate");
const readout = plateEl.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const partEls = Object.fromEntries(order.map((n) => [n, svg.querySelector(`[data-part="${n}"]`)]));
const shadowEls = Object.fromEntries(order.map((n) => [n, svg.querySelector(`[data-shadow="${n}"]`)]));
const overlays = [...svg.querySelectorAll("[data-hl]")];
const nibCut = svg.querySelector("[data-cut]");
const nibFace = svg.querySelector("[data-face]");
overlays.forEach((el) => (el.style.display = "none"));
const ui = {
  blast: document.querySelector("[data-blast]"),
  overview: document.querySelector("[data-overview]"),
  picks: [...document.querySelectorAll("[data-pick]")],
  title: document.querySelector("[data-info-title]"),
  role: document.querySelector("[data-info-role]"),
  body: document.querySelector("[data-info-body]"),
  chips: document.querySelector("[data-info-chips]"),
  feature: document.querySelector("[data-info-feature]"),
  facts: document.querySelector("[data-info-facts]"),
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (t) => t * t * (3 - 2 * t);

let open = 1, openNow = 1;          // 1 = apart
let pick = null, feature = null, hover = null;
let vb = [0, 0, W, H], vbTarget = [0, 0, W, H];
let frame = 0, last = 0, visible = false;

const stagger = (name, f) => ease(clamp((f - list.indexOf(name) * 0.07) / 0.58, 0, 1));
const progress = (name) => stagger(name, openNow);

function fitBox([x0, y0, x1, y1], pad) {
  let w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (w / h > W / H) h = w * (H / W); else w = h * (W / H);
  w = Math.max(w, 90); h = w * (H / W);
  return [clamp(cx - w / 2, -40, W + 40 - w), clamp(cy - h / 2, -40, H + 40 - h), w, h];
}
function targetBox() {
  if (!pick) return [0, 0, W, H];
  const p = progress(pick);
  const [dx, dy] = apart[pick];
  const c = boxes[pick], f = (a, b) => a + (b - a) * p;
  let box = [f(c.closed[0], c.open[0]), f(c.closed[1], c.open[1]), f(c.closed[2], c.open[2]), f(c.closed[3], c.open[3])];
  let pad = 26;
  if (feature) {
    const el = [...partEls[pick].querySelectorAll(`[data-hl="${feature}"]`)].find((n) => n.style.display !== "none") || partEls[pick].querySelector(`[data-hl="${feature}"]`);
    if (el) {
      const bb = el.getBBox();
      box = [bb.x + dx * p, bb.y + dy * p, bb.x + bb.width + dx * p, bb.y + bb.height + dy * p];
      pad = 22;
    }
  }
  return fitBox(box, pad);
}

function layout() {
  for (const name of order) {
    const p = progress(name);
    const [dx, dy] = apart[name];
    partEls[name].setAttribute("transform", `translate(${(dx * p).toFixed(2)} ${(dy * p).toFixed(2)})`);
    const [sx, sy] = shadows[name];
    shadowEls[name].setAttribute("transform", `translate(${(sx * p).toFixed(2)} ${(sy * p).toFixed(2)})`);
  }
  svg.setAttribute("viewBox", vb.map((v) => v.toFixed(1)).join(" "));
  // The nib turns to face you as it leaves the section.
  const pn = progress("nib");
  const sm = (a, b, v) => ease(clamp((v - a) / (b - a), 0, 1));
  nibCut.style.opacity = (1 - sm(0.25, 0.55, pn)).toFixed(2);
  nibFace.style.opacity = sm(0.45, 0.75, pn).toFixed(2);
}
function dim() {
  const on = pick || hover;
  for (const name of order) partEls[name].classList.toggle("is-dim", Boolean(on) && name !== on);
  for (const el of overlays) {
    const part = el.closest("[data-part]").dataset.part;
    const variant = el.dataset.var;
    const faceNow = progress("nib") > 0.5;
    const right = !variant || (variant === "face") === faceNow;
    el.style.display = pick && part === pick && feature && el.dataset.hl === feature && right ? "" : "none";
  }
}

function describe() {
  ui.picks.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pick === pick)));
  ui.blast.textContent = open ? "Assemble" : "Blast apart";
  ui.blast.setAttribute("aria-pressed", String(Boolean(open)));
  ui.chips.textContent = "";
  ui.facts.textContent = "";
  if (!pick) {
    ui.title.textContent = "Six parts, one job";
    ui.role.textContent = "Ink has to get from the cartridge to the paper, and air has to get back.";
    ui.body.textContent = "The cartridge holds the ink. The pin and feed pass it forward, the nib puts it on the page, and the barrel, section and end cap hold it all together. Select a part to see what it does and why the pen needs it.";
    ui.feature.textContent = "";
    readout.textContent = "All six parts";
    return;
  }
  const part = text[pick];
  ui.title.textContent = part.name;
  ui.role.textContent = part.role;
  ui.body.textContent = part.body;
  for (const [key, f] of Object.entries(part.features)) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "fp-chip";
    chip.dataset.feature = key;
    chip.textContent = f.name;
    chip.setAttribute("aria-pressed", String(key === feature));
    chip.addEventListener("click", () => select(pick, feature === key ? null : key));
    ui.chips.appendChild(chip);
  }
  ui.feature.textContent = feature ? part.features[feature].text : Object.keys(part.features).length ? "Choose a feature to find it on the part and read why it is there." : "";
  for (const fact of part.facts) {
    const li = document.createElement("li");
    li.textContent = fact;
    ui.facts.appendChild(li);
  }
  readout.textContent = feature ? `${part.name}, ${part.features[feature].name.toLowerCase()}` : part.name;
}

function settle() {
  vbTarget = targetBox();
  if (still.matches) { openNow = open; vb = vbTarget.slice(); layout(); return; }
  run();
}
function select(name, key = null) {
  pick = name;
  feature = name ? key : null;
  dim();
  describe();
  if (name && !open && !still.matches) { open = 1; }
  settle();
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  openNow += clamp(open - openNow, -dt / 1.4, dt / 1.4);
  vbTarget = targetBox();
  const k = 1 - Math.exp(-dt / 0.2);
  vb = vb.map((v, i) => v + (vbTarget[i] - v) * k);
  layout();
  dim();
  const done = Math.abs(open - openNow) < 1e-3 && vb.every((v, i) => Math.abs(v - vbTarget[i]) < 0.15);
  if (done) { openNow = open; vb = vbTarget.slice(); layout(); }
  frame = visible && !done ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame) { last = 0; frame = requestAnimationFrame(tick); } }

ui.blast.addEventListener("click", () => { open = open ? 0 : 1; settle(); describe(); });
ui.overview.addEventListener("click", () => select(null));
ui.picks.forEach((b) => b.addEventListener("click", () => select(pick === b.dataset.pick ? null : b.dataset.pick)));
svg.addEventListener("click", (event) => {
  const g = event.target.closest("[data-part]");
  select(g ? (pick === g.dataset.part ? null : g.dataset.part) : null);
});
svg.addEventListener("pointerover", (event) => {
  const g = event.target.closest("[data-part]");
  const name = g ? g.dataset.part : null;
  if (name !== hover) { hover = name; dim(); }
});
svg.addEventListener("pointerleave", () => { hover = null; dim(); });
root.addEventListener("keydown", (event) => {
  const i = pick ? list.indexOf(pick) : -1;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); select(list[(i + 1) % list.length]); }
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); select(list[(i - 1 + list.length) % list.length]); }
  else if (event.key === "Escape") select(null);
  else if (event.key === " ") { event.preventDefault(); open = open ? 0 : 1; settle(); describe(); }
});
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(root);

layout();
dim();
describe();
