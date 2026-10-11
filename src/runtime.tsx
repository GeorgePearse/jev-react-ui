import React, { createContext, useContext, useMemo, useState } from 'react';
import { OpenJev, choice, noul, score } from 'open-jev';
import { pipeline } from '@huggingface/transformers';

export type ChoiceQuestion = { type: 'choice'; instructions: string; options: readonly string[]; descriptions?: Record<string, string> };
export type YesNoQuestion = { type: 'noul'; instructions: string };
export type RatingQuestion = { type: 'score'; instructions: string; options: readonly string[] };
export type DecisionQuestion = ChoiceQuestion | YesNoQuestion | RatingQuestion;
export type DecisionAnswer = { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: 'noul'; answer: boolean; probability: number; confidence: number }
  | { type: 'score'; score: number; normalized: number; level: string; confidence: number; probabilities: Record<string, number> };

export interface DecisionRuntime {
  decide(state: string, questions: Record<string, DecisionQuestion>): Promise<Record<string, DecisionAnswer>>;
}

export interface GenerateOptions { instruction: string; maxNewTokens?: number }
export interface GenerationRuntime { generate(text: string, options: GenerateOptions): Promise<string> }

type AIDependencyContext = {
  decision?: DecisionRuntime;
  generation?: GenerationRuntime;
  model: string;
  generatorModel?: string;
  loadDecision(): Promise<DecisionRuntime>;
  loadGenerator(): Promise<GenerationRuntime>;
};

const AIContext = createContext<AIDependencyContext | null>(null);

export type JevProviderProps = {
  children: React.ReactNode;
  /** Defaults to the browser-ready 0.6B KEV decision model. */
  model?: string;
  /** Defaults to Liquid AI's 230M Q4 ONNX text model; it loads only when a text-generation component is used. */
  generatorModel?: string;
  device?: 'auto' | 'webgpu' | 'wasm';
  dtype?: 'auto' | 'q4' | 'q4f16' | 'fp16';
  decision?: DecisionRuntime;
  generation?: GenerationRuntime;
  onProgress?: (progress: { progress: number; loaded: number; total: number }) => void;
};

export function createJevRuntime(model = 'kev-0.6b', options: Pick<JevProviderProps, 'device' | 'dtype' | 'onProgress'> = {}): DecisionRuntime {
  let clientPromise: ReturnType<typeof OpenJev.load> | undefined;
  const client = () => clientPromise ??= OpenJev.load({
    model,
    device: options.device ?? 'auto',
    dtype: options.dtype ?? 'auto',
    onProgress: options.onProgress,
  });
  return {
    async decide(state, questions) {
      const clientInstance = await client();
      const mapped = Object.fromEntries(Object.entries(questions).map(([key, q]) => {
        if (q.type === 'choice') return [key, choice(q.instructions, q.options, q.descriptions)];
        if (q.type === 'noul') return [key, noul(q.instructions)];
        return [key, score(q.instructions, q.options)];
      }));
      return clientInstance.decide(state, mapped) as Promise<Record<string, DecisionAnswer>>;
    },
  };
}

function createTextGenerator(model: string): GenerationRuntime {
  let pipelinePromise: ReturnType<typeof pipeline> | undefined;
  return {
    async generate(text, options) {
      const device = typeof navigator !== 'undefined' && (navigator as Navigator & { gpu?: unknown }).gpu ? 'webgpu' : 'wasm';
      pipelinePromise ??= pipeline('text-generation', model, { device: device as any, dtype: 'q4' });
      const generator = await pipelinePromise;
      const prompt = `${options.instruction}\n\n${text}\n\nAnswer directly and briefly.`;
      const generated = await (generator as any)(prompt, { max_new_tokens: options.maxNewTokens ?? 96, do_sample: false });
      return String(generated?.[0]?.generated_text ?? '').slice(prompt.length).trim();
    },
  };
}

export function JevProvider({
  children,
  model = 'kev-0.6b',
  generatorModel = 'LiquidAI/LFM2.5-230M-ONNX',
  device = 'auto',
  dtype = 'auto',
  decision,
  generation,
  onProgress,
}: JevProviderProps) {
  const value = useMemo<AIDependencyContext>(() => {
    let decisionPromise: Promise<DecisionRuntime> | undefined;
    let generationPromise: Promise<GenerationRuntime> | undefined;
    return {
    decision,
    generation,
    model,
    generatorModel,
    async loadDecision() {
      if (decision) return decision;
      return decisionPromise ??= Promise.resolve(createJevRuntime(model, { device, dtype, onProgress }));
    },
    async loadGenerator() {
      if (generation) return generation;
      return generationPromise ??= Promise.resolve(createTextGenerator(generatorModel));
    },
  }; }, [decision, generation, model, generatorModel, device, dtype, onProgress]);
  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAIContext() {
  const context = useContext(AIContext);
  if (!context) throw new Error('Wrap AI components in <JevProvider>.');
  return context;
}

export type AsyncState<T> = { status: 'idle' | 'loading' | 'ready' | 'error'; result?: T; error?: Error };

export function useDecision<T extends DecisionAnswer = DecisionAnswer>(
  state: string,
  name: string,
  question: DecisionQuestion,
  enabled = true,
  debounceMs = 250,
) {
  const context = useAIContext();
  const [asyncState, setAsyncState] = useState<AsyncState<T>>({ status: 'idle' });
  const questionKey = JSON.stringify(question);
  React.useEffect(() => {
    if (!enabled || !state.trim()) { setAsyncState({ status: 'idle' }); return; }
    let stale = false;
    setAsyncState((old) => ({ ...old, status: 'loading', error: undefined }));
    const timer = setTimeout(async () => {
      try {
        const runtime = context.decision ?? await context.loadDecision();
        const answers = await runtime.decide(state, { [name]: JSON.parse(questionKey) as DecisionQuestion });
        if (!stale) setAsyncState({ status: 'ready', result: answers[name] as T });
      } catch (e) {
        if (!stale) setAsyncState({ status: 'error', error: e instanceof Error ? e : new Error(String(e)) });
      }
    }, debounceMs);
    return () => { stale = true; clearTimeout(timer); };
  }, [state, name, questionKey, enabled, debounceMs, context]);
  return asyncState;
}

export function useDecisionBatch(state: string, questions: Record<string, DecisionQuestion>, enabled = true, debounceMs = 250) {
  const context = useAIContext();
  const [asyncState, setAsyncState] = useState<AsyncState<Record<string, DecisionAnswer>>>({ status: 'idle' });
  const questionKey = JSON.stringify(questions);
  React.useEffect(() => {
    if (!enabled || !state.trim() || !Object.keys(questions).length) { setAsyncState({ status: 'idle' }); return; }
    let stale = false;
    setAsyncState((old) => ({ ...old, status: 'loading', error: undefined }));
    const timer = setTimeout(async () => {
      try {
        const runtime = context.decision ?? await context.loadDecision();
        const answers = await runtime.decide(state, JSON.parse(questionKey) as Record<string, DecisionQuestion>);
        if (!stale) setAsyncState({ status: 'ready', result: answers });
      } catch (e) {
        if (!stale) setAsyncState({ status: 'error', error: e instanceof Error ? e : new Error(String(e)) });
      }
    }, debounceMs);
    return () => { stale = true; clearTimeout(timer); };
  }, [state, questionKey, enabled, debounceMs, context]);
  return asyncState;
}

export function useGenerate() {
  const context = useAIContext();
  const [asyncState, setAsyncState] = useState<AsyncState<string>>({ status: 'idle' });
  const run = async (text: string, instruction: string, maxNewTokens?: number) => {
    setAsyncState({ status: 'loading' });
    try {
      const runtime = context.generation ?? await context.loadGenerator();
      const result = await runtime.generate(text, { instruction, maxNewTokens });
      setAsyncState({ status: 'ready', result });
      return result;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      setAsyncState({ status: 'error', error });
      throw error;
    }
  };
  return { ...asyncState, run };
}
