// Checks the claims the figure makes about the toy model. Run: node --test transformer/model.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as M from "./model.mjs";

const next = (text, temperature = 1) => M.nextWord(M.parse(text), temperature);
const best = (probs) => M.VOCAB[M.wordOf(probs.indexOf(Math.max(...probs)))];

test("the model is a causal language model: a lane never depends on later lanes", () => {
  const long = M.forward(M.parse("the cat sat . the cat"));
  for (let k = 1; k <= long.n; k++) {
    const short = M.forward(long.tokens.slice(0, k));
    short.logits[k - 1].forEach((v, i) => assert.ok(Math.abs(v - long.logits[k - 1][i]) < 1e-9));
  }
});

test("attention rows are probability distributions over the lanes up to and including the query", () => {
  const f = M.forward(M.parse("the cat sat on the mat ."));
  for (const layer of f.attn) {
    for (const head of layer.heads) {
      head.weights.forEach((row, i) => {
        assert.equal(row.length, i + 1);
        assert.ok(Math.abs(row.reduce((a, b) => a + b, 0) - 1) < 1e-9);
      });
    }
  }
});

test("layer 1 head 1 looks one word back and head 2 parks on <s>", () => {
  const f = M.forward(M.parse("the cat sat . the cat"));
  const [prev, sink] = f.attn[0].heads;
  for (let i = 1; i < f.n; i++) {
    assert.ok(prev.weights[i][i - 1] > 0.95, `lane ${i} reads lane ${i - 1}`);
    assert.ok(sink.weights[i][0] > 0.95, `lane ${i} parks on <s>`);
  }
});

test("the induction head finds the word that followed the earlier copy", () => {
  const f = M.forward(M.parse("the cat sat . the cat"));
  const row = f.attn[1].heads[0].weights[f.n - 1];
  assert.equal(row.indexOf(Math.max(...row)), 3); // lane 3 is "sat", which followed the first "cat"
  assert.ok(Math.max(...row) > 0.9);
});

test("grammar memories give a sensible bigram model", () => {
  assert.equal(best(next("").probs), "the");
  assert.equal(best(next("the cat sat").probs), "on");
  assert.equal(best(next("the cat sat on").probs), "the");
  assert.equal(best(next("the cat sat on the mat").probs), ".");
  const animal = next("the").probs;
  assert.ok(animal[M.VOCAB.indexOf("cat") - 1] > 0.4 && animal[M.VOCAB.indexOf("dog") - 1] > 0.4);
});

test("copying beats the prior, and the phrase memory beats copying", () => {
  const copy = next("the cat sat . the cat").probs;
  assert.equal(best(copy), "sat");
  assert.ok(copy[M.VOCAB.indexOf("sat") - 1] > 0.85);
  assert.equal(best(next("the dog ran . the dog").probs), "ran");
  const phrase = next("the cat sat on the").probs;
  assert.equal(best(phrase), "mat");
  assert.ok(phrase[M.VOCAB.indexOf("mat") - 1] > 0.85);
});

test("temperature sharpens and flattens the distribution", () => {
  const entropy = (p) => -p.reduce((s, v) => s + (v > 0 ? v * Math.log(v) : 0), 0);
  const cold = next("the cat", 0.4).probs, mid = next("the cat", 1).probs, hot = next("the cat", 2).probs;
  assert.ok(entropy(cold) < entropy(mid) && entropy(mid) < entropy(hot));
});

test("the marble is inverse-CDF sampling: slot width is probability", () => {
  const probs = [0.1, 0.6, 0.3];
  assert.equal(M.pick(probs, 0.05), 0);
  assert.equal(M.pick(probs, 0.1), 1);
  assert.equal(M.pick(probs, 0.69), 1);
  assert.equal(M.pick(probs, 0.7), 2);
  const counts = [0, 0, 0];
  for (let i = 0; i < 30000; i++) counts[M.pick(probs, (i + 0.5) / 30000)]++;
  assert.deepEqual(counts.map((c) => Math.round(c / 300)), [10, 60, 30]);
});

test("the residual stream only ever adds: bank T is never overwritten", () => {
  const f = M.forward(M.parse("the cat sat . the cat"));
  for (let i = 0; i < f.n; i++) {
    const t0 = M.bank(f.x[0][i]).T;
    for (const x of f.x) M.bank(x[i]).T.forEach((v, j) => assert.ok(Math.abs(v - t0[j]) < 1e-9));
  }
});
