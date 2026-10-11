import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JevProvider, useAIContext, useDecision } from './runtime';
import type { DecisionAnswer } from './runtime';
import { SmartFormat } from './smart-format';
import { createDemoRuntime } from './demo-model-runtime';
import type { DemoModelStatus } from './demo-model-runtime';
import './showcase.css';

const formatSamples = {
  'Developer note': 'Customer Order API\n\nThe admin dashboard fetches the customer’s most recent orders. The helper below sends the request and returns JSON.\n\nImplementation\n\nconst loadOrders = async (customerId) => {\n  const response = await fetch(`/api/orders?customer=${customerId}`);\n  return response.json();\n};\n\nRelease checklist\n\nCheck the loading state\nHandle a failed request\nAdd a small test',

  'Python recipe': 'Find overdue invoices\n\nRun this check each morning to keep the accounts team up to date.\n\nThe script\n\nfrom datetime import date\n\ndef overdue(invoices):\n    return [i for i in invoices if i["due"] < date.today()]\n\nNext steps\n\nReview the overdue accounts\nSend a friendly reminder\nRecord the follow-up date',
};

const emojiChoices = {
  '🎉': 'Celebration, achievement, or exciting good news.',
  '😂': 'A joke, laughter, or finding something hilarious.',
  '❤️': 'Love, affection, or a heartfelt message.',
  '😢': 'Sadness, grief, loss, or sympathy.',
  '😡': 'Anger, outrage, or strong frustration.',
  '🤔': 'Thinking, uncertainty, or weighing a decision.',
  '🙏': 'Thanks, gratitude, or a sincere request for help.',
  '👍': 'Agreement, approval, or confirming a plan.',
};
const emojiNames: Record<string, string> = { '🎉': 'Celebrate', '😂': 'Laugh', '❤️': 'Love', '😢': 'Sad', '😡': 'Frustrated', '🤔': 'Thinking', '🙏': 'Grateful', '👍': 'Agree' };
const emojiSamples = [
  ['Good news', 'We finally shipped it! The launch went brilliantly and the whole team is celebrating.'],
  ['Frustration', 'I was charged twice and nobody has replied for a week. This is completely unacceptable.'],
  ['Gratitude', 'Thank you for staying late to help me. I really appreciate everything you did.'],
  ['A joke', 'My dog joined the video call, barked at my boss, then immediately fell asleep. I cannot stop laughing.'],
];
const inboxSamples = [
  ['Payment problem', 'I was charged twice for my subscription. Please refund the duplicate payment.'],
  ['Login bug', 'The login page crashes on Safari after I enter my password. I cannot get into my account.'],
  ['Account help', 'How do I invite a new teammate and give them access to our project?'],
];
const queueDescriptions = {
  Billing: 'Payments, invoices, charges, refunds, and subscription billing.',
  Engineering: 'Broken functionality, crashes, software bugs, and technical failures.',
  Support: 'Questions about how to use the product, account settings, and general help.',
};
type ChoiceAnswer = Extract<DecisionAnswer, { type: 'choice' }>;
type DemoId = 'format' | 'emoji' | 'inbox';

function Examples({ options, onSelect }: { options: readonly string[]; onSelect: (option: string) => void }) {
  return <div className="examples"><span>Try</span>{options.map(option => <button type="button" key={option} onClick={() => onSelect(option)}>{option}</button>)}</div>;
}

function FormatDemo({ enabled }: { enabled: boolean }) {
  const [text, setText] = useState('');
  return <>
    <div className="demo-intro"><span className="kicker">01 / ZERO-SHOT AUTOFORMAT</span><h1>Just write. Structure follows.</h1><p>Plain text becomes a document. Titles, sections, lists, and code — without typing Markdown.</p></div>
    <Examples options={Object.keys(formatSamples)} onSelect={name => setText(formatSamples[name as keyof typeof formatSamples])} />
    <div className="format-layout">
      <section className="pane source-pane"><header><span>Plain text</span><span className="pane-hint">Your words, untouched</span></header><textarea aria-label="Plain text to format" spellCheck={false} value={text} onChange={event => setText(event.target.value)} placeholder={'Paste a note with a title, some prose, and a code snippet.\n\nSeparate sections with a blank line.\n\nNo # headings. No code fences.'} /></section>
      <section className="pane output-pane"><header><span>Formatted document</span><span className="pane-hint">Structure inferred by the model</span></header><SmartFormat text={text} enabled={enabled} /></section>
    </div>
    <div className="demo-footnote"><span className="footnote-dot" />Zero-shot decisions · no examples in the prompt · original text preserved</div>
  </>;
}

function EmojiDemo({ enabled }: { enabled: boolean }) {
  const [text, setText] = useState('');
  const decision = useDecision<ChoiceAnswer>(text, 'emoji', { type: 'choice', instructions: 'Which single emoji best represents the emotional tone and communicative intent of this message?', options: Object.keys(emojiChoices), descriptions: emojiChoices }, enabled, 450);
  const answer = decision.status === 'ready' && decision.input === text ? decision.result : undefined;
  const phase = answer ? 'ready' : !enabled || !text.trim() ? 'idle' : decision.status === 'error' ? 'error' : 'loading';
  return <>
    <div className="demo-intro"><span className="kicker">02 / LIVE EMOJI REACTION</span><h1>The right reaction. As you type.</h1><p>Go from celebration to frustration to laughter. Watch the reaction follow the meaning.</p></div>
    <Examples options={emojiSamples.map(([label]) => label)} onSelect={label => setText(emojiSamples.find(sample => sample[0] === label)![1])} />
    <div className="reaction-layout">
      <section className="pane message-pane"><header><span>Your message</span><span className="pane-hint">Edit it. Change the mood.</span></header><textarea aria-label="Message for emoji" placeholder="How did your day go?" value={text} onChange={event => setText(event.target.value)} /><div className="composer-footer"><span>{text.length} characters</span><span>Auto-detects after a short pause</span></div></section>
      <section className={`reaction-card ${answer ? 'has-reaction' : ''}`} data-ai-state={phase} data-demo-result="emoji">
        <span className="reaction-eyebrow">Suggested reaction</span>
        <div className="emoji-stage" aria-live="polite" aria-atomic="true"><span className="big-emoji" key={answer?.choice ?? 'waiting'}>{answer?.choice ?? (phase === 'loading' ? '…' : '○')}</span><strong>{answer ? emojiNames[answer.choice] : phase === 'loading' ? 'Reading the room…' : 'Say something'}</strong></div>
        <div className="emoji-choices">{Object.entries(emojiNames).map(([emoji, name]) => <span title={name} key={emoji} className={answer?.choice === emoji ? 'selected' : ''}>{emoji}</span>)}</div>
        {answer ? <span className="reaction-score">{Math.round(answer.confidence * 100)}% class score</span> : null}
        {decision.error ? <p role="alert">{decision.error.message}</p> : null}
      </section>
    </div>
  </>;
}

type InboxItem = { id: number; text: string; queue: string; priority: string };
function InboxDemo({ enabled }: { enabled: boolean }) {
  const ai = useAIContext();
  const [text, setText] = useState('');
  const [items, setItems] = useState<InboxItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || busy || !enabled) return;
    const message = text;
    setBusy(true); setError('');
    try {
      const runtime = ai.decision ?? await ai.loadDecision();
      const answers = await runtime.decide(message, {
        route: { type: 'choice', instructions: 'Which team should handle this incoming customer message?', options: Object.keys(queueDescriptions), descriptions: queueDescriptions },
        priority: { type: 'choice', instructions: 'What response priority does this customer message require?', options: ['Normal', 'Urgent', 'Critical'], descriptions: { Normal: 'General questions or routine requests that can wait for the usual response time.', Urgent: 'The customer is blocked or a serious issue needs prompt attention.', Critical: 'A widespread live outage, active security breach, or immediate risk of losing data.' } },
      });
      if (answers.route?.type !== 'choice' || answers.priority?.type !== 'choice' || !Object.hasOwn(queueDescriptions, answers.route.choice)) throw new Error('The model returned an invalid routing decision.');
      const queue = answers.route.choice, priority = answers.priority.choice;
      setItems(old => [...old, { id: old.length + 1, text: message, queue, priority }]);
      setText(current => current === message ? '' : current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };
  return <>
    <div className="demo-intro"><span className="kicker">03 / INTELLIGENT INBOX</span><h1>A sentence in. The right team out.</h1><p>The model reads each message, chooses its team, and flags urgency. No routing rules to write.</p></div>
    <Examples options={inboxSamples.map(([label]) => label)} onSelect={label => setText(inboxSamples.find(sample => sample[0] === label)![1])} />
    <form className="inbox-composer" onSubmit={submit}><label htmlFor="inbox-message">New message</label><div><textarea id="inbox-message" aria-label="Incoming customer message" rows={2} value={text} onChange={event => setText(event.target.value)} placeholder="Describe a customer issue…" /><button type="submit" disabled={!enabled || !text.trim() || busy}>{busy ? 'Finding the right team…' : 'Route message →'}</button></div>{error ? <p role="alert">{error}</p> : null}</form>
    <div className="routing-status" role="status">{busy ? 'Reading the message…' : items.length ? `Message ${items.length} routed to ${items[items.length - 1].queue}.` : 'Ready for your first message.'}</div>
    <div className="inbox-board" data-ai-state={busy ? 'loading' : 'ready'} data-demo-result="inbox">{Object.keys(queueDescriptions).map((queue, index) => <section className="queue" key={queue} data-queue={queue}><header><span><i className={`queue-dot queue-${index}`} />{queue}</span><span className="queue-count">{items.filter(item => item.queue === queue).length}</span></header><div className="queue-items">{items.filter(item => item.queue === queue).map(item => <article className="inbox-item" key={item.id}><span className="item-id">MESSAGE {String(item.id).padStart(2, '0')}</span><p>{item.text}</p><span className={`priority priority-${item.priority.toLowerCase()}`}>{item.priority}</span></article>)}{!items.some(item => item.queue === queue) ? <p className="queue-empty">Messages arrive here automatically.</p> : null}</div></section>)}</div>
  </>;
}

function Showcase() {
  const query = new URLSearchParams(location.search).get('demo');
  const [selected, setSelected] = useState<DemoId>(query === 'emoji' || query === 'inbox' ? query : 'format');
  const [statuses, setStatuses] = useState<{ format: DemoModelStatus; decisions: DemoModelStatus }>({ format: { phase: 'idle' }, decisions: { phase: 'idle' } });
  const [models] = useState(() => ({ format: createDemoRuntime(status => setStatuses(old => ({ ...old, format: status })), () => new Worker(new URL('./format-model-worker.ts', import.meta.url), { type: 'module' })), decisions: createDemoRuntime(status => setStatuses(old => ({ ...old, decisions: status }))) }));
  useEffect(() => () => { models.format.dispose(); models.decisions.dispose(); }, [models]);
  const model = selected === 'format' ? models.format : models.decisions;
  const status = selected === 'format' ? statuses.format : statuses.decisions;
  const choose = (demo: DemoId) => { setSelected(demo); const url = new URL(location.href); url.searchParams.set('demo', demo); history.replaceState({}, '', url); };
  return <JevProvider decision={model.runtime}>
    <main className="showcase" data-demo={selected} data-model-status={status.phase}>
      <header className="site-header"><a href="/demos.html" className="brand"><span className="brand-mark">i</span>intelligent<span>components</span></a><div className="model-control">{status.phase === 'idle' || status.phase === 'error' ? <button type="button" className="enable-model" onClick={() => void model.connect().catch(() => {})}>{status.phase === 'error' ? 'Retry model' : 'Enable on-device model'}</button> : <span role="status" className={`model-status ${status.phase}`}><i />{status.phase === 'loading' ? status.detail : `${status.model} · ${status.device?.toUpperCase()}`}</span>}{status.phase === 'ready' && status.latencyMs !== undefined ? <span className="latency">{(status.latencyMs / 1000).toFixed(2)}s last inference</span> : null}</div></header>
      {status.phase === 'error' ? <p className="model-error" role="alert">{status.detail}</p> : null}
      <nav className="demo-tabs" aria-label="Demos">{([['format', '01', 'Autoformat'], ['emoji', '02', 'Live emoji'], ['inbox', '03', 'Inbox routing']] as const).map(([id, number, label]) => <button type="button" key={id} aria-current={selected === id ? 'page' : undefined} className={selected === id ? 'active' : ''} onClick={() => choose(id)}><span>{number}</span>{label}</button>)}</nav>
      {selected === 'format' ? <FormatDemo enabled={status.phase === 'ready'} /> : selected === 'emoji' ? <EmojiDemo enabled={status.phase === 'ready'} /> : <InboxDemo enabled={status.phase === 'ready'} />}
      <footer className="site-footer"><span>Three interactions. Real on-device inference.</span><span>Runs in your browser · initial model download required · no API key</span></footer>
    </main>
  </JevProvider>;
}

createRoot(document.getElementById('root')!).render(<Showcase />);
