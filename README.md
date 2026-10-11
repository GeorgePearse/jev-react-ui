# jev-react-ui

React inputs and controls that use compact models for bounded decisions and short text transformations. Components are unstyled and expose async state through `data-ai-state`, so they can sit inside shadcn/ui or your own design system.

## Quick start

```sh
npm install jev-react-ui
```

Wrap the controls in `JevProvider`. The decision runtime loads on first use and runs locally in the browser: WebGPU when available, WASM otherwise.

```tsx
import { useState } from 'react';
import { JevProvider, EmojiPicker, SmartPriority, SmartCategory } from 'jev-react-ui';

export function Composer() {
  const [message, setMessage] = useState('The production database is down');
  const [emoji, setEmoji] = useState('');
  return <JevProvider model="kev-0.6b">
    <textarea value={message} onChange={e => setMessage(e.target.value)} />
    <EmojiPicker text={message} onSelect={setEmoji} />
    <SmartPriority text={message} onSelect={value => console.log(value)} />
    <SmartCategory text={message} options={['bug','feature','question','incident']} />
    <output>{emoji}</output>
  </JevProvider>;
}
```

The default decision model is `kev-0.6b` from the open-jev ecosystem. It downloads its quantized weights once and keeps them in the browser cache. Set `device` and `dtype` in `JevProvider` to configure inference, or pass your own `DecisionRuntime`/`GenerationRuntime` to connect another local model. Generative controls use a separate lazy Transformers.js pipeline; the default is Liquid AI's `LFM2.5-230M-ONNX` Q4 model and it only loads when you invoke a generation action. The separately tested `d1-omni-600M` browser prototype is not yet wired into this package; pass it through the runtime interface when integrating it.

## Component set

| Area | Components |
| --- | --- |
| Text inputs | `SmartAutocomplete`, `EmojiPicker`, `SmartTextarea`, `SmartTags`, `SmartMention`, `SmartSearch`, `SmartInput` |
| Selection and classification | `SmartIcon`, `SmartColor`, `SmartCategory`, `SmartPriority`, `SmartStatus`, `SmartRoute`, `SmartSentiment`, `SmartAssignee`, `SmartEnum` |
| Data entry | `SmartDatePicker`, `SmartAddress`, `SmartNumber`, `SmartUnit`, `SmartForm`, `SmartValidation`, `SmartColumnMapper` |
| Display | `SmartTitle`, `SmartSummary`, `SmartHighlight`, `SmartTooltip`, `SmartEmptyState`, `SmartNotification`, `SmartDiff`, `SmartSort` |

Choice components take `text`, a bounded `options` list, optional option `descriptions`, and an `onSelect` callback. `SmartTags` and `SmartColumnMapper` batch related questions. Data-entry and display components that create text use the optional generator and return suggestions for the caller to review or apply.

## Local playground

```sh
npm install
npm run dev
```

The playground shows emoji choice, task priority, category, enum selection, multi-label tags, and a text rewrite action. It starts empty, so opening it does not download model files. Typing triggers the decision model; generation weights load only when a rewrite action is invoked. Model files are not included in the package; runtimes download them from Hugging Face on first use.

## Development

```sh
npm run typecheck
npm run build
```

This is an experimental component set. The 31 component names are implemented, but their usefulness depends on the chosen model and task-specific evaluation. The choice components use bounded decisions; address parsing, dates, generated copy, and other less predictable results are suggestions for people to review before applying. Smart controls trigger inference when their inputs change; applications should debounce and limit model downloads appropriately.
