// A real, tiny decoder-only transformer, small enough to read every weight.
// The architecture is the one modern language models use: token embeddings, a residual stream,
// pre-norm RMSNorm, rotary positions (RoPE), multi-head causal attention, SwiGLU feed-forward
// layers, a final norm and a tied-shape unembedding. The weights are set by hand from rules, not trained,
// so the model only knows one small language. Every number the figure shows comes from `forward`.

export const VOCAB = ["<s>", "the", "cat", "dog", "sat", "ran", "on", "mat", "."];
export const BOS = 0;
export const N_VOCAB = VOCAB.length; // 9, with <s> as an input-only start token
export const N_WORDS = N_VOCAB - 1; // 8 words the model can say
export const N_MAX = 8; // context window, including <s>
export const N_LAYERS = 2;
export const N_HEADS = 2;
export const D_MODEL = 26;
export const D_HEAD = 14;
export const ROPE = [0.78, 2.36]; // two rotation frequencies (radians per position)

// The residual stream is three banks of numbers. A real model mixes these directions together;
// here they are kept apart so the figure can show what each layer writes where.
export const T0 = 0; // who I am: the token, one slot per vocabulary entry
export const A0 = 9; // who came before me: the previous token, written by attention
export const O0 = 18; // what I will say next: one slot per word, read by the unembedding
const E_SCALE = 5; // embedding magnitude
const HEAD_ROPE = 0; // head dims 0-3: rotary pairs
const HEAD_CONTENT = 4; // head dims 4-12: one slot per vocabulary entry
const HEAD_SINK = 13; // head dim 13: a constant, so a head can park on <s>

const K_OUT = 1.4; // how many residual units one logit unit is written as
const L_SCALE = 1.6; // unembedding gain

export const zeros = (rows, cols) => Array.from({ length: rows }, () => new Array(cols).fill(0));
const matvec = (x, W) => {
  const out = new Array(W[0].length).fill(0);
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    if (xi === 0) continue;
    const row = W[i];
    for (let j = 0; j < out.length; j++) out[j] += xi * row[j];
  }
  return out;
};
const silu = (x) => x / (1 + Math.exp(-x));
const rms = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length + 1e-6);

export function softmax(values, temperature = 1) {
  const m = Math.max(...values);
  const e = values.map((v) => Math.exp((v - m) / temperature));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

// ---- weights -------------------------------------------------------------------------------------

const word = (name) => VOCAB.indexOf(name);
const outSlot = (token) => O0 + token - 1; // token 0 (<s>) has no output slot

function ropeQuery(W, scale) {
  // q0 = scale * (cos t, -sin t) per pair, k0 = (1, 0): the score peaks at one position back.
  for (let t = 0; t < N_VOCAB; t++) {
    W[T0 + t][HEAD_ROPE + 0] = scale * Math.cos(ROPE[0]);
    W[T0 + t][HEAD_ROPE + 1] = -scale * Math.sin(ROPE[0]);
    W[T0 + t][HEAD_ROPE + 2] = scale * Math.cos(ROPE[1]);
    W[T0 + t][HEAD_ROPE + 3] = -scale * Math.sin(ROPE[1]);
  }
}
function ropeKey(W) {
  for (let t = 0; t < N_VOCAB; t++) {
    W[T0 + t][HEAD_ROPE + 0] = 1;
    W[T0 + t][HEAD_ROPE + 2] = 1;
  }
}
function valueTokens(W) {
  for (let t = 0; t < N_VOCAB; t++) W[T0 + t][HEAD_CONTENT + t] = 1;
}

const head = () => ({ Wq: zeros(D_MODEL, D_HEAD), Wk: zeros(D_MODEL, D_HEAD), Wv: zeros(D_MODEL, D_HEAD), Wo: zeros(D_HEAD, D_MODEL) });

// Layer 1 attention.
const L0H0 = head(); // previous-token head: looks one position back and copies the token into bank A
ropeQuery(L0H0.Wq, 0.75);
ropeKey(L0H0.Wk);
valueTokens(L0H0.Wv);
for (let t = 0; t < N_VOCAB; t++) L0H0.Wo[HEAD_CONTENT + t][A0 + t] = 1;

const L0H1 = head(); // sink head: parks on <s>. Its output is ignored by every later layer.
for (let t = 0; t < N_VOCAB; t++) L0H1.Wq[T0 + t][HEAD_SINK] = 1;
L0H1.Wk[T0 + BOS][HEAD_SINK] = 1.0;
valueTokens(L0H1.Wv);

// Layer 2 attention.
const L1H0 = head(); // induction head: finds where this word appeared before and copies what came next
for (let t = 0; t < N_VOCAB; t++) {
  L1H0.Wq[T0 + t][HEAD_CONTENT + t] = 2.6;
  L1H0.Wq[T0 + t][HEAD_SINK] = 1;
  L1H0.Wk[A0 + t][HEAD_CONTENT + t] = 1;
}
L1H0.Wk[T0 + BOS][HEAD_SINK] = 1.3;
valueTokens(L1H0.Wv);
for (let t = 1; t < N_VOCAB; t++) L1H0.Wo[HEAD_CONTENT + t][outSlot(t)] = 1.36;

const L1H1 = head(); // no-stutter head: looks one back and pushes that word down, so the model rarely repeats itself
ropeQuery(L1H1.Wq, 1.45);
ropeKey(L1H1.Wk);
valueTokens(L1H1.Wv);
for (let t = 1; t < N_VOCAB; t++) L1H1.Wo[HEAD_CONTENT + t][outSlot(t)] = -0.78;

export const HEAD_ROLES = [
  [
    { name: "previous-token head", note: "Looks one word back and writes that word into bank A, so every lane learns what came before it." },
    { name: "sink head", note: "Parks almost all of its attention on <s>. A common pattern: a head with nothing to do rests on the start token. Here its output is ignored." },
  ],
  [
    { name: "induction head", note: "If this word appeared earlier, attend to the word that followed it then, and copy that word's vote. This is how a model repeats a pattern it has just seen." },
    { name: "no-stutter head", note: "Looks one word back and pushes that same word down, so the model rarely says a word twice in a row." },
  ],
];

// Feed-forward layers: SwiGLU, silu(x Wgate) * (x Wup) Wdown. Each neuron is a memory: its gate
// recognises a pattern in the lane, its down row says which words to vote for or against.
const KAPPA = 2;
function memories(specs, gateScale, normal) {
  const n = specs.length;
  const Wg = zeros(D_MODEL, n), Wu = zeros(D_MODEL, n), Wd = zeros(n, D_MODEL);
  specs.forEach((m, k) => {
    const pair = !!m.after;
    for (let t = 0; t < N_VOCAB; t++) {
      Wg[T0 + t][k] = KAPPA * ((m.when.includes(t) ? 1 : 0) - (pair ? 1.5 : 0.5));
      Wu[T0 + t][k] = 1;
      if (pair) Wg[A0 + t][k] = KAPPA * (m.after.includes(t) ? 1 : 0);
    }
    for (const [token, logit] of Object.entries(m.says)) Wd[k][outSlot(Number(token))] = (logit * K_OUT) / normal;
  });
  return { Wg, Wu, Wd };
}
const w = word;
export const MEMORIES = [
  [
    { label: "start", match: "<s>", when: [w("<s>")], says: { [w("the")]: 3 } },
    { label: "the", match: "the", when: [w("the")], says: { [w("cat")]: 1.2, [w("dog")]: 1.2, [w("mat")]: 1.2 } },
    { label: "animal", match: "cat or dog", when: [w("cat"), w("dog")], says: { [w("sat")]: 1.5, [w("ran")]: 1.5 } },
    { label: "verb", match: "sat or ran", when: [w("sat"), w("ran")], says: { [w("on")]: 2.5, [w(".")]: 1 } },
    { label: "on", match: "on", when: [w("on")], says: { [w("the")]: 3 } },
    { label: "mat", match: "mat", when: [w("mat")], says: { [w(".")]: 3 } },
    { label: "full stop", match: ".", when: [w(".")], says: { [w("the")]: 3 } },
  ],
  [
    { label: "on the", match: "on, the", after: [w("on")], when: [w("the")], says: { [w("mat")]: 3.2, [w("cat")]: -3, [w("dog")]: -3 } },
    { label: ". the", match: ". the", after: [w(".")], when: [w("the")], says: { [w("cat")]: 1.2, [w("dog")]: 1.2, [w("mat")]: -3.5 } },
    { label: "<s> the", match: "<s> the", after: [w("<s>")], when: [w("the")], says: { [w("cat")]: 1.2, [w("dog")]: 1.2, [w("mat")]: -3.5 } },
  ],
];
const MLP0 = memories(MEMORIES[0], 1, 12.4);
const MLP1 = memories(MEMORIES[1], 1, 6.7);

const LAYERS = [
  { heads: [L0H0, L0H1], mlp: MLP0 },
  { heads: [L1H0, L1H1], mlp: MLP1 },
];

export const SPEC = {
  vocab: N_VOCAB,
  layers: N_LAYERS,
  heads: N_HEADS,
  dModel: D_MODEL,
  dHead: D_HEAD,
  context: N_MAX,
  memories: MEMORIES.map((list) => list.length),
  norm: "RMSNorm, before each sublayer",
  position: "RoPE on queries and keys",
  activation: "SwiGLU",
};

// ---- forward pass ---------------------------------------------------------------------------------

function rotate(vec, position) {
  const out = vec.slice();
  for (let p = 0; p < 2; p++) {
    const a = position * ROPE[p];
    const c = Math.cos(a), s = Math.sin(a);
    const x = vec[HEAD_ROPE + 2 * p], y = vec[HEAD_ROPE + 2 * p + 1];
    out[HEAD_ROPE + 2 * p] = x * c - y * s;
    out[HEAD_ROPE + 2 * p + 1] = x * s + y * c;
  }
  return out;
}

export const embed = (token) => {
  const x = new Array(D_MODEL).fill(0);
  x[T0 + token] = E_SCALE;
  return x;
};
export const norm = (x) => {
  const r = rms(x);
  return { y: x.map((v) => v / r), r };
};

function attention(layer, X) {
  const n = X.length;
  const normed = X.map(norm);
  const heads = layer.heads.map((h) => {
    const q = normed.map((u, i) => rotate(matvec(u.y, h.Wq), i));
    const k = normed.map((u, i) => rotate(matvec(u.y, h.Wk), i));
    const v = normed.map((u) => matvec(u.y, h.Wv));
    const scores = [], weights = [], out = [];
    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j <= i; j++) row.push(q[i].reduce((s, qi, d) => s + qi * k[j][d], 0) / Math.sqrt(D_HEAD));
      const wgt = softmax(row);
      scores.push(row);
      weights.push(wgt);
      const mix = new Array(D_HEAD).fill(0);
      wgt.forEach((a, j) => v[j].forEach((val, d) => (mix[d] += a * val)));
      out.push(mix);
    }
    return { q, k, v, scores, weights, out, write: out.map((mix) => matvec(mix, h.Wo)) };
  });
  const delta = X.map((_, i) => {
    const sum = new Array(D_MODEL).fill(0);
    heads.forEach((h) => h.write[i].forEach((val, d) => (sum[d] += val)));
    return sum;
  });
  return { normed: normed.map((u) => u.y), rms: normed.map((u) => u.r), heads, delta };
}

function feedForward(layer, X) {
  const normed = X.map(norm);
  const gate = [], up = [], act = [], delta = [];
  for (const u of normed) {
    const g = matvec(u.y, layer.mlp.Wg);
    const p = matvec(u.y, layer.mlp.Wu);
    const a = g.map((gv, k) => silu(gv) * p[k]);
    gate.push(g);
    up.push(p);
    act.push(a);
    delta.push(matvec(a, layer.mlp.Wd));
  }
  return { normed: normed.map((u) => u.y), rms: normed.map((u) => u.r), gate, up, act, delta };
}

const add = (A, B) => A.map((row, i) => row.map((v, d) => v + B[i][d]));

// tokens: array of vocabulary ids, starting with <s>. Returns every intermediate the figure shows.
export function forward(tokens) {
  const n = tokens.length;
  const x = [tokens.map(embed)]; // x[0] after embedding, x[1] after attention 1, x[2] after MLP 1, x[3] after attention 2, x[4] after MLP 2
  const attn = [], mlp = [];
  for (let l = 0; l < N_LAYERS; l++) {
    const a = attention(LAYERS[l], x[x.length - 1]);
    attn.push(a);
    x.push(add(x[x.length - 1], a.delta));
    const m = feedForward(LAYERS[l], x[x.length - 1]);
    mlp.push(m);
    x.push(add(x[x.length - 1], m.delta));
  }
  const last = x[x.length - 1];
  const final = last.map(norm);
  const logits = final.map((u) => Array.from({ length: N_WORDS }, (_, t) => L_SCALE * u.y[O0 + t]));
  return { tokens, n, x, attn, mlp, final: final.map((u) => u.y), finalRms: final.map((u) => u.r), logits };
}

export const bank = (vec) => ({ T: vec.slice(T0, T0 + N_VOCAB), A: vec.slice(A0, A0 + N_VOCAB), O: vec.slice(O0, O0 + N_WORDS) });

// Inverse-CDF sampling, which is what the marble in the figure does: u in [0, 1) falls into one slot.
export function pick(probs, u) {
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (u < acc) return i;
  }
  return probs.length - 1;
}
// Words are ids 1..8; probs and logits are indexed from 0 for word 1.
export const wordOf = (slot) => slot + 1;
export const slotOf = (token) => token - 1;

export function nextWord(tokens, temperature = 1) {
  const f = forward(tokens);
  const logits = f.logits[f.n - 1];
  return { f, logits, probs: softmax(logits, temperature) };
}

export const PRESETS = [
  { label: "the cat sat . the cat", tokens: "the cat sat . the cat", note: "A repeated word. The induction head finds the earlier cat and copies what followed it." },
  { label: "the dog ran . the dog", tokens: "the dog ran . the dog", note: "The same trick with different words: the second dog is followed by ran." },
  { label: "the cat sat on the", tokens: "the cat sat on the", note: "The word the has appeared before, followed by cat. A phrase memory for on the says mat instead." },
  { label: "the cat sat", tokens: "the cat sat", note: "No repeats to copy, so the memories speak: after sat, on is likelier than a full stop." },
];

export const parse = (text) => [BOS, ...text.trim().split(/\s+/).filter(Boolean).map((t) => word(t))].filter((t) => t >= 0);
