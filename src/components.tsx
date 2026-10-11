import React, { useEffect, useMemo, useState } from 'react';
import { DecisionAnswer, DecisionQuestion, useAIContext, useDecision, useDecisionBatch, useGenerate } from './runtime';

export type SmartOption = string | { value: string; label?: string; description?: string };
export type SmartChoiceProps = {
  text?: string;
  value?: string;
  children?: React.ReactNode;
  options: readonly SmartOption[];
  descriptions?: Record<string, string>;
  question?: string;
  label?: string;
  onSelect?: (value: string, answer?: Extract<DecisionAnswer, {type:'choice'}>) => void;
  onTextChange?: (text: string) => void;
  debounceMs?: number;
  className?: string;
  disabled?: boolean;
};

const optionValue = (option: SmartOption) => typeof option === 'string' ? option : option.value;
const optionLabel = (option: SmartOption) => typeof option === 'string' ? option : option.label ?? option.value;
const optionDescriptions = (options: readonly SmartOption[], descriptions?: Record<string, string>) => Object.fromEntries(options.map((option) => {
  const value = optionValue(option);
  return [value, descriptions?.[value] ?? (typeof option === 'string' ? option : option.description ?? option.label ?? value)];
}));
const stateText = (text?: string, value?: string, children?: React.ReactNode) => text ?? value ?? (typeof children === 'string' ? children : '');

function ChoiceWidget({ text, value, children, options, descriptions, question, label, onSelect, debounceMs, className, disabled }: SmartChoiceProps & { name: string }) {
  const state = stateText(text, value, children);
  const normalized = options.map(optionValue);
  const descriptionMap = optionDescriptions(options, descriptions);
  const decision = useDecision<Extract<DecisionAnswer, {type:'choice'}>>(state, 'value', {
    type: 'choice', instructions: question ?? label ?? 'Which option best matches the input?', options: normalized, descriptions: descriptionMap,
  }, !!state && options.length > 1, debounceMs);
  const selected = value && normalized.includes(value) ? value : decision.result?.choice ?? '';
  useEffect(() => { if (decision.result && !value) onSelect?.(decision.result.choice, decision.result); }, [decision.result?.choice]);
  return <div className={className ?? 'smart-choice'} data-smart-ui="choice" data-ai-state={decision.status}>
    {label && <label className="smart-label">{label}</label>}
    <select aria-label={label ?? question ?? 'Suggested choice'} disabled={disabled || !state} value={selected} onChange={(event) => onSelect?.(event.target.value, decision.result)}>
      <option value="" disabled>{state ? decision.status === 'loading' ? 'Choosing…' : 'Choose…' : 'Enter text to classify'}</option>
      {options.map((option) => { const v = optionValue(option); return <option key={v} value={v}>{optionLabel(option)}</option>; })}
    </select>
    {decision.status === 'error' && <span role="alert" className="smart-error">{decision.error?.message}</span>}
    {decision.result && <small className="smart-confidence">{Math.round(decision.result.confidence * 100)}% model confidence</small>}
  </div>;
}

const simpleChoice = (name: string, defaultQuestion: string, defaults?: string[]) => function SmartChoiceComponent(props: Omit<SmartChoiceProps, 'options'> & { options?: readonly SmartOption[] }) {
  return <ChoiceWidget name={name} options={props.options ?? defaults ?? []} question={props.question ?? defaultQuestion} {...props} />;
};

export const SmartEnum = simpleChoice('enum', 'Which allowed value best matches this text?');
export const SmartCategory = simpleChoice('category', 'Which category best fits this text?');
export const SmartPriority = simpleChoice('priority', 'How urgent and important is this?', ['low','medium','high','critical']);
export const SmartStatus = simpleChoice('status', 'Which status best describes this item?', ['backlog','in progress','blocked','done']);
export const SmartRoute = simpleChoice('route', 'Which action or handler should receive this input?');
export const SmartSentiment = simpleChoice('sentiment', 'What is the emotional tone of this text?', ['very negative','negative','neutral','positive','very positive']);
export const SmartAssignee = simpleChoice('assignee', 'Who is the best person or team for this item?');
export const SmartMention = simpleChoice('mention', 'Which person, project, or document is being referred to?');
export const SmartInput = simpleChoice('input', 'What kind of value is this?', ['email','url','phone','date','number','other']);

const defaultPalette: Record<string,string> = { slate:'#64748b', blue:'#3b82f6', green:'#22c55e', amber:'#f59e0b', red:'#ef4444', violet:'#8b5cf6' };
export function SmartColor(props: Omit<SmartChoiceProps,'options'> & { options?: readonly SmartOption[]; palette?:Record<string,string> }) {
  const palette = props.palette ?? defaultPalette;
  const options = props.options ?? Object.keys(palette);
  const [selected,setSelected] = useState(props.value ?? '');
  return <div className="smart-color" data-smart-ui="color"><ChoiceWidget name="color" {...props} options={options} question={props.question ?? 'Which color best represents the intent or mood?'} onSelect={(value,answer)=>{setSelected(value);props.onSelect?.(value,answer);}} /><span aria-hidden="true" className="smart-swatch" style={{ display:'inline-block', width:20, height:20, borderRadius:'50%', background:palette[selected] ?? 'transparent' }} /></div>;
}
export function SmartIcon(props: Omit<SmartChoiceProps,'options'> & { options?:readonly SmartOption[]; icons?:readonly string[]; iconMap?:Record<string,React.ReactNode> }) {
  const options = props.options ?? props.icons ?? Object.keys(props.iconMap ?? {});
  const [selected,setSelected] = useState(props.value ?? '');
  return <div className="smart-icon" data-smart-ui="icon"><ChoiceWidget name="icon" {...props} options={options} question={props.question ?? 'Which icon best represents this description?'} onSelect={(value,answer)=>{setSelected(value);props.onSelect?.(value,answer);}} />{props.iconMap?.[selected] && <span aria-hidden="true">{props.iconMap[selected]}</span>}</div>;
}

export function EmojiPicker({ text = '', options, onSelect, ...props }: Omit<SmartChoiceProps, 'options'> & { options?: readonly SmartOption[] }) {
  const emojiOptions = options ?? [
    {value:'😂',description:'laughing or finding something hilarious'}, {value:'❤️',description:'love or affection'},
    {value:'😊',description:'happiness or friendliness'}, {value:'😢',description:'sadness or sympathy'},
    {value:'😡',description:'anger or frustration'}, {value:'😱',description:'shock or amazement'},
    {value:'🤔',description:'thinking or uncertainty'}, {value:'🙏',description:'thanks or please'},
    {value:'👏',description:'praise or congratulations'}, {value:'👍',description:'agreement or approval'},
    {value:'🎉',description:'celebration or good news'}, {value:'🔥',description:'something exciting or excellent'},
    {value:'💡',description:'an idea or insight'}, {value:'✅',description:'complete or confirmed'},
  ];
  return <ChoiceWidget name="emoji" text={text} options={emojiOptions} question="Which single emoji best captures the message's intent and tone?" onSelect={onSelect} {...props} />;
}

export function SmartAutocomplete({ text = '', onTextChange, options, ...props }: SmartChoiceProps) {
  const [query,setQuery]=useState(text);
  useEffect(()=>setQuery(text),[text]);
  return <div className="smart-autocomplete" data-smart-ui="autocomplete"><input aria-label="Autocomplete" value={query} onChange={(e) => {setQuery(e.target.value);onTextChange?.(e.target.value);}} /><ChoiceWidget name="autocomplete" text={query} options={options} question={props.question ?? 'Which suggestion best fits the full input?'} {...props} /></div>;
}

export function SmartColorSwatch(props: Omit<SmartChoiceProps, 'options'> & { options?: readonly SmartOption[]; palette?: Record<string, string> }) {
  const palette = props.palette ?? { slate:'#64748b', blue:'#3b82f6', green:'#22c55e', amber:'#f59e0b', red:'#ef4444', violet:'#8b5cf6' };
  const [selected, setSelected] = useState(props.value ?? '');
  const onSelect = (value: string) => { setSelected(value); props.onSelect?.(value); };
  return <div className="smart-color" data-smart-ui="color">
    <SmartColor {...props} options={props.options ?? Object.keys(palette)} onSelect={onSelect} />
    <span aria-hidden="true" className="smart-swatch" style={{ display:'inline-block', width:20, height:20, borderRadius:'50%', background: palette[selected] ?? palette[Object.keys(palette)[0]] }} />
  </div>;
}

export function SmartTags({ text = '', tags, onChange, threshold = 0.35, className }: { text: string; tags: readonly string[]; onChange?: (tags: string[]) => void; threshold?: number; className?: string }) {
  const questions = useMemo(() => Object.fromEntries(tags.map((tag, i) => [`tag${i}`, { type: 'noul', instructions: `Does this text match the tag “${tag}”?` } satisfies DecisionQuestion])), [tags]);
  const result = useDecisionBatch(text, questions, !!text && tags.length > 0);
  const selected = useMemo(() => tags.filter((_, i) => {
    const answer = result.result?.[`tag${i}`]; return answer?.type === 'noul' && answer.probability >= threshold;
  }), [tags, result.result, threshold]);
  useEffect(() => { if (result.status === 'ready') onChange?.(selected); }, [result.status, selected.join('\0')]);
  return <div className={className ?? 'smart-tags'} data-smart-ui="tags" data-ai-state={result.status}>
    {tags.map((tag, i) => { const answer = result.result?.[`tag${i}`]; const active = answer?.type === 'noul' && answer.probability >= threshold; return <button type="button" key={tag} aria-pressed={!!active} onClick={() => onChange?.(active ? selected.filter((x) => x !== tag) : [...selected, tag])}>{tag}</button>; })}
    {result.status === 'error' && <span role="alert">{result.error?.message}</span>}
  </div>;
}

export function SmartTextarea({ value, onChange, actions = ['polish','shorten','fix grammar'], rows = 4, className }: { value: string; onChange: (value: string) => void; actions?: string[]; rows?: number; className?: string }) {
  const [output, setOutput] = useState(''); const generated = useGenerate();
  const run = async (instruction: string) => { const result = await generated.run(value, `Rewrite this text to ${instruction}. Keep the meaning. Return only the revised text.`, 160); setOutput(result); };
  return <div className={className ?? 'smart-textarea'} data-smart-ui="textarea"><textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    <div className="smart-actions">{actions.map((action) => <button type="button" key={action} disabled={!value || generated.status === 'loading'} onClick={() => void run(action)}>{generated.status === 'loading' ? 'Working…' : action}</button>)}</div>
    {output && <div className="smart-result" aria-live="polite">{output}<button type="button" onClick={() => onChange(output)}>Apply</button></div>}{generated.error && <p role="alert">{generated.error.message}</p>}</div>;
}

export function SmartSearch({ query, onQueryChange, filters, onFilter, className }: { query: string; onQueryChange: (value: string) => void; filters: readonly string[]; onFilter?: (value: string) => void; className?: string }) {
  const [translated, setTranslated] = useState(''); const generated = useGenerate();
  return <div className={className ?? 'smart-search'} data-smart-ui="search"><input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Search in natural language" />
    <button type="button" disabled={!query || generated.status === 'loading'} onClick={async () => { const value = await generated.run(`${query}\nAvailable filters: ${filters.join(', ')}`, 'Translate this request into a concise filter expression using only the available field names. Return only the expression.', 80); setTranslated(value); }}>Translate query</button>
    {translated && <div className="smart-result">{translated}<SmartEnum text={`${query}\n${translated}`} options={filters} label="Closest filter" onSelect={onFilter} /></div>}</div>;
}

export function SmartDatePicker({ text, onTextChange, onSelect, className }: { text: string; onTextChange?: (text:string)=>void; onSelect: (isoDate: string) => void; className?: string }) {
  const generated = useGenerate();
  return <div className={className ?? 'smart-date'} data-smart-ui="date"><input aria-label="Date in natural language" value={text} onChange={e=>onTextChange?.(e.target.value)} readOnly={!onTextChange} /><button type="button" disabled={!text || generated.status === 'loading'} onClick={async () => { const result = await generated.run(text, 'Convert the requested date and time to ISO 8601. Use today as the current date. Return only an ISO date or datetime.', 40); const iso = result.match(/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?/); if (iso) onSelect(iso[0]); }}>Interpret date</button><output>{generated.result}</output></div>;
}

export function SmartUnit({ text, units, onResult, className }: { text:string; units?:readonly string[]; onResult?:(normalized:string)=>void; className?:string }) {
  const generated=useGenerate();
  return <div className={className ?? 'smart-unit'} data-smart-ui="unit"><button type="button" disabled={!text||generated.status==='loading'} onClick={async()=>{const target=units?.length?` Convert to one of these units when possible: ${units.join(', ')}.`:'';const value=await generated.run(text,`Normalize this measurement. Return the numeric value, a space, and the unit.${target}`,40);onResult?.(value);}}>Normalize unit</button><output>{generated.result}</output>{generated.error&&<span role="alert">{generated.error.message}</span>}</div>;
}

export function SmartAddress({ text, onParsed, className }: { text: string; onParsed: (address: Record<string, string>) => void; className?: string }) {
  const generated = useGenerate();
  const parse = async () => { const raw = await generated.run(text, 'Parse this address into JSON with keys street, unit, city, region, postal_code, country. Use empty strings for missing parts. Return valid JSON only.', 120); try { onParsed(JSON.parse(raw)); } catch { /* keep raw result visible for correction */ } };
  return <div className={className ?? 'smart-address'} data-smart-ui="address"><button type="button" disabled={!text || generated.status === 'loading'} onClick={() => void parse()}>Parse address</button><output>{generated.result}</output>{generated.error && <span role="alert">{generated.error.message}</span>}</div>;
}

export function SmartNumber({ text, onValue, className }: { text: string; onValue: (number: number) => void; className?: string }) {
  const generated = useGenerate();
  return <div className={className ?? 'smart-number'} data-smart-ui="number"><button type="button" disabled={!text || generated.status === 'loading'} onClick={async () => { const raw = await generated.run(text, 'Normalize the quantity to a single numeric value. Interpret k as thousand and million as 1000000. Return only the number.', 24); const n = Number(raw.replace(/[^\d.eE+-]/g,'')); if (Number.isFinite(n)) onValue(n); }}>Normalize number</button><output>{generated.result}</output></div>;
}

export function SmartForm({ text, fields, onSuggest, className }: { text: string; fields: readonly string[]; onSuggest: (values: Record<string, unknown>) => void; className?: string }) {
  const generated = useGenerate();
  return <div className={className ?? 'smart-form'} data-smart-ui="form"><button type="button" disabled={!text || generated.status === 'loading'} onClick={async () => { const raw = await generated.run(`${text}\nFields: ${fields.join(', ')}`, 'Suggest values for the listed fields from the provided text. Return a JSON object with exactly those field names; use null when unknown.', 220); try { onSuggest(JSON.parse(raw)); } catch { /* output remains reviewable */ } }}>Suggest fields</button><pre>{generated.result}</pre></div>;
}

export function SmartValidation({ text, rule, onValid, className }: { text: string; rule: string; onValid?: (valid: boolean, confidence: number) => void; className?: string }) {
  const result = useDecision<Extract<DecisionAnswer,{type:'noul'}>>(text, 'valid', { type: 'noul', instructions: rule }, !!text);
  useEffect(() => { if (result.result?.type === 'noul') onValid?.(result.result.answer, result.result.confidence); }, [result.result?.answer, result.result?.confidence]);
  return <span className={className ?? 'smart-validation'} data-smart-ui="validation" data-valid={result.result?.type === 'noul' ? result.result.answer : undefined} aria-live="polite">{result.status === 'loading' ? 'Checking…' : result.result?.type === 'noul' ? result.result.answer ? 'Looks valid' : 'Check this value' : result.error?.message}</span>;
}

export function SmartColumnMapper({ columns, schema, onMap, className }: { columns: readonly string[]; schema: readonly string[]; onMap: (mapping: Record<string,string>) => void; className?: string }) {
  const context = useAIContext(); const [mapping,setMapping] = useState<Record<string,string>>({}); const [status,setStatus] = useState('idle');
  const infer = async () => { setStatus('loading'); try { const runtime = context.decision ?? await context.loadDecision(); const questions = Object.fromEntries(columns.map((column,i) => [`col${i}`, { type:'choice', instructions:`Which target field best matches source column “${column}”?`, options:[...schema,'ignore'] } satisfies DecisionQuestion])); const answers=await runtime.decide(`Map these CSV columns to the expected schema. Expected fields: ${schema.join(', ')}.`,questions); const next=Object.fromEntries(columns.map((c,i)=>{ const answer=answers[`col${i}`]; return [c,answer?.type==='choice'?answer.choice:'ignore']; })); setMapping(next); onMap(next); setStatus('ready'); } catch { setStatus('error'); } };
  return <div className={className ?? 'smart-column-mapper'} data-smart-ui="column-mapper"><button type="button" disabled={!columns.length || status==='loading'} onClick={() => void infer()}>{status==='loading'?'Mapping…':'Map columns'}</button>{Object.entries(mapping).map(([from,to])=><div key={from}>{from} → {to}</div>)}</div>;
}

export function SmartTitle({ text, onResult, className }: { text: string; onResult?: (title:string)=>void; className?: string }) {
  const g=useGenerate(); return <GeneratedButton name="title" text={text} instruction="Write a clear title in 3 to 8 words. Return only the title." generated={g} onResult={onResult} className={className} />;
}
export function SmartSummary({ text, maxWords=40, onResult, className }: { text:string; maxWords?:number; onResult?:(summary:string)=>void; className?:string }) {
  const g=useGenerate(); return <GeneratedButton name="summary" text={text} instruction={`Summarize the text in at most ${maxWords} words. Preserve the key facts.`} generated={g} onResult={onResult} className={className} />;
}
export function SmartTooltip({ text, children, className }: { text:string; children:React.ReactNode; className?:string }) {
  const g=useGenerate(); return <span className={className ?? 'smart-tooltip'} data-smart-ui="tooltip" title={g.result} onMouseEnter={() => { if (g.status==='idle') void g.run(text,'Explain this briefly in plain language.',60); }}>{children}</span>;
}
export function SmartEmptyState({ context, onResult, className }: { context:string; onResult?:(message:string)=>void; className?:string }) {
  const g=useGenerate(); return <GeneratedButton name="empty-state" text={context} instruction="Write a helpful empty-state message with one concise next step." generated={g} onResult={onResult} className={className} />;
}
export function SmartNotification({ event, onResult, className }: { event:string; onResult?:(message:string)=>void; className?:string }) {
  const g=useGenerate(); return <GeneratedButton name="notification" text={event} instruction="Rewrite this technical event as a short, clear notification for an end user. Do not invent details." generated={g} onResult={onResult} className={className} />;
}
export function SmartDiff({ before, after, onResult, className }: { before:unknown; after:unknown; onResult?:(summary:string)=>void; className?:string }) {
  const g=useGenerate(); return <GeneratedButton name="diff" text={`Before: ${JSON.stringify(before)}\nAfter: ${JSON.stringify(after)}`} instruction="Summarize only the meaningful changes between these two values." generated={g} onResult={onResult} className={className} />;
}
export function SmartHighlight({ text, onResult, className }: { text:string; onResult?:(highlights:string[])=>void; className?:string }) {
  const g=useGenerate();
  const phrases=(g.result??'').split('\n').map(x=>x.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
  const parts:{text:string;mark:boolean}[]=[]; let rest=text;
  while(rest){ const matches=phrases.map(p=>({p,index:rest.toLocaleLowerCase().indexOf(p.toLocaleLowerCase())})).filter(x=>x.index>=0).sort((a,b)=>a.index-b.index); if(!matches.length){parts.push({text:rest,mark:false});break;} const {p,index}=matches[0]; if(index)parts.push({text:rest.slice(0,index),mark:false});parts.push({text:rest.slice(index,index+p.length),mark:true});rest=rest.slice(index+p.length); }
  return <div className={className ?? 'smart-highlight'} data-smart-ui="highlight"><button type="button" disabled={!text||g.status==='loading'} onClick={async()=>{const raw=await g.run(text,'Quote up to three short, exact phrases from the text that carry the most important information. Return one phrase per line.',96);onResult?.(raw.split('\n').map(x=>x.replace(/^[-*•]\s*/,'').trim()).filter(Boolean));}}>{g.status==='loading'?'Finding highlights…':'Find highlights'}</button>{g.result&&<p>{parts.map((part,i)=>part.mark?<mark key={i}>{part.text}</mark>:<React.Fragment key={i}>{part.text}</React.Fragment>)}</p>}{g.error&&<span role="alert">{g.error.message}</span>}</div>;
}

function GeneratedButton({ name, text, instruction, generated, onResult, className }: { name:string; text:string; instruction:string; generated:ReturnType<typeof useGenerate>; onResult?:(value:string)=>void; className?:string }) {
  return <div className={className ?? `smart-${name}`} data-smart-ui={name}><button type="button" disabled={!text || generated.status==='loading'} onClick={async()=>{const value=await generated.run(text,instruction); onResult?.(value);}}>{generated.status==='loading'?'Working…':`Generate ${name}`}</button>{generated.result && <output aria-live="polite">{generated.result}</output>}{generated.error && <span role="alert">{generated.error.message}</span>}</div>;
}

export function SmartSort({ items, context, onSorted, className }: { items:readonly string[]; context:string; onSorted?:(items:string[])=>void; className?:string }) {
  const ai=useAIContext(); const [sorted,setSorted]=useState<string[]>([]); const [status,setStatus]=useState('idle');
  const run=async()=>{ setStatus('loading'); try { const runtime=ai.decision??await ai.loadDecision(); const remaining=[...items], out:string[]=[]; while(remaining.length){ const q={pick:{type:'choice',instructions:`Which item is most relevant to this request? ${context}`,options:remaining} satisfies DecisionQuestion}; const a=await runtime.decide(context,q); const chosen=a.pick?.type==='choice'?a.pick.choice:remaining[0]; out.push(chosen); remaining.splice(Math.max(remaining.indexOf(chosen),0),1); } setSorted(out); onSorted?.(out); setStatus('ready'); } catch {setStatus('error');} };
  return <div className={className ?? 'smart-sort'} data-smart-ui="sort"><button type="button" disabled={!items.length||status==='loading'} onClick={()=>void run()}>{status==='loading'?'Ranking…':'Sort by relevance'}</button><ol>{sorted.map(x=><li key={x}>{x}</li>)}</ol></div>;
}

export function SmartPriorityBar(props: Omit<SmartChoiceProps,'options'> & {options?:readonly SmartOption[]}) { return <SmartPriority {...props} />; }

export type SmartMentionProps = Omit<SmartChoiceProps, 'options'> & { options?: readonly SmartOption[]; people?: readonly SmartOption[] };
export function SmartMentionPicker({ people, options, ...props }: SmartMentionProps) { return <SmartMention {...props} options={people ?? options ?? []} />; }

export function SmartTagsInput({ text, options, onSelect }: SmartChoiceProps) { return <SmartTags text={text ?? ''} tags={(options ?? []).map(optionValue)} onChange={onSelect ? (tags) => onSelect(tags.join(', ')) : undefined} />; }

export function SmartFormValues({ text, schema, onResult }: { text:string; schema:readonly string[]; onResult:(values:Record<string,unknown>)=>void }) { return <SmartForm text={text} fields={schema} onSuggest={onResult} />; }

export function SmartAssigneePicker(props: SmartChoiceProps) { return <SmartAssignee {...props} />; }

export function SmartColorPicker(props: Omit<SmartChoiceProps,'options'> & { options?:readonly SmartOption[]; palette?:Record<string,string> }) { return <SmartColorSwatch {...props} />; }

export function SmartEmoji(props: Omit<SmartChoiceProps,'options'> & { options?:readonly SmartOption[] }) { return <EmojiPicker {...props} />; }

export function SmartAutocompleteInput(props: SmartChoiceProps) { return <SmartAutocomplete {...props} />; }

export function SmartSearchFilters(props: { query:string; onQueryChange:(query:string)=>void; filters:readonly string[]; onFilter?:(filter:string)=>void }) { return <SmartSearch {...props} />; }

export function SmartDateInput(props: { text:string; onSelect:(isoDate:string)=>void }) { return <SmartDatePicker {...props} />; }

export function SmartUnitNormalizer(props: { text:string; units?:readonly string[]; onResult?:(normalized:string)=>void }) { return <SmartUnit {...props} />; }

export function SmartIconPicker(props: Omit<SmartChoiceProps,'options'> & { options?:readonly SmartOption[]; icons?:readonly string[] }) { return <SmartIcon {...props} options={props.options ?? props.icons ?? []} />; }

export function SmartStatusBadge(props: Omit<SmartChoiceProps,'options'> & {options?:readonly SmartOption[]}) { return <SmartStatus {...props} />; }

export function SmartSentimentBadge(props: Omit<SmartChoiceProps,'options'> & {options?:readonly SmartOption[]}) { return <SmartSentiment {...props} />; }

export function SmartRouteAction(props: SmartChoiceProps) { return <SmartRoute {...props} />; }

export function SmartGeneratedNotification(props: { event:string; onResult?:(message:string)=>void }) { return <SmartNotification {...props} />; }

export function SmartAddressParser(props: { text:string; onParsed:(address:Record<string,string>)=>void }) { return <SmartAddress {...props} />; }

export function SmartNumberNormalizer(props: { text:string; onValue:(number:number)=>void }) { return <SmartNumber {...props} />; }

export function SmartColumnMap(props: { columns:readonly string[]; schema:readonly string[]; onMap:(mapping:Record<string,string>)=>void }) { return <SmartColumnMapper {...props} />; }
