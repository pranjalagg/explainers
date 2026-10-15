// The sectioned pen as drawing: six assemblies, each its own group so they can be pulled apart.
// buildPen is called once for the rig (live hooks, empty ink) and once for the blast-apart figure (static ink, highlights).
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as M from "./model.mjs";
import * as Pen from "./pen.mjs";

const { U } = M;
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const f1 = (v) => (Math.round(v * 10) / 10).toString();

// Order they are painted in, rear to front. Each hides what lies behind it where they overlap.
export const ORDER = ["cap", "barrel", "cartridge", "section", "feed", "nib"];

export function buildPen({ FR, P, idp, live }) {
  const at = (p) => k.iso(p, P);
  const stPt = ([s, t], y = 0) => at(FR.w(s, t, y));
  const stPath = (pts, close = false) => k.pathOf(pts.map((p) => stPt(p)), close);
  const stPoly = (pts) => stPath(pts, true);
  const st3 = ([s, t, y]) => at(FR.w(s, t, y));
  const F_PEN = G.frameOf(FR.w(0, 0, 0), Pen.AX, Pen.NM, [0, -1, 0]);
  const cutFill = (pts, cls) => `<path class="fp-cut ${cls}" d="${stPoly(pts)}"/>`;
  const cutEdge = (pts, tone = "hi") => L(stPoly(pts), { tone });
  const hl = (name, polys, lines = false) => `<path class="${lines ? "fp-hl-line" : "fp-hl"}" data-hl="${name}" d="${polys.map((poly) => stPath(poly, !lines)).join("")}"/>`;

  // The turned shell pieces are drawn as the half behind the cut plane: the whole body, clipped to the hull of its back half.
  let clip = 0;
  function halfBody(paths, rOf, s0, s1) {
    const id = `${idp}-half-${clip++}`;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const s = s0 + ((s1 - s0) * i) / 40;
      const r = Math.max(0.01, rOf(s));
      for (let j = 0; j <= 28; j++) pts.push(at(G.pointOf(F_PEN, s * U, r * U, (Math.PI * j) / 28)));
    }
    const hull = k.pathOf(G.hullOf(pts), true);
    return `<clipPath id="${id}"><path d="${hull}"/></clipPath><g clip-path="url(#${id})">${S({ ...paths, outline: "" }, { tone: "hi" })}</g>${L(hull, { tone: "hi", className: "iso-edge" })}`;
  }

  // A soft gradient across a bore: the far wall of a hollow part seen from inside.
  const wallDefs = (s, r) => {
    const a = stPt([s, -r]);
    const b = stPt([s, r]);
    return `<defs><linearGradient id="${idp}-wall" gradientUnits="userSpaceOnUse" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}"><stop offset="0" style="stop-color:var(--anatomy-shade-0)"/><stop offset=".5" style="stop-color:var(--anatomy-shade-3)"/><stop offset="1" style="stop-color:var(--anatomy-shade-1)"/></linearGradient></defs>`;
  };
  const wall = (poly) => `<path class="fp-wall" style="fill:url(#${idp}-wall)" d="${stPoly(poly)}"/>`;

  const upper = (pts) => [...pts, ...pts.slice().reverse().map(([s, t]) => [s, -t])];
  const parts = {};
  const volume0 = M.CART_VOLUME * M.CART.fill;

  // ---- end cap ----
  {
    const knots = [];
    for (let i = 0; i <= 22; i++) {
      const s = Pen.S_CAP + (Pen.LEN - Pen.S_CAP) * (1 - Math.pow(1 - i / 22, 1.6));
      knots.push(i === 22 ? [Pen.LEN * U, 0] : [s * U, Pen.capR(s) * U, i > 0 ? 1 : 0]);
    }
    const paths = G.solidOf(knots, F_PEN, P, { smooth: { slope: (s) => Pen.capSlope(s / U) } });
    const cap = Pen.endCap();
    parts.cap = {
      svg: halfBody(paths, Pen.capR, Pen.S_CAP, Pen.LEN) + cutFill(cap, "fp-resin") + cutEdge(cap) + (live ? "" : hl("cap", [cap])),
      poly: cap,
    };
  }

  // ---- barrel ----
  {
    const outline = upper([[Pen.S_JOINT, Pen.R_RING], [Pen.S_RING, Pen.R_RING], [Pen.S_RING, Pen.R_BAR], [Pen.S_CAP, Pen.R_BAR]]);
    const bar = Pen.barrelWall();
    const exterior =
      halfBody(G.disc(Pen.S_RING * U, Pen.S_CAP * U, Pen.R_BAR * U, F_PEN, P), () => Pen.R_BAR, Pen.S_RING, Pen.S_CAP) +
      halfBody(G.disc(Pen.S_JOINT * U, Pen.S_RING * U, Pen.R_RING * U, F_PEN, P, { bevel: 0.4 }), () => Pen.R_RING, Pen.S_JOINT, Pen.S_RING);
    const bore = Pen.rect(Pen.S_JOINT, Pen.S_CAP, -Pen.R_BAR_IN, Pen.R_BAR_IN);
    parts.barrel = {
      svg:
        exterior + cutFill(outline, "fp-void") + wallDefs(60, Pen.R_BAR_IN) + wall(bore) +
        [bar, Pen.mirrorT(bar)].map((w) => cutFill(w, "fp-resin") + cutEdge(w)).join("") +
        (live ? "" : hl("bore", [bore]) + hl("ring", [Pen.rect(Pen.S_JOINT, Pen.S_RING, Pen.R_BAR_IN, Pen.R_RING), Pen.rect(Pen.S_JOINT, Pen.S_RING, -Pen.R_RING, -Pen.R_BAR_IN)])),
      poly: outline,
    };
  }

  // ---- cartridge ----
  {
    const shell = Pen.cartridgeShell();
    const inside = Pen.cartridgeInterior();
    const level = Pen.levelFor(volume0);
    const ink = Pen.cartInk(level);
    const edge = ink.filter(([s, t]) => Math.abs(Pen.upOf(s, t) - level) < 1e-3);
    const plug = Pen.plug();
    parts.cartridge = {
      svg:
        cutFill(shell, "fp-cart") + cutEdge(shell, "mid") +
        wall(inside) + cutEdge(inside, "faint") +
        (live
          ? `<path class="fp-ink" data-ink-cart d=""/><path class="iso-line" data-tone="mid" data-surface d=""/>`
          : `<path class="fp-ink" d="${stPoly(ink)}"/>${edge.length >= 2 ? L(stPath([edge[0], edge[edge.length - 1]]), { tone: "mid" }) : ""}`) +
        cutFill(plug, "fp-plug") + cutEdge(plug, "mid") +
        (live ? "" : hl("ink", [ink]) + hl("air", [Pen.clipAbove(inside, level)]) + hl("plug", [plug])),
      poly: [...shell, ...plug],
    };
  }

  // ---- section (the grip) ----
  {
    const grip = Pen.gripWall();
    const up = [];
    for (let s = Pen.S_FRONT; s <= Pen.S_FLARE; s += 1) up.push([s, Pen.flareR(s)]);
    up.push([Pen.S_JOINT, Pen.R_GRIP], [Pen.S_JOINT, 4.5], [47, 4.5]);
    const outline = upper(up);
    const bore = [[Pen.S_FRONT, -Pen.R_NIB], [36.5, -Pen.R_NIB], [36.5, -3.8], [Pen.S_JOINT, -3.8], [Pen.S_JOINT, -3.0], [47, -3.0], [47, 3.0], [Pen.S_JOINT, 3.0], [Pen.S_JOINT, 3.8], [36.5, 3.8], [36.5, Pen.R_NIB], [Pen.S_FRONT, Pen.R_NIB]];
    const exterior = (() => {
      const gk = [];
      for (let i = 0; i <= 22; i++) {
        const s = Pen.S_FRONT + ((Pen.S_FLARE - Pen.S_FRONT) * i) / 22;
        gk.push([s * U, Pen.flareR(s) * U, i > 0 ? 1 : 0]);
      }
      gk.push([Pen.S_JOINT * U, Pen.R_GRIP * U, 0]);
      const paths = G.solidOf(gk, F_PEN, P, { smooth: { slope: (s) => Pen.flareSlope(s / U) } });
      return halfBody(paths, (s) => (s < Pen.S_FLARE ? Pen.flareR(s) : Pen.R_GRIP), Pen.S_FRONT, Pen.S_JOINT);
    })();
    const threads = Pen.threads();
    parts.section = {
      svg:
        exterior + cutFill(outline, "fp-void") + wallDefs(30, 3.8) + wall(bore) +
        [grip, Pen.mirrorT(grip)].map((w) => cutFill(w, "fp-resin") + cutEdge(w)).join("") +
        L(threads.map((pts) => stPath(pts)).join(""), { tone: "lo" }) +
        (live ? "" : hl("threads", threads, true) + hl("grip", [grip, Pen.mirrorT(grip)])),
      poly: outline,
    };
  }

  // ---- feed, with its comb, channels and pin ----
  {
    const feed = Pen.feedShape();
    const slots = Pen.slots();
    const tunnel = Pen.airTunnel();
    const plugBox = Pen.rect(24, 28.6, Pen.AIR.t0, Pen.AIR.t1);
    const combEnd = Pen.COMB.s0 + (Pen.COMB.count - 1) * Pen.COMB_PITCH + Pen.COMB.tooth;
    const channel = Pen.channelInk(0.6, 0);
    const slotInk = slots.map((slot, i) =>
      live ? `<path class="fp-ink" data-slot="${i}" d=""/>` : `<path class="fp-ink" d="${stPoly(Pen.slotInk(i, 1))}"/>`);
    parts.feed = {
      svg:
        cutFill(feed, "fp-feed") + cutEdge(feed) +
        cutFill(tunnel, "fp-void") + cutEdge(tunnel, "faint") +
        cutFill(Pen.collector(), "fp-void") +
        cutFill(Pen.inkLumen(), "fp-void") + `<path class="fp-ink" d="${stPoly(Pen.inkLumen())}"/>` +
        `<path class="fp-ink" d="${stPoly(Pen.collector())}"/>` +
        slots.map((slot, i) => cutFill(slot, "fp-void") + slotInk[i]).join("") +
        `<g data-fins-cover style="display:none">${slots.map((slot) => cutFill(slot, "fp-feed")).join("")}${L(stPath([[Pen.COMB.s0, Pen.FEED_TOP], [combEnd, Pen.FEED_TOP]]), { tone: "hi" })}</g>` +
        (live
          ? `<path class="fp-ink" data-channel d=""/>`
          : `<path class="fp-ink" d="${stPoly(channel)}"/>`) +
        (live ? `<path class="fp-flow" data-flow-line d="${stPath(Pen.FLOW_PATH)}"/>` : "") +
        (live ? `<g data-plug>${cutFill(plugBox, "fp-plug")}${cutEdge(plugBox, "mid")}</g><g data-bubbles></g>` : "") +
        (live
          ? ""
          : hl("fins", slots) + hl("inkchannel", [channel]) + hl("airchannel", [tunnel]) + hl("collector", [Pen.collector(), Pen.inkLumen()]) + hl("pin", [Pen.rect(47, Pen.PIN_END, -1.4, 1.4)])),
      poly: feed,
    };
  }

  // ---- nib ----
  {
    const g = Pen.nibGeometry(0, 0);
    const platePoly = [...g.plate.under, ...g.plate.top.slice().reverse()];
    const tipAt = st3([g.tip[0], g.tip[1], -0.25]);
    const tipR = (Pen.TIP.r * U * k.cameraOf(P).k * 0.92).toFixed(2);
    const skeleton = (fill) => {
      const strips = [0, 1, 2, 3].map((i) => `<path class="fp-tine" data-strip="${i}" data-t="${3 - i}" d="${fill ? k.pathOf(g.strips[i].pts.map(st3), true) : ""}"/>`).join("");
      return (
        `<path class="fp-cut fp-nib" data-plate-fill d="${fill ? stPoly(platePoly) : ""}"/>` +
        `<path class="iso-line" data-tone="lit" data-plate-edge d="${fill ? stPoly(platePoly) : ""}"/>` +
        strips +
        `<path class="iso-line" data-tone="lit" data-tine-line d="${fill ? k.pathOf(g.outline.map(st3), true) : ""}"/>` +
        `<circle class="fp-tip" data-tip cx="${f1(tipAt[0])}" cy="${f1(tipAt[1])}" r="${tipR}"/>`
      );
    };
    const hole = Pen.arc(Pen.BREATHER.s, 3.35, Pen.BREATHER.r, 0, Math.PI * 2, 16);
    const nibPoly = [...g.outline.map(([s, t]) => [s, t]), ...platePoly];
    let face = "";
    let faceScreen = null;
    if (!live) {
      // Pulled out of the section the nib is turned to face you, so both tines, the slit and the breather hole show.
      const V = G.viewOf(P);
      const roll = Math.atan2(V[1], G.dot3(V, Pen.NM));
      const f = Pen.nibFace(roll);
      const toWorld = (n) => [Pen.AX[0] * n[0] + Pen.NM[0] * n[1], n[2], Pen.AX[2] * n[0] + Pen.NM[2] * n[1]];
      const pl = (pts) => k.pathOf(pts.map(st3), true);
      const strips = f.strips.map((s) => `<path class="fp-face" data-t="${G.toneOf(toWorld(s.normal), P)}" d="${pl(s.pts)}"/>`).join("");
      faceScreen = f.outline.map(st3);
      const ftip = (poly) => `<path class="fp-tip-face" d="${pl(poly)}"/>`;
      face =
        `<g class="fp-nib-face" data-face style="opacity:0">` +
        strips +
        `<path class="fp-cut fp-void" d="${pl(f.hole)}"/><path class="iso-line" data-tone="lit" d="${pl(f.hole)}"/>` +
        `<path class="fp-cut fp-void" d="${pl(f.slit)}"/>` +
        `<path class="iso-line" data-tone="lit" d="${pl(f.outline)}"/>` +
        f.tips.map(ftip).join("") +
        `<path class="fp-hl" data-hl="slit" data-var="face" d="${pl(f.slit)}"/>` +
        `<path class="fp-hl" data-hl="breather" data-var="face" d="${pl(f.hole)}"/>` +
        f.tips.map((poly) => `<path class="fp-hl" data-hl="tipping" data-var="face" d="${pl(poly)}"/>`).join("") +
        `<path class="fp-hl" data-hl="plate" data-var="face" d="${pl(f.outline)}"/>` +
        `</g>`;
    }
    parts.nib = {
      svg:
        `<g class="fp-nib-cut" data-cut><g data-nib>${skeleton(!live)}</g>` +
        (live ? "" : `<path class="fp-hl" data-hl="slit" data-var="cut" d="${k.pathOf(g.outline.map(st3), true)}"/>` + hl("breather", [hole]).replace('data-hl="breather"', 'data-hl="breather" data-var="cut"') + `<circle class="fp-hl" data-hl="tipping" data-var="cut" cx="${f1(tipAt[0])}" cy="${f1(tipAt[1])}" r="${(Number(tipR) * 1.8).toFixed(2)}"/>` + hl("plate", [platePoly]).replace('data-hl="plate"', 'data-hl="plate" data-var="cut"')) +
        `</g>` + face,
      poly: nibPoly,
      faceScreen,
    };
  }

  return { parts, st: { stPt, stPath, st3 } };
}
