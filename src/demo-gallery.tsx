import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  DecisionAnswer, DecisionQuestion, DecisionRuntime, EmojiPicker, JevProvider,
  SmartAddress, SmartAutocomplete, SmartCategory, SmartColor, SmartColumnMapper,
  SmartDatePicker, SmartDiff, SmartEmptyState, SmartEnum, SmartForm, SmartHighlight, SmartAssignee,
  SmartIcon, SmartInput, SmartMention, SmartNotification, SmartNumber, SmartPriority,
  SmartRoute, SmartSearch, SmartSentiment, SmartSort, SmartStatus, SmartSummary,
  SmartTags, SmartTextarea, SmartTitle, SmartTooltip, SmartUnit, SmartValidation,
  createJevApiRuntime, createModelModeRuntime,
} from './index';
import './demo.css';
import './gallery.css';

const text = 'The production database is down and customers cannot log in.';
const list = ['billing', 'account access', 'data loss', 'other'];
const tags = ['production', 'login', 'database', 'billing', 'mobile', 'urgent'];

function fixtureRuntime(): DecisionRuntime {
  return { async decide(state: string, questions: Record<string, DecisionQuestion>) {
    const answers: Record<string, DecisionAnswer> = {};
    for (const [id, q] of Object.entries(questions)) {
      if (q.type === 'choice') {
        const options = q.options;
        const index = Math.abs((state + q.instructions).split('').reduce((n, c) => n * 31 + c.charCodeAt(0) | 0, 7)) % options.length;
        const probabilities = Object.fromEntries(options.map((option, i) => [option, i === index ? 0.84 : 0.16 / Math.max(1, options.length - 1)]));
        answers[id] = { type: 'choice', choice: options[index], confidence: 0.84, probabilities };
      } else if (q.type === 'noul') {
        const probability = /production|database|login|down/i.test(state) ? 0.91 : 0.68;
        answers[id] = { type: 'noul', answer: probability >= 0.5, probability, confidence: probability };
      } else {
        answers[id] = { type: 'score', score: 3, normalized: 0.8, level: q.options.at(-1) ?? 'high', confidence: 0.78, probabilities: Object.fromEntries(q.options.map((v, i) => [v, i === q.options.length - 1 ? 0.78 : 0.22 / (q.options.length - 1)])) };
      }
    }
    await new Promise(resolve => setTimeout(resolve, 450));
    return answers;
  } };
}

const fixtures = fixtureRuntime();
const generators = {
  async generate(input: string, options: { instruction: string }) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const ask = options.instruction.toLowerCase();
    if (ask.includes('title')) return 'Production database outage';
    if (ask.includes('summar')) return 'The production database outage is preventing customers from logging in.';
    if (ask.includes('tooltip') || ask.includes('plain language')) return 'The database is unavailable, so customers cannot sign in.';
    if (ask.includes('date')) return '2026-10-15T14:00';
    if (ask.includes('unit') || ask.includes('measurement')) return '250 milliliters';
    if (ask.includes('address')) return '{"street":"12 Main St","unit":"","city":"Boston","region":"MA","postal_code":"02110","country":"US"}';
    if (ask.includes('number') || ask.includes('quantity')) return '5000';
    if (ask.includes('json')) return '{"subject":"Database outage","priority":"critical","owner":"Platform"}';
    if (ask.includes('highlight') || ask.includes('quote')) return 'production database is down\ncustomers cannot log in';
    if (ask.includes('notification')) return 'Customers can’t sign in while we restore database access.';
    if (ask.includes('empty-state')) return 'No incidents yet. Create an incident to start tracking service health.';
    if (ask.includes('change')) return 'The service is now unavailable and customer sign-in is affected.';
    if (ask.includes('filter expression')) return 'status = "open" AND priority = "critical"';
    return `The production database is down, so customers can’t sign in. ${input.length > 0 ? 'Our team is investigating.' : ''}`;
  },
};

type Demo = { title: string; group: string; description: string; render: () => React.ReactNode; generate?: boolean; hover?: boolean };
const demos: Record<string, Demo> = {
  SmartAutocomplete: { title: 'Smart autocomplete', group: 'Text inputs', description: 'Suggests a relevant completion from the full input.', render: () => <SmartAutocomplete text="The production database" options={['is down', 'is healthy', 'needs maintenance']} /> },
  EmojiPicker: { title: 'Emoji picker', group: 'Text inputs', description: 'Chooses an emoji for a message’s intent.', render: () => <EmojiPicker text={text} options={['😂','❤️','😢','😡','🤔','🙏','🎉','👍']} /> },
  SmartTextarea: { title: 'Smart textarea', group: 'Text inputs', description: 'Rewrites text when you choose an editing action.', render: () => <SmartTextarea value={text} onChange={() => {}} actions={['shorten', 'make friendlier']} />, generate: true },
  SmartTags: { title: 'Smart tags', group: 'Text inputs', description: 'Selects all matching tags in one decision batch.', render: () => <SmartTags text={text} tags={tags} /> },
  SmartMention: { title: 'Smart mention', group: 'Text inputs', description: 'Resolves a reference against the people or projects you provide.', render: () => <SmartMention text="Please ask Alex to check the database incident." options={['Alex Chen', 'Alex Rivera', 'Platform team']} /> },
  SmartSearch: { title: 'Smart search', group: 'Text inputs', description: 'Turns a plain-language request into a filter expression.', render: () => <SmartSearch query="critical open incidents" onQueryChange={() => {}} filters={['status', 'priority', 'owner']} />, generate: true },
  SmartInput: { title: 'Smart input', group: 'Text inputs', description: 'Classifies a typed value into a known input kind.', render: () => <SmartInput text="alex@example.com" /> },
  SmartIcon: { title: 'Smart icon', group: 'Classification', description: 'Picks an icon name from your supplied icon set.', render: () => <SmartIcon text="Financial analytics dashboard" icons={['chart-no-axes-combined', 'wallet', 'receipt', 'landmark']} /> },
  SmartColor: { title: 'Smart color', group: 'Classification', description: 'Maps intent to a semantic color in your palette.', render: () => <SmartColor text="This is urgent and the service is down" /> },
  SmartCategory: { title: 'Smart category', group: 'Classification', description: 'Assigns a message to one of your categories.', render: () => <SmartCategory text={text} options={['bug', 'feature', 'question', 'incident']} /> },
  SmartPriority: { title: 'Smart priority', group: 'Classification', description: 'Estimates task urgency from a bounded priority scale.', render: () => <SmartPriority text={text} /> },
  SmartStatus: { title: 'Smart status', group: 'Classification', description: 'Maps a description to a workflow status.', render: () => <SmartStatus text="We are investigating the production outage." /> },
  SmartRoute: { title: 'Smart route', group: 'Classification', description: 'Selects the next handler from your allowed routes.', render: () => <SmartRoute text={text} options={['page on-call', 'create bug', 'notify support']} /> },
  SmartSentiment: { title: 'Smart sentiment', group: 'Classification', description: 'Classifies the message’s emotional tone.', render: () => <SmartSentiment text="I have been locked out all morning. This is very frustrating." options={['very negative','negative','neutral','positive','very positive']} /> },
  SmartAssignee: { title: 'Smart assignee', group: 'Classification', description: 'Ranks candidate owners using the task and supplied context.', render: () => <SmartAssignee text="Investigate a database outage" options={['Platform', 'Web', 'Support']} /> },
  SmartEnum: { title: 'Smart enum', group: 'Classification', description: 'Maps free-form language to an allowed value.', render: () => <SmartEnum text="The login page crashes on Safari" options={['bug', 'feature', 'improvement', 'question']} /> },
  SmartDatePicker: { title: 'Smart date picker', group: 'Data entry', description: 'Interprets a natural-language date when requested.', render: () => <SmartDatePicker text="next Thursday afternoon" onSelect={() => {}} />, generate: true },
  SmartAddress: { title: 'Smart address', group: 'Data entry', description: 'Parses a messy address into structured fields.', render: () => <SmartAddress text="12 Main St, Boston MA 02110" onParsed={() => {}} />, generate: true },
  SmartNumber: { title: 'Smart number', group: 'Data entry', description: 'Normalizes shorthand quantities such as “about 5k”.', render: () => <SmartNumber text="about 5k" onValue={() => {}} />, generate: true },
  SmartUnit: { title: 'Smart unit', group: 'Data entry', description: 'Normalizes a measurement and can target known units.', render: () => <SmartUnit text="one cup" units={['milliliters', 'liters']} />, generate: true },
  SmartForm: { title: 'Smart form', group: 'Data entry', description: 'Suggests field values from text for review.', render: () => <SmartForm text="Urgent database incident for Platform" fields={['subject', 'priority', 'owner']} onSuggest={() => {}} />, generate: true },
  SmartValidation: { title: 'Smart validation', group: 'Data entry', description: 'Checks semantic validity against a natural-language rule.', render: () => <SmartValidation text="alex@example.com" rule="Is this a valid work email address?" /> },
  SmartColumnMapper: { title: 'Smart column mapper', group: 'Data entry', description: 'Matches uploaded CSV headers to your expected schema.', render: () => <SmartColumnMapper columns={['e-mail', 'joined on', 'org']} schema={['email', 'created_at', 'company']} onMap={() => {}} /> },
  SmartTitle: { title: 'Smart title', group: 'Display', description: 'Creates a short title for longer content.', render: () => <SmartTitle text={text} />, generate: true },
  SmartSummary: { title: 'Smart summary', group: 'Display', description: 'Compresses longer content while keeping key facts.', render: () => <SmartSummary text={text} />, generate: true },
  SmartHighlight: { title: 'Smart highlight', group: 'Display', description: 'Finds exact phrases worth emphasizing.', render: () => <SmartHighlight text={text} />, generate: true },
  SmartTooltip: { title: 'Smart tooltip', group: 'Display', description: 'Creates a brief explanation when the label is hovered.', render: () => <SmartTooltip text="Production database incident" ><span className="tooltip-demo">What does this alert mean?</span></SmartTooltip>, hover: true },
  SmartEmptyState: { title: 'Smart empty state', group: 'Display', description: 'Writes a helpful empty-state prompt from page context.', render: () => <SmartEmptyState context="An incidents dashboard with no incidents yet" />, generate: true },
  SmartNotification: { title: 'Smart notification', group: 'Display', description: 'Turns a technical event into clear user-facing copy.', render: () => <SmartNotification event="Database connection pool exhausted; login requests returning 503" />, generate: true },
  SmartDiff: { title: 'Smart diff', group: 'Display', description: 'Summarizes the meaningful change between two values.', render: () => <SmartDiff before={{ status: 'healthy', users: 0 }} after={{ status: 'degraded', users: 180 }} />, generate: true },
  SmartSort: { title: 'Smart sort', group: 'Display', description: 'Ranks items by their relevance to the current request.', render: () => <SmartSort items={['Review database logs', 'Update the help center', 'Restart the failing service']} context="Restore customer sign-in" /> },
};

function Gallery() {
  const initial = new URLSearchParams(location.search).get('component') ?? 'EmojiPicker';
  const [selected, setSelected] = useState(demos[initial] ? initial : 'EmojiPicker');
  const [backend, setBackend] = useState<'preview' | 'jev' | 'modelmode'>('preview');
  const [jevConfigured, setJevConfigured] = useState(false);
  const [modelModeCapabilities, setModelModeCapabilities] = useState<string[]>([]);
  useEffect(() => { fetch('/__jev/status').then(r => r.json()).then(data => setJevConfigured(data.configured)).catch(() => {}); }, []);
  useEffect(() => { fetch('/__modelmode/capabilities').then(r => r.json()).then(data => setModelModeCapabilities((data.capabilities ?? []).map((capability: { name: string }) => capability.name))).catch(() => setModelModeCapabilities([])); }, []);
  useEffect(() => { const url = new URL(location.href); url.searchParams.set('component', selected); history.replaceState({}, '', url); }, [selected]);
  const decision = useMemo(() => backend === 'jev' ? createJevApiRuntime() : backend === 'modelmode' ? createModelModeRuntime() : fixtures, [backend]);
  const modelModeCapability = ({ EmojiPicker: 'emoji', SmartPriority: 'priority', SmartCategory: 'category', SmartSentiment: 'sentiment' } as Record<string, string>)[selected];
  const modelModeReady = Boolean(modelModeCapability && modelModeCapabilities.includes(modelModeCapability));
  useEffect(() => { if (backend === 'modelmode' && !modelModeReady) setBackend('preview'); }, [backend, modelModeReady]);
  const demo = demos[selected];
  return <JevProvider decision={decision} generation={generators}>
    <main className="gallery-shell" data-demo-component={selected} data-demo-backend={backend}>
      <header className="gallery-head"><div><span className="eyebrow">JEV REACT UI · COMPONENT TOUR</span><h1>{demo.title}</h1><p className="lede">{demo.description}</p></div><label className="backend-control">Decision backend<select value={backend} onChange={e => setBackend(e.target.value as 'preview' | 'jev' | 'modelmode')}><option value="preview">Preview fixture (no API call)</option><option value="jev" disabled={!jevConfigured}>Jev API {!jevConfigured ? '(set server key first)' : ''}</option><option value="modelmode" disabled={!modelModeReady}>ModelMode local classifier {!modelModeReady ? '(publish this component first)' : ''}</option></select></label></header>
      <nav className="gallery-nav" aria-label="Components">{Object.keys(demos).map(name => <button key={name} type="button" className={selected === name ? 'active' : ''} onClick={() => setSelected(name)}>{name}</button>)}</nav>
      <section className="gallery-stage"><div className="stage-meta"><span>{demo.group}</span><span>{backend === 'jev' ? 'Actual Jev API' : backend === 'modelmode' ? 'ModelMode · local classifier' : 'Preview fixture data'}</span></div><div className="stage-widget">{demo.render()}</div></section>
      <p className="gallery-note">Preview uses sample responses. Jev calls the hosted API through a server-side key. ModelMode runs a trained, published classifier locally; only EmojiPicker, SmartPriority, SmartCategory and SmartSentiment have matching sample classifiers.</p>
    </main>
  </JevProvider>;
}

createRoot(document.getElementById('root')!).render(<Gallery />);
