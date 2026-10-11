// Text-only adapter for Liquid AI d1-omni-600M. No generation or task training.
import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/ort.webgpu.bundle.min.mjs';
import { AutoTokenizer } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';
import { QTYPES, answer, nOptions, omniEncode, softmax, temperatureKey } from './prompt.js';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/';
ort.env.logLevel = 'error';
const REPO = 'onnx-community/d1-omni-600M-ONNX';
const REVISION = '4ebc1b97bf1477485371c79d1cf8d5e4e8eebfa0';
const BASE = `https://huggingface.co/${REPO}/resolve/${REVISION}/`;
const CACHE = `d1-text-${REVISION}`;
const post = value => self.postMessage(value);
let device = 'wasm', tokenizer, config, decisionSession;

async function fetchCached(path) {
  const url = BASE + path;
  let cache;
  try {
    cache = await caches.open(CACHE);
    const hit = await cache.match(url);
    if (hit) return new Uint8Array(await hit.arrayBuffer());
  } catch { /* Inference still works when persistent storage is unavailable. */ }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed for ${path}: HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0, last = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (performance.now() - last > 200) {
      last = performance.now();
      post({ type: 'progress', file: path, loaded, total });
    }
  }
  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  try { await cache?.put(url, new Response(buffer, { headers: { 'content-type': 'application/octet-stream' } })); } catch { /* Cache writes are best effort. */ }
  return buffer;
}

async function session(name) {
  const graph = await fetchCached(`onnx/${name}.onnx`);
  const data = await fetchCached(`onnx/${name}.onnx_data`);
  return ort.InferenceSession.create(graph, {
    executionProviders: [device], graphOptimizationLevel: 'all',
    externalData: [{ path: `${name}.onnx_data`, data }],
  });
}

async function init() {
  if (navigator.gpu && await navigator.gpu.requestAdapter()) device = 'webgpu';
  if (device === 'wasm') ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 4) : 1;
  const response = await fetch(BASE + 'config.json');
  if (!response.ok) throw new Error('Could not load the model configuration.');
  config = await response.json();
  tokenizer = await AutoTokenizer.from_pretrained(REPO, { revision: REVISION });
  decisionSession = await session('model_quantized');
  post({ type: 'ready', device, model: 'd1-omni-600M', revision: REVISION });
}

const i64 = (values, dims) => new ort.Tensor('int64', BigInt64Array.from(values, value => BigInt(value)), dims);

async function decideBatch(state, questions) {
  const rows = questions.map(question => omniEncode(tokenizer, state, question, Math.min(config.max_length, 4096)));
  const batch = rows.length, length = Math.max(...rows.map(row => row.ids.length)), markers = Math.max(...rows.map(row => row.markers.length));
  const ids = [], mask = [], positions = [], markerMask = [];
  rows.forEach(row => {
    for (let token = 0; token < length; token++) { ids.push(row.ids[token] ?? config.pad_token_id ?? 0); mask.push(token < row.ids.length ? 1 : 0); }
    for (let marker = 0; marker < markers; marker++) { positions.push(row.markers[marker] ?? 0); markerMask.push(marker < row.markers.length ? 1 : 0); }
  });
  const output = await decisionSession.run({
    input_ids: i64(ids, [batch, length]),
    attention_mask: i64(mask, [batch, length]), prefix_len: i64(new Array(batch).fill(0), [batch]),
    marker_pos: i64(positions, [batch, markers]), marker_mask: i64(markerMask, [batch, markers]),
    qtype: i64(questions.map(question => QTYPES[question.type]), [batch]),
  });
  const logits = output.logits.data, width = output.logits.dims[1];
  return Object.fromEntries(questions.map((question, index) => {
    const temperature = config.temperatures[temperatureKey(question)] ?? config.temperatures[question.type] ?? 1;
    const scores = Array.from(logits.subarray(index * width, index * width + nOptions(question)), value => value / temperature);
    let probabilities = softmax(scores);
    if (question.type === 'noul') probabilities = probabilities.reverse();
    return [question.name, answer(question, probabilities)];
  }));
}

async function handle(data) {
  try {
    if (data.type === 'init') return await init();
    if (data.type === 'decide') {
      const started = performance.now();
      const answers = {};
      // Bound the batch memory; preserve actual zero-shot answers for every question.
      for (let index = 0; index < data.questions.length; index += 4) {
        Object.assign(answers, await decideBatch(data.state, data.questions.slice(index, index + 4)));
      }
      post({ type: 'result', id: data.id, answers, ms: performance.now() - started });
    }
  } catch (error) { post({ type: 'error', id: data.id, message: error.message ?? String(error) }); }
}
let queue = Promise.resolve();
self.onmessage = ({ data }) => { queue = queue.then(() => handle(data)); };
