import assert from 'node:assert/strict';
export const demoUrl = process.env.DEMO_URL ?? 'http://127.0.0.1:5173/demos.html';
export const browserOptions = {
  headless:true, executablePath:process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  viewport:{width:1280,height:860}, args:['--no-sandbox','--disable-dev-shm-usage'],
};
export const profile = process.env.DEMO_PROFILE ?? '/tmp/intelligent-components-showcase-profile';
export async function enable(page) {
  // Vite may reload once while it discovers the worker's dependency on the first visit.
  for(let attempt=0;attempt<3;attempt++) {
    const button=page.getByRole('button',{name:'Enable on-device model'});
    if(await button.count())await button.click();
    await page.waitForFunction(()=>['ready','error','idle'].includes(document.querySelector('main')?.dataset.modelStatus),null,{timeout:600000});
    const phase=await page.locator('main').getAttribute('data-model-status');
    if(phase==='idle'){await page.waitForTimeout(500);continue;}
    assert.equal(phase,'ready',await page.locator('.model-error').count()?await page.locator('.model-error').innerText():await page.locator('.model-control').innerText());
    return;
  }
  throw new Error('The page kept reloading during model initialization. Restart Vite and retry.');
}
export async function formatScenario(page) {
  for(const [sample,kinds] of [
    ['Developer note',['title','paragraph','heading','javascript','heading','list']],
    ['Python recipe',['title','paragraph','heading','python','heading','list']],
  ]) {
    await page.getByRole('button',{name:sample,exact:true}).click();
    await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('[data-smart-ui="format"]')?.dataset.aiState),null,{timeout:180000});
    assert.equal(await page.locator('[data-smart-ui="format"]').getAttribute('data-ai-state'),'ready', await page.locator('[data-smart-ui="format"]').innerText());
    const rendered=await page.locator('[data-format-kind]').evaluateAll(elements=>elements.map(e=>({kind:e.dataset.formatKind,text:e.querySelector('code')?.textContent ?? (e.tagName==='UL' ? Array.from(e.children).map(child=>child.textContent).join('\n'):e.textContent)})));
    console.log('FORMAT',sample,rendered.map(b=>b.kind));
    assert.deepEqual(rendered.map(b=>b.kind),kinds);
    assert.equal(rendered.map(b=>b.text).join('\n\n'),await page.getByRole('textbox',{name:'Plain text to format'}).inputValue());
    assert.ok(await page.locator('code .hljs-keyword').count(),'Syntax highlighting is visible');
    await page.waitForTimeout(2400);
  }
  const input=page.getByRole('textbox',{name:'Plain text to format'});
  await page.getByRole('button',{name:'Developer note',exact:true}).click();
  await page.locator('[data-smart-ui="format"][data-ai-state="ready"]').waitFor({timeout:120000});
  const edited=(await input.inputValue()).replace('Customer Order API','Order history API');
  await input.fill(edited);
  await page.locator('[data-smart-ui="format"][data-ai-state="ready"]').waitFor({timeout:120000});
  assert.equal(await page.locator('[data-format-kind=title]').innerText(),'Order history API');
  assert.deepEqual(await page.locator('[data-format-kind]').evaluateAll(elements=>elements.map(e=>e.dataset.formatKind)),['title','paragraph','heading','javascript','heading','list']);
  await page.waitForTimeout(2500);
}
export async function emojiScenario(page) {
  const input=page.getByRole('textbox',{name:'Message for emoji'});
  for(const [text,expected] of [
    ['We finally shipped it! The whole team is celebrating.','🎉'],
    ['I was charged twice. Nobody replied for a week. This is completely unacceptable!','😡'],
    ['My dog barked at my boss on the video call. I cannot stop laughing!','😂'],
  ]) {
    await input.fill('');
    await input.pressSequentially(text,{delay:35});
    await page.locator('[data-demo-result="emoji"][data-ai-state="ready"]').waitFor({timeout:120000});
    const result=await page.locator('.big-emoji').innerText(); console.log('EMOJI',text,result); assert.equal(result,expected);
    await page.waitForTimeout(1800);
  }
}
export async function inboxScenario(page) {
  for(const [sample,queue] of [['Payment problem','Billing'],['Login bug','Engineering'],['Account help','Support']]) {
    await page.getByRole('button',{name:sample,exact:true}).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button',{name:'Route message →',exact:true}).click();
    await page.locator('[data-demo-result="inbox"][data-ai-state="ready"]').waitFor({timeout:120000});
    assert.equal(await page.locator(`[data-queue="${queue}"] .inbox-item`).count(),1);
    console.log('ROUTE',sample,queue); await page.waitForTimeout(2000);
  }
}
