import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EmojiPicker, JevProvider, SmartCategory, SmartEnum, SmartPriority, SmartTags, SmartTextarea } from './index';
import './demo.css';

function Demo() {
  const [text,setText]=useState('');
  const [emoji,setEmoji]=useState('');
  const [tags,setTags]=useState<string[]>([]);
  return <JevProvider>
    <main>
      <span className="eyebrow">LOCAL MODEL UI PRIMITIVES</span>
      <h1>Small models.<br/><span>Useful interactions.</span></h1>
      <p className="lede">A React component library for smart inputs and bounded decisions. Type below to try the emoji, priority, category, and tag components.</p>
      <section className="card">
        <label htmlFor="message">Message</label>
        <textarea id="message" rows={3} placeholder="Try: The production database is down and customers cannot log in." value={text} onChange={e=>setText(e.target.value)} />
        <div className="grid">
          <div><h2>Emoji</h2><EmojiPicker text={text} onSelect={setEmoji}/>{emoji&&<output className="picked">{emoji}</output>}</div>
          <div><h2>Priority</h2><SmartPriority text={text} onSelect={v=>console.log('priority',v)}/></div>
          <div><h2>Category</h2><SmartCategory text={text} options={['bug','feature','question','incident']} descriptions={{bug:'Something is broken',feature:'A new capability',question:'A request for information',incident:'A production issue'}}/></div>
          <div><h2>Enum</h2><SmartEnum text={text} options={['billing','account access','data loss','other']} label="Support queue"/></div>
        </div>
        <h2>Suggested tags</h2>
        <SmartTags text={text} tags={['production','login','database','billing','mobile','urgent']} onChange={setTags}/>
        <p className="muted">Selected tags: {tags.join(', ')||'—'}</p>
      </section>
      <section className="card rewrite"><h2>Text editing</h2><SmartTextarea value={text} onChange={setText} actions={['polish','shorten','make friendlier']}/></section>
      <footer>Decision components use open-jev in the browser. Generation loads the small LFM2.5‑230M model only when requested.</footer>
    </main>
  </JevProvider>;
}

createRoot(document.getElementById('root')!).render(<Demo/>);
