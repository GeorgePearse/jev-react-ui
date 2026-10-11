import React, { useEffect, useMemo, useState } from 'react';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import { useAIContext } from './runtime';
import { FormatBlock, classifyDocument, MAX_FORMAT_BLOCKS, MAX_FORMAT_LENGTH, splitFormatBlocks } from './formatting';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);

export type SmartFormatProps = {
  text: string;
  debounceMs?: number;
  enabled?: boolean;
  className?: string;
  onFormatted?: (blocks: FormatBlock[]) => void;
};

function FormattedBlock({ block }: { block: FormatBlock }) {
  const { kind, text } = block;
  if (kind === 'title') return <h1 data-format-kind={kind}>{text}</h1>;
  if (kind === 'heading') return <h2 data-format-kind={kind}>{text}</h2>;
  if (kind === 'paragraph') return <p data-format-kind={kind} style={{ whiteSpace: 'pre-wrap' }}>{text}</p>;
  if (kind === 'list') return <ul data-format-kind={kind}>{text.split('\n').map((line, index) => <li key={index}>{line}</li>)}</ul>;
  if (kind === 'code') return <pre data-format-kind={kind}><code>{text}</code></pre>;
  // highlight() escapes source text before adding its own token spans.
  const highlighted = hljs.highlight(text, { language: kind, ignoreIllegals: true }).value;
  return <div className="smart-format-code" data-format-kind={kind}><span className="smart-format-language">{kind === 'javascript' ? 'JavaScript / TypeScript' : kind}</span><pre><code className={`hljs language-${kind}`} dangerouslySetInnerHTML={{ __html: highlighted }} /></pre></div>;
}

/** Zero-shot structural classification; renders the supplied words without generating or rewriting them. */
export function SmartFormat({ text, debounceMs = 500, enabled = true, className, onFormatted }: SmartFormatProps) {
  const blocks = useMemo(() => splitFormatBlocks(text), [text]);
  const tooLarge = text.length > MAX_FORMAT_LENGTH || blocks.length > MAX_FORMAT_BLOCKS;
  const context = useAIContext();
  const [format, setFormat] = useState<{ input: string; status: 'idle' | 'loading' | 'ready' | 'error'; blocks?: FormatBlock[]; error?: string }>({ input: '', status: 'idle' });
  useEffect(() => {
    if (!enabled || !blocks.length || tooLarge) { setFormat({ input: text, status: 'idle' }); return; }
    let stale = false;
    setFormat({ input: text, status: 'loading' });
    const timer = setTimeout(async () => {
      try {
        const runtime = context.decision ?? await context.loadDecision();
        const result = await classifyDocument(runtime, text);
        if (!stale) setFormat({ input: text, status: 'ready', blocks: result });
      } catch (cause) {
        if (!stale) setFormat({ input: text, status: 'error', error: cause instanceof Error ? cause.message : String(cause) });
      }
    }, debounceMs);
    return () => { stale = true; clearTimeout(timer); };
  }, [text, blocks, enabled, tooLarge, debounceMs, context]);
  useEffect(() => { if (format.input === text && format.blocks) onFormatted?.(format.blocks); }, [format, text, onFormatted]);
  const current = format.input === text ? format : { status: enabled && blocks.length ? 'loading' : 'idle', blocks: undefined, error: undefined };
  const error = tooLarge ? `Use up to ${MAX_FORMAT_LENGTH} characters and ${MAX_FORMAT_BLOCKS} blocks.` : current.error;
  const ready = Boolean(current.blocks);
  return <article className={className ?? 'smart-format'} data-smart-ui="format" data-ai-state={error ? 'error' : current.status} aria-busy={current.status === 'loading'}>
    {enabled && current.status === 'loading' && !error ? <div className="format-progress" role="status"><span />Inferring headings, lists, and code…</div> : null}
    {error ? <p role="alert">{error}</p> : null}
    {!ready ? <pre className="smart-format-plain">{text || 'Your formatted document will appear here.'}</pre> : current.blocks!.map((block, index) => <FormattedBlock key={index} block={block} />)}
  </article>;
}
