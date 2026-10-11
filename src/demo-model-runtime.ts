import type { DecisionAnswer, DecisionQuestion, DecisionRuntime } from './runtime';

export type DemoModelStatus = { phase: 'idle' | 'loading' | 'ready' | 'error'; detail?: string; device?: string; model?: string; latencyMs?: number };
type Pending = { resolve: (answers: Record<string, DecisionAnswer>) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

/** Adapter for the demo model workers. */
export function createDemoRuntime(onStatus: (status: DemoModelStatus) => void, workerSource: string | (() => Worker) = '/d1/worker.js') {
  let worker: Worker | undefined;
  let initialized: Promise<void> | undefined;
  let resolveInit: (() => void) | undefined;
  let rejectInit: ((error: Error) => void) | undefined;
  let initTimer: ReturnType<typeof setTimeout> | undefined;
  let id = 0;
  let status: DemoModelStatus = { phase: 'idle' };
  const pending = new Map<number, Pending>();
  const update = (next: DemoModelStatus) => { status = next; onStatus(next); };
  const fail = (error: Error) => {
    clearTimeout(initTimer);
    rejectInit?.(error);
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
    pending.clear();
    worker?.terminate();
    worker = undefined;
    initialized = undefined;
    update({ phase: 'error', detail: error.message });
  };
  const connect = () => initialized ??= new Promise<void>((resolve, reject) => {
    resolveInit = resolve;
    rejectInit = reject;
    update({ phase: 'loading', detail: 'Loading the on-device model…' });
    worker = typeof workerSource === 'string' ? new Worker(workerSource, { type: 'module' }) : workerSource();
    worker.onerror = event => fail(new Error(event.message || 'The model worker failed to start.'));
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') update({ phase: 'loading', detail: data.detail ?? (data.total && data.loaded >= data.total ? 'Preparing the model…' : `Downloading model · ${Math.round(data.loaded / 1024 / 1024)} MB${data.total ? ` / ${Math.round(data.total / 1024 / 1024)} MB` : ''}`) });
      if (data.type === 'ready') { clearTimeout(initTimer); update({ phase: 'ready', device: data.device, model: data.model }); resolveInit?.(); }
      if (data.type === 'error') {
        if (data.id === undefined) return fail(new Error(data.message));
        const item = pending.get(data.id);
        if (item) { clearTimeout(item.timer); pending.delete(data.id); item.reject(new Error(data.message)); }
      }
      if (data.type === 'result') {
        const item = pending.get(data.id);
        if (item) { clearTimeout(item.timer); pending.delete(data.id); update({ ...status, latencyMs: data.ms }); item.resolve(data.answers); }
      }
    };
    initTimer = setTimeout(() => fail(new Error('Model download timed out. Check your connection and retry.')), 600_000);
    worker.postMessage({ type: 'init' });
  });
  const runtime: DecisionRuntime = {
    async decide(state, questions: Record<string, DecisionQuestion>) {
      await connect();
      const requestId = ++id;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Local inference timed out. Try a shorter input.')); }, 120_000);
        pending.set(requestId, { resolve, reject, timer });
        worker!.postMessage({ type: 'decide', id: requestId, state, questions: Object.entries(questions).map(([name, question]) => ({ name, type: question.type, instructions: question.instructions, criteria: question.type === 'choice' ? Object.fromEntries(question.options.map(option => [option, question.descriptions?.[option] ?? option])) : question.type === 'score' ? question.options : undefined })) });
      });
    },
  };
  return { runtime, connect, dispose: () => { clearTimeout(initTimer); worker?.terminate(); for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Demo model session closed.')); } pending.clear(); } };
}
