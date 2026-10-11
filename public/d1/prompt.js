// Ports of the two model repos' prompt.py files: questions in, token ids out, probabilities back.

// Python's json.dumps(x, ensure_ascii=False) with its default ", " / ": " separators.
export function pyDumps(x) {
  if (x === null || x === undefined) return "null";
  if (typeof x === "string") return JSON.stringify(x);
  if (typeof x === "number" || typeof x === "boolean") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(pyDumps).join(", ") + "]";
  return "{" + Object.entries(x).map(([k, v]) => JSON.stringify(k) + ": " + pyDumps(v)).join(", ") + "}";
}

// ------------------------------------------------------------------ d1-omni-600M (prompt.py)

export const QTYPES = { choice: 0, score: 1, noul: 2 };
const DELIM = { state: "<|reserved_7|>", q: "<|reserved_8|>", opt: "<|reserved_9|>", opt_end: "<|reserved_10|>", decide: "<|reserved_11|>" };
const MARKER = "<|mask|>";

export const escapeSpecial = (t) => t.replace(/<\|([A-Za-z0-9_]+)\|>/g, "<¦$1¦>");
const criterion = (v) => (typeof v === "string" ? v : pyDumps(v));
export const nOptions = (q) => (q.type === "noul" ? 2 : q.type === "choice" ? Object.keys(q.criteria).length : q.criteria.length);

function renderOptions(q, nounDefault, audio) {
  if (q.type === "choice") {
    const entries = Object.entries(q.criteria);
    if (audio) return entries.map(([k, v], i) => `option_${String(i).padStart(3, "0")}: ${criterion(v == null || v === "" ? k : v)}`);
    return entries.map(([k, v]) => (v == null || v === "" ? k : `${k}: ${criterion(v)}`));
  }
  if (q.type === "score") return q.criteria.map((c, i) => `level ${i}: ${criterion(c)}`);
  if (audio) return ["false: no", "true: yes"];
  const crit = q.criteria || nounDefault || {};
  const f = crit.false ?? crit.no, t = crit.true ?? crit.yes;
  return ["false: " + (f != null && f !== "" ? criterion(f) : "no, the statement does not hold"),
          "true: " + (t != null && t !== "" ? criterion(t) : "yes, the statement holds")];
}

export function omniEncode(tok, state, q, maxLen, nounDefault = null, audio = false, perOption = 24) {
  const id = (s) => {
    const ids = tok.encode(s, { add_special_tokens: false });
    if (ids.length !== 1) throw new Error(`not a single token: ${s}`);
    return ids[0];
  };
  const enc = (s) => tok.encode(escapeSpecial(s), { add_special_tokens: false });
  const opts = renderOptions(q, nounDefault, audio);
  const budget = Math.max(96, Math.min(opts.length * perOption + 32, Math.floor(maxLen / 2)));
  const per = Math.max(2, Math.floor((budget - 3 * opts.length) / opts.length));
  let question = [id(DELIM.q), ...enc(q.instructions)].slice(0, Math.max(16, budget));
  let markers = [];
  for (const text of opts) {
    markers.push(question.length + 1);
    question = question.concat([id(DELIM.opt), id(MARKER)], enc(" " + text).slice(0, per), [id(DELIM.opt_end)]);
  }
  question.push(id(DELIM.decide));
  const room = Math.max(0, maxLen - question.length - 2);
  const stateIds = [id(DELIM.state), ...enc(typeof state === "string" ? state : pyDumps(state)).slice(0, room)];
  const ids = [tok.bos_token_id ?? 1, ...stateIds, ...question].slice(0, maxLen);
  markers = markers.map((m) => m + 1 + stateIds.length);
  if (markers[markers.length - 1] >= maxLen) throw new Error("the options do not fit in the context");
  return { ids, markers };
}

export function temperatureKey(q) {
  const k = nOptions(q);
  return `${q.type}:` + (k <= 2 ? "2" : k <= 5 ? "3-5" : k <= 10 ? "6-10" : "11+");
}

// ------------------------------------------------------------------ answers (api.py / prompt.py `answer`)

export function softmax(z) {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

export function answer(q, probs) {
  if (q.type === "noul") { const probability = probs[0]; return { type: "noul", answer: probability >= 0.5, probability, confidence: Math.max(probability, 1 - probability) }; }
  let best = 0;
  probs.forEach((p, i) => { if (p > probs[best]) best = i; });
  if (q.type === "choice") {
    const names = Object.keys(q.criteria);
    return { type: "choice", choice: names[best], confidence: probs[best], probabilities: Object.fromEntries(names.map((n, i) => [n, probs[i]])) };
  }
  return {
    type: "score", score: probs.reduce((a, p, i) => a + i * p, 0), normalized: probs.reduce((a, p, i) => a + i * p, 0) / Math.max(1, probs.length - 1), level: criterion(q.criteria[best]), confidence: probs[best],
    probabilities: Object.fromEntries(probs.map((p, i) => [String(i), p])),
    legend: Object.fromEntries(q.criteria.map((c, i) => [String(i), criterion(c)])),
  };
}
